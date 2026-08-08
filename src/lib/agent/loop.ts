import type { SupabaseClient } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import type { Database } from '@/types/database'
import { anthropicAdapter } from '@/lib/agent/providers/anthropic'
import { googleAdapter } from '@/lib/agent/providers/google'
import { openaiAdapter } from '@/lib/agent/providers/openai'
import type {
  AgentMessage,
  AgentProviderAdapter,
  AgentToolCallPart,
} from '@/lib/agent/providers/provider'
import { dispatchTool } from '@/lib/agent/tools/registry'
import {
  MOBILE_READ_TOOL_NAMES,
  TOOL_SPECS,
  WRITE_TOOL_NAMES,
} from '@/lib/agent/tools/specs'
import { isMobileViewport } from '@/hooks/useMobileShell'
import { collectAgentUiContext } from '@/lib/agent/uiBridge'
import { agentUiCommandMutates } from '@/lib/agent/uiCommands'
import type { AgentAttachment } from '@/lib/agent/attachments'
import type { AgentSkillCommand } from '@/lib/agent/skills'
import canvasAdapterDoc from '@/lib/agent/skill/references/canvas-adapter.md?raw'
import roleDoc from '@/lib/agent/role.md?raw'
import {
  hasKey,
  modelFor,
  type AgentSettings,
} from '@/lib/agent/settings'
import { autoNameSession } from '@/lib/agent/sessions'
import {
  loadPersistedEvents,
  persistEvent,
} from '@/lib/agent/persistence'

type Client = SupabaseClient<Database>

const ADAPTERS: Record<string, AgentProviderAdapter> = {
  google: googleAdapter,
  anthropic: anthropicAdapter,
  openai: openaiAdapter,
}

/**
 * The system prompt lives in `role.md`, not in this file: the eval harness
 * runs under Node and needs the SAME text, and a hand-copied duplicate
 * drifts the moment either side is edited. `canvas-adapter.md` already
 * crosses that boundary this way — `?raw` here, `readFileSync` there.
 *
 * The service-designer posture + the canvas
 * adapter (the plugin rulebook's app translation), with the deeper
 * references behind the read_reference tool — the runtime version of the
 * skills' progressive disclosure. Full four-skill routing (loading
 * skills/map or skills/slice SKILL.md per task) layers on here once the
 * sync script vendors them; the adapter is written to make that a drop-in.
 */
const ROLE = roleDoc.trimEnd()


export function buildSystem(
  contextNote: string,
  skill?: AgentSkillCommand | null,
): string {
  return [
    ROLE,
    '\n\n--- canvas-adapter reference (FULL text — read_reference serves the other, deeper references) ---\n',
    canvasAdapterDoc,
    skill?.content
      ? `\n\n--- active skill: ${skill.label} (invoked by the user; the same SKILL.md IDE agents follow) ---\n${skill.content}\n\nYou are the canvas agent, not an IDE agent: skip the skill's file/script/CLI mechanics and act through your tools, translated by the canvas-adapter above. The skill's judgment — what makes a good blueprint/slice, the order of questions, the quality bars — applies in full.`
      : '',
    contextNote ? `\n\n--- current context ---\n${contextNote}` : '',
  ].join('')
}

// ---------------------------------------------------------------------------
// Per-session transcripts — module store so the panel can unmount freely.
// In-memory for the UI prototype; the sessions-persistence unit moves these
// into agent_messages without changing this API.
// ---------------------------------------------------------------------------

export type TranscriptEvent =
  | {
      kind: 'user'
      text: string
      /** Slash-skill id when the message invoked one (rendered as a chip). */
      skill?: string
      /** Attachment chip label when the message carried one. */
      attachmentLabel?: string
    }
  | { kind: 'assistant'; text: string }
  | {
      kind: 'tool'
      name: string
      summary: string
      isError: boolean
      /**
       * What the row expands to show. Presentation only — nothing reads
       * these back into the conversation, and they are absent on rows
       * rehydrated from `agent_messages`, which renders the row flat.
       */
      args?: string
      result?: string
    }
  | { kind: 'status'; text: string }

type SessionRun = {
  events: TranscriptEvent[]
  messages: AgentMessage[]
  running: boolean
  controller: AbortController | null
}

const runs = new Map<string, SessionRun>()
const listeners = new Set<() => void>()
let version = 0

function runFor(sessionId: string): SessionRun {
  let run = runs.get(sessionId)
  if (!run) {
    run = { events: [], messages: [], running: false, controller: null }
    runs.set(sessionId, run)
  }
  return run
}

function emit() {
  version += 1
  listeners.forEach((listener) => listener())
}

const snapshots = new Map<string, { version: number; value: SessionRun }>()

export function useAgentRun(sessionId: string): {
  events: TranscriptEvent[]
  running: boolean
} {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => {
      // Stable per-version snapshot so the store never loops the render.
      const cached = snapshots.get(sessionId)
      if (cached && cached.version === version) return cached.value
      const live = runFor(sessionId)
      const value: SessionRun = { ...live, events: [...live.events] }
      snapshots.set(sessionId, { version, value })
      return value
    },
  )
}

export function stopAgent(sessionId: string): void {
  runs.get(sessionId)?.controller?.abort()
}

/** The event minus its view-only fields — what agent_messages stores. */
function persistable(event: TranscriptEvent): TranscriptEvent {
  if (event.kind !== 'tool') return event
  const { args: _args, result: _result, ...rest } = event
  return rest
}

function push(sessionId: string, event: TranscriptEvent): void {
  const run = runFor(sessionId)
  run.events.push(event)
  // Best-effort write-through; a no-op without an authenticated client.
  // The tool row's expandable detail is deliberately NOT persisted: it is a
  // presentation affordance for the live run, and the stored payload shape
  // stays exactly what it has always been.
  persistEvent(sessionId, run.events.length - 1, persistable(event))
  emit()
}

const hydrated = new Set<string>()

/**
 * Restore a session's transcript from agent_messages, once per session per
 * page load. The provider-side conversation is rebuilt from the user and
 * assistant text turns — tool-call rounds are display history, not replay
 * material (providers reject orphaned tool calls, and Gemini signatures do
 * not survive a reload anyway).
 */
export async function hydrateAgentTranscript(sessionId: string): Promise<void> {
  if (hydrated.has(sessionId)) return
  hydrated.add(sessionId)
  const run = runFor(sessionId)
  if (run.events.length > 0 || run.running) return
  const events = await loadPersistedEvents(sessionId)
  if (!events || events.length === 0) return
  if (run.events.length > 0 || run.running) return // a send raced the load
  run.events = events
  run.messages = events.flatMap<AgentMessage>((event) => {
    if (event.kind === 'user')
      return [{ role: 'user', parts: [{ type: 'text', text: event.text }] }]
    if (event.kind === 'assistant')
      return [{ role: 'assistant', parts: [{ type: 'text', text: event.text }] }]
    return []
  })
  emit()
}

/**
 * Transcript-row detail text. Capped: a row is a reviewer's peek at the
 * payload, not a place to hold a megabyte of tool output in memory.
 */
const DETAIL_LIMIT = 2000

function detailText(value: unknown): string {
  const text =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  if (!text) return ''
  return text.length > DETAIL_LIMIT
    ? `${text.slice(0, DETAIL_LIMIT)}\n… (${text.length - DETAIL_LIMIT} more characters)`
    : text
}

/** One-line label for a tool call — the transcript's change-row text. */
function callSummary(call: AgentToolCallPart): string {
  const bits = Object.entries(call.args)
    .filter(([, value]) => typeof value === 'string' && value.length < 60)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`)
  return bits.join(', ')
}

const MAX_ROUNDS = 12

/**
 * The loop: send → text lands in the transcript, tool calls dispatch onto
 * the real wrappers → results feed back → repeat until the model stops or
 * the human hits Stop. Whatever landed stays — revertible from the sheet.
 */
export async function sendToAgent(input: {
  client: Client
  sessionId: string
  settings: AgentSettings
  contextNote: string
  text: string
  /** Slash-skill invoked with this message (its SKILL.md joins the system prompt). */
  skill?: AgentSkillCommand | null
  /** Canvas hand-off (annotation capture) folded into this message. */
  attachment?: AgentAttachment | null
  /**
   * Service-account session? Viewers (signed-in, non-service) get NO write
   * tools — the specs are filtered out, a stray call is refused, and RLS
   * would reject it anyway. View + navigate + annotate + answer only.
   */
  allowWrites?: boolean
}): Promise<void> {
  const { client, sessionId, settings, contextNote, text, skill, attachment } =
    input
  const allowWrites = input.allowWrites !== false
  const run = runFor(sessionId)
  if (run.running) return
  if (!hasKey(settings)) {
    push(sessionId, {
      kind: 'status',
      text: 'No API key for the selected provider — add one in ⚙.',
    })
    return
  }

  const adapter = ADAPTERS[settings.provider]
  const apiKey = settings.keys[settings.provider] ?? ''
  const controller = new AbortController()
  run.running = true
  run.controller = controller
  const modelText = attachment
    ? `${text}\n\n--- attached canvas annotations (drawn by the user, structure not pixels) ---\n${attachment.payload}`
    : text
  run.messages.push({ role: 'user', parts: [{ type: 'text', text: modelText }] })
  push(sessionId, {
    kind: 'user',
    text,
    ...(skill ? { skill: skill.id } : {}),
    ...(attachment ? { attachmentLabel: attachment.label } : {}),
  })
  // First message names the session — a list of "New session" rows says
  // nothing. Explicit renames always win (autoNameSession only replaces
  // the default title).
  autoNameSession(sessionId, text)

  // Batch etiquette, enforced rather than hoped for: after 8 writes in one
  // send, further writes bounce with a check-in instruction. The counter
  // resets per user message — sending "keep going" IS the check-in.
  let writesThisSend = 0
  const WRITE_BATCH_LIMIT = 8

  // The mobile shell is view-only for EVERY tier, service accounts included
  // — the agent there gets the reading roster and nothing else. Re-sampled
  // every round: a run spans many tool rounds, and a tablet rotated across
  // the breakpoint mid-run must not keep a roster the shell on screen
  // no longer matches. UX gate only; the server-side RPC tier enforcement
  // is the real wall.
  let mobileReading = isMobileViewport()

  try {
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      // Rebuilt every round: the live UI context changes as the agent's own
      // navigation tools move the canvas mid-conversation — and so can the
      // shell itself (rotation across the breakpoint).
      mobileReading = isMobileViewport()
      const liveContext = [contextNote, collectAgentUiContext()]
        .filter(Boolean)
        .join('\n')
      const result = await adapter.chat({
        system:
          buildSystem(liveContext, skill) +
          // The mobile paragraph subsumes the tier one — and they disagree
          // about annotations (viewer tier has annotate_cells; the mobile
          // roster does not), so only one may speak per send.
          (allowWrites || mobileReading
            ? ''
            : '\n\n--- session tier ---\nThis session is VIEW-ONLY (not a service account): you have no write tools. Navigate, read, annotate, and answer with citations; when the user wants an edit, describe the exact change for a service account to make — never imply you made it.') +
          (mobileReading
            ? '\n\n--- mobile shell ---\nThe user is on the MOBILE app, which is view-only for everyone — your tools are navigation and reading only (no writes, no annotations, no canvas mode switch). The mobile view is a vertical journey reader: scrolling down moves forward through the steps; a Map view shows the 2-D board. When the user wants an edit, explain it is made on desktop — never imply you made it.'
            : ''),
        messages: run.messages,
        // One pass: mobile's whitelist already contains zero write tools
        // (pinned by mobileRoster.test.ts), so it subsumes the tier filter.
        tools: TOOL_SPECS.filter((spec) =>
          mobileReading
            ? MOBILE_READ_TOOL_NAMES.has(spec.name)
            : allowWrites || !WRITE_TOOL_NAMES.has(spec.name),
        ),
        apiKey,
        model: modelFor(settings),
        signal: controller.signal,
      })

      // An all-filtered response (e.g. Gemini thought-only parts) must not
      // become an empty assistant turn — replaying one 400s on every
      // provider. Nothing usable came back; end the turn instead.
      if (result.parts.length === 0) break
      run.messages.push({ role: 'assistant', parts: result.parts })
      for (const part of result.parts) {
        if (part.type === 'text' && part.text.trim())
          push(sessionId, { kind: 'assistant', text: part.text })
      }

      const calls = result.parts.filter(
        (part): part is AgentToolCallPart => part.type === 'tool_call',
      )
      if (result.stopReason !== 'tool_use' || calls.length === 0) break

      const results: AgentMessage = { role: 'tool', parts: [] }
      // `ui_command` is normally interface-only, but a command may declare
      // itself a mutation (undo reverts through the delete RPCs). One
      // predicate so the viewer refusal and the batch limiter cannot
      // disagree about what counts as a write.
      const isWrite = (call: AgentToolCallPart) =>
        WRITE_TOOL_NAMES.has(call.name) ||
        (call.name === 'ui_command' &&
          agentUiCommandMutates(String(call.args.command ?? '')))
      for (const call of calls) {
        if (controller.signal.aborted) {
          // Stopping mid-batch must not strand the assistant's tool_use
          // parts without results: every provider rejects the NEXT send of
          // a transcript containing an unanswered tool call, which would
          // poison the session permanently. Answer everything not yet
          // dispatched with a stopped marker, commit the results turn,
          // THEN bail.
          for (const pending of calls) {
            const answered = results.parts.some(
              (part) =>
                part.type === 'tool_result' && part.toolCallId === pending.id,
            )
            if (answered) continue
            results.parts.push({
              type: 'tool_result',
              toolCallId: pending.id,
              name: pending.name,
              result: 'Stopped by the user before this call ran.',
              isError: true,
            })
          }
          run.messages.push(results)
          throw new DOMException('stopped', 'AbortError')
        }
        if (mobileReading && !MOBILE_READ_TOOL_NAMES.has(call.name)) {
          results.parts.push({
            type: 'tool_result',
            toolCallId: call.id,
            name: call.name,
            result:
              'The mobile shell is view-only — only the reading and navigation tools exist here. Editing happens on desktop; describe the change instead.',
            isError: true,
          })
          continue
        }
        if (isWrite(call) && !allowWrites) {
          results.parts.push({
            type: 'tool_result',
            toolCallId: call.id,
            name: call.name,
            result:
              'This session is view-only (not a service account) — no write tools exist here. Describe the change for a service account instead.',
            isError: true,
          })
          continue
        }
        if (isWrite(call) && writesThisSend >= WRITE_BATCH_LIMIT) {
          results.parts.push({
            type: 'tool_result',
            toolCallId: call.id,
            name: call.name,
            result: `Batch limit: ${WRITE_BATCH_LIMIT} writes already landed this turn. Stop now, summarize what you did, and let the user say "continue" before the next batch.`,
            isError: true,
          })
          push(sessionId, {
            kind: 'status',
            text: `Paused after ${WRITE_BATCH_LIMIT} writes — reply "continue" for the next batch.`,
          })
          continue
        }
        if (isWrite(call)) writesThisSend += 1
        try {
          const output = await dispatchTool(client, sessionId, call.name, call.args)
          results.parts.push({
            type: 'tool_result',
            toolCallId: call.id,
            name: call.name,
            result: output,
          })
          push(sessionId, {
            kind: 'tool',
            name: call.name,
            summary: callSummary(call),
            isError: false,
            args: detailText(call.args),
            result: detailText(output),
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          results.parts.push({
            type: 'tool_result',
            toolCallId: call.id,
            name: call.name,
            result: `Error: ${message}`,
            isError: true,
          })
          push(sessionId, {
            kind: 'tool',
            name: call.name,
            summary: message,
            isError: true,
            args: detailText(call.args),
            result: detailText(`Error: ${message}`),
          })
        }
      }
      run.messages.push(results)
      if (round === MAX_ROUNDS - 1)
        push(sessionId, {
          kind: 'status',
          text: 'Stopped after the round limit — send a message to continue.',
        })
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      push(sessionId, {
        kind: 'status',
        text: 'Stopped. Whatever already landed is in the change sheet, revertible.',
      })
    } else {
      const message = error instanceof Error ? error.message : String(error)
      push(sessionId, { kind: 'status', text: `Provider error: ${message}` })
    }
  } finally {
    run.running = false
    run.controller = null
    emit()
  }
}

#!/usr/bin/env node
/**
 * Canvas-agent eval harness. See cases.md for the human-readable suite;
 * cases.mjs holds the machine form (prompts, mocks, trace checks, judge
 * lines).
 *
 * Reality contract:
 * - READS are real (Supabase anon — RLS read-only, same rows the app sees).
 * - WRITES are dry-run: recorded in the trace, never sent anywhere.
 * - get_ui_state / get_change_history (and D2's get_cell) are per-case
 *   mocks — the CLI has no live shell to observe.
 *
 * One-sourced vs mirrored (be honest about which is which):
 * - ONE-SOURCED: the tool specs and rosters (TOOL_SPECS, WRITE_TOOL_NAMES,
 *   MOBILE_READ_TOOL_NAMES) are IMPORTED from src/lib/agent/tools/specs.ts
 *   — rolldown bundles it at startup, so the harness offers byte-identical
 *   declarations to the app's. Likewise role.md, canvas-adapter.md and the
 *   skill files are the SAME FILES the app loads (`?raw` there,
 *   readFileSync here). No copies, so no drift.
 * - MIRRORED BY HAND: the system-prompt ASSEMBLY (buildSystem + the tier /
 *   mobile injections), the Gemini provider glue, the batch limiter and
 *   the round cap follow src/lib/agent/loop.ts and providers/google.ts by
 *   copy — edit both sides together. The tool RESULT texts below are
 *   harness-local mocks of registry.ts behavior, not the real wrappers.
 *
 * Usage:
 *   node scripts/agent-harness/run.mjs             # full suite, Gemini
 *   node scripts/agent-harness/run.mjs --case D4   # one case
 *   node scripts/agent-harness/run.mjs --list      # print case ids, no key
 *   node scripts/agent-harness/run.mjs --smoke     # no key needed: mock
 *                                                  # provider, machinery only
 *   GEMINI_API_KEY comes from env or gitignored .env.local.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CASES } from './cases.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------
function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match) out[match[1]] = match[2].replace(/^"|"$/g, '')
  }
  return out
}
const env = {
  ...loadEnvFile(resolve(ROOT, '.env')),
  ...loadEnvFile(resolve(ROOT, '.env.local')),
  ...process.env,
}

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const opt = (name) => {
  const at = args.indexOf(`--${name}`)
  return at !== -1 ? args[at + 1] : undefined
}
const SMOKE = flag('smoke')
const ONLY = opt('case')
if (flag('list')) {
  for (const caseDef of CASES) console.log(`${caseDef.id}  ${caseDef.title}`)
  process.exit(0)
}
// --repeat N: run each case N times, majority-vote every rubric line.
// Separates model variance from regressions — a line at 1/3 is flaky or
// broken, a line at 3/3 is stable; a single run cannot tell you which.
const REPEAT = Math.max(1, Number(opt('repeat') ?? 1) || 1)
const MODEL = opt('model') ?? 'gemini-3.6-flash'
const JUDGE_MODEL = opt('judge-model') ?? MODEL
const API_KEY = env.GEMINI_API_KEY

if (!SMOKE && !API_KEY) {
  console.error(
    'GEMINI_API_KEY not set (env or .env.local). Add it there yourself — or run --smoke.',
  )
  process.exit(2)
}

// Plain PostgREST reads (anon) — supabase-js drags realtime in, which
// needs Node 22's native WebSocket; a fetch is all the harness needs.
async function rest(pathAndQuery) {
  const response = await fetch(
    `${env.VITE_SUPABASE_URL}/rest/v1/${pathAndQuery}`,
    {
      headers: {
        apikey: env.VITE_SUPABASE_ANON_KEY,
        authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
      },
    },
  )
  if (!response.ok) throw new Error(`postgrest ${response.status}: ${(await response.text()).slice(0, 200)}`)
  return response.json()
}

// ---------------------------------------------------------------------------
// System prompt (mirror of src/lib/agent/loop.ts — see header)
// ---------------------------------------------------------------------------
const ROLE = readFileSync(resolve(ROOT, 'src/lib/agent/role.md'), 'utf8').trimEnd()


const REFERENCES_DIR = resolve(ROOT, 'src/lib/agent/skill/references')
const SKILLS_DIR = resolve(ROOT, 'src/lib/agent/skill/skills')
const adapterDoc = readFileSync(resolve(REFERENCES_DIR, 'canvas-adapter.md'), 'utf8')

function buildSystem(skillId, contextNote) {
  const parts = [
    ROLE,
    '\n\n--- canvas-adapter reference (read_reference has more) ---\n',
    adapterDoc,
  ]
  if (skillId) {
    const content = readFileSync(resolve(SKILLS_DIR, `${skillId}.md`), 'utf8')
    parts.push(
      `\n\n--- active skill: /sb:${skillId === 'blueprint' ? 'map' : skillId} (invoked by the user; the same SKILL.md IDE agents follow) ---\n${content}\n\nYou are the canvas agent, not an IDE agent: skip the skill's file/script/CLI mechanics and act through your tools, translated by the canvas-adapter above. The skill's judgment — what makes a good blueprint/slice, the order of questions, the quality bars — applies in full.`,
    )
  }
  if (contextNote) parts.push(`\n\n--- current context ---\n${contextNote}`)
  return parts.join('')
}

// ---------------------------------------------------------------------------
// Tools — real reads, dry-run writes, per-case mocks
//
// The spec DECLARATIONS are one-sourced: specs.ts is deliberately kept
// node-loadable (its only imports are a type and the leaf referenceNames
// module) except for being TypeScript, so rolldown — already in the tree
// via rolldown-vite — bundles it to plain ESM at startup and the harness
// imports the exact objects the app hands its providers. Only the tool
// IMPLEMENTATIONS below (real reads, dry-run writes, mocks) are
// harness-local.
// ---------------------------------------------------------------------------
async function loadToolSpecs() {
  const { rolldown } = await import('rolldown')
  const bundle = await rolldown({
    input: resolve(ROOT, 'src/lib/agent/tools/specs.ts'),
    // Honor tsconfig's `@/*` → `src/*` path alias.
    resolve: { alias: { '@': resolve(ROOT, 'src') } },
    logLevel: 'silent',
  })
  const { output } = await bundle.generate({ format: 'esm' })
  await bundle.close()
  return import(
    `data:text/javascript;base64,${Buffer.from(output[0].code).toString('base64')}`
  )
}
const { TOOL_SPECS, WRITE_TOOL_NAMES, MOBILE_READ_TOOL_NAMES } =
  await loadToolSpecs()

// `ui_command` is interface-only EXCEPT the commands the live list marks
// "[changes data]" — the app asks the registry (agentUiCommandMutates);
// the harness has no live registry, so the marked names are pinned here.
const MUTATING_UI_COMMANDS = new Set([
  'undo_last_change',
  'revert_my_changes',
  'keep_all_changes',
])
// One predicate for "counts as a write", mirroring the app loop's isWrite:
// the write roster plus any ui_command whose command mutates data.
const isWriteCall = (name, args) =>
  WRITE_TOOL_NAMES.has(name) ||
  (name === 'ui_command' && MUTATING_UI_COMMANDS.has(String(args?.command ?? '')))
async function realListScenarios() {
  const data = await rest(
    'phases?select=id,name,order_position,service_scenarios(id,name,order_position)&order=order_position',
  )
  return data
    .map((phase) => {
      const scenarios = (phase.service_scenarios ?? [])
        .sort((a, b) => a.order_position - b.order_position)
        .map((s) => `  - scenario "${s.name}" (${s.id})`)
        .join('\n')
      return `phase "${phase.name}" (${phase.id})\n${scenarios}`
    })
    .join('\n')
}

async function realGetBlueprint(scenarioId) {
  const paths = await rest(
    `paths?select=id,name,path_type,layers(id,name,layer_role,row_position),path_steps(column_position,steps(id,name))&service_scenario_id=eq.${encodeURIComponent(scenarioId)}`,
  )
  if (!paths?.length) return 'No paths for that scenario id.'
  const out = []
  for (const path of paths) {
    const steps = (path.path_steps ?? [])
      .sort((a, b) => a.column_position - b.column_position)
      .map((ps) => ps.steps)
      .filter(Boolean)
    const cells = await rest(
      `cells?select=id,content,layer_id,step_id,owner&path_id=eq.${path.id}`,
    )
    out.push(
      `path "${path.name}" (${path.id}) type=${path.path_type}`,
      `  steps: ${steps.map((s) => `"${s.name}" (${s.id})`).join(', ')}`,
      ...(path.layers ?? [])
        .sort((a, b) => a.row_position - b.row_position)
        .map((layer) => {
          const laneCells = (cells ?? [])
            .filter((cell) => cell.layer_id === layer.id)
            .map((cell) => {
              const step = steps.find((s) => s.id === cell.step_id)
              return `    [${step?.name ?? '?'}] "${cell.content}" (${cell.id})${cell.owner ? ` owner=${cell.owner}` : ''}`
            })
          return `  lane "${layer.name}" (${layer.id}) role=${layer.layer_role ?? 'none'}\n${laneCells.join('\n') || '    (empty)'}`
        }),
    )
  }
  return out.join('\n')
}

async function realGetCell(cellId) {
  const data = await rest(
    `cells?select=id,content,description,owner,perceived_owner,function,form,value_props&id=eq.${encodeURIComponent(cellId)}`,
  )
  if (!data?.[0]) throw new Error(`No cell with id ${cellId}.`)
  return JSON.stringify(data[0], null, 1)
}

async function realListOwnerTags() {
  const data = await rest('cells?select=owner,perceived_owner')
  const tags = new Set()
  for (const row of data ?? []) {
    if (row.owner) tags.add(row.owner)
    if (row.perceived_owner) tags.add(row.perceived_owner)
  }
  return `Existing owner tags: ${[...tags].sort().join(', ')}`
}

async function realListSlices() {
  const data = await rest('slices?select=id,title,slice_type')
  return (data ?? []).map((s) => `"${s.title}" (${s.id}) type=${s.slice_type}`).join('\n')
}

// A frozen desktop base-view snapshot of listAgentUiCommands() output —
// name — description [changes data], sorted, each line VERBATIM from its
// registerAgentUiCommand call. Compare-mode commands (jump_divergence,
// differences_filter, collapse_shared, toggle_pleat) and open_make_slice
// come and go with their surfaces and are omitted, as the live list would
// omit them on a base view.
const UI_COMMANDS_SNAPSHOT = [
  'activate_base_tab — Bring the base blueprint view forward (deactivate any slice tab).',
  "cell_panel_close — Close the open cell detail panel.",
  'cell_panel_expand — Widen or shrink the open cell panel. arg: true (wide) | false (normal)',
  "cell_panel_tab — Switch the open cell panel's tab. arg: dependencies | evidence | resources",
  'clear_annotations — Erase every annotation mark from the canvas scratch layer.',
  'clear_cell_selection — Clear the Design-mode cell selection.',
  "close_slice_tab — Close a slice's open tab(s). arg: slice id.",
  'exit_presentation — Leave the running presentation back onto its slice tab.',
  'go_overview — Back to the zoomed-out overview of all phases (Home).',
  "keep_all_changes — Accept the session's changes (clears the change sheet). This DISCARDS every captured revert — after it, nothing in the session can be taken back. Refused when the session holds destructive changes; those need the human's own confirm. [changes data]",
  'open_slice_tab — Open a slice in a tab. arg: slice id (list_slices).',
  'present_slice — Start presenting a slice full-bleed. arg: slice id.',
  "revert_all_changes — WITHHELD, and listed here so you can see that it is: reverting the WHOLE session — the human's own edits included — is a human-only control (Revert all, in the Changes sheet). Firing this explains that and does nothing. Use revert_my_changes for your own edits.",
  "revert_my_changes — Take back the changes YOU made in this agent session, newest first, leaving the human's own edits and other sessions' edits alone. Reports what it took back and names anything it could not, with the reason. Prefer this over firing undo_last_change repeatedly — that walks the whole session including the human's edits, in no guaranteed order, and reports nothing. [changes data]",
  "select_cells — Gather cells into the Design-mode selection (for Make slice etc.). arg: comma-separated cell ids, or \"all\". Replaces the current selection. Needs design mode.",
  "set_scenario_view — Switch the SELECTED scenario between its two displays. arg: stacked | merged (needs 2+ visible paths). stacked = one full band per path on a shared step axis. merged = the paths combined into ONE blueprint: one lane rail, one step axis, cells the paths agree on drawn once, divergent slots stacking each path's version. Entering merged also applies the reading preset — shared steps fold and the difference ledger opens; returning to stacked unfolds. Legacy aliases accepted: side-by-side = stacked, integrated = merged.",
  'toggle_path_filter — Toggle a path variant\'s visibility (the PATHS checkboxes). arg: the path key (type:name, e.g. "happy:Happy Path") or a path name.',
  "toggle_phase_expanded — Expand/collapse a phase's accordion in the sidebar. arg: phase id.",
  "undo_last_change — Undo the newest revertible change of this session (same as ⌘Z). One at a time. Note this reverts whatever is newest — INCLUDING the human's own edit if theirs came last; say whose change you are undoing before firing it. [changes data]",
  'zoom — Zoom the canvas camera. arg: in | out | fit (fit the current focus)',
].join('\n')

let dryCounter = 0
const WRITE_BATCH_LIMIT = 8
async function dispatch(caseDef, name, args, trace, turn = 0) {
  const mock = caseDef.mocks?.[name]
  const record = { name, args, isError: false, turn }
  trace.push(record)
  // The app loop's gates, in the app's order: mobile roster, session tier,
  // then batch etiquette. (loop.ts checks each call the same way even
  // though filtered specs make stray calls unlikely — a hallucinated name
  // must bounce, not land.)
  if (caseDef.mobile && !MOBILE_READ_TOOL_NAMES.has(name)) {
    record.offRoster = true
    record.isError = true
    record.result =
      'The mobile shell is view-only — only the reading and navigation tools exist here. Editing happens on desktop; describe the change instead.'
    return record.result
  }
  if (caseDef.allowWrites === false && isWriteCall(name, args)) {
    record.refusedWrite = true
    record.isError = true
    record.result =
      'This session is view-only (not a service account) — no write tools exist here. Describe the change for a service account instead.'
    return record.result
  }
  // Mirror of the app loop's enforced batch etiquette: writes beyond the
  // per-turn limit bounce with a check-in instruction instead of landing.
  // Like the app, mutating ui_commands count, and only calls that landed
  // (no error) eat budget — a failed write changed nothing.
  if (isWriteCall(name, args)) {
    const executed = trace.filter(
      (t) =>
        t !== record &&
        t.turn === turn &&
        t.name !== '__text' &&
        isWriteCall(t.name, t.args) &&
        !t.isError,
    ).length
    if (executed >= WRITE_BATCH_LIMIT) {
      record.limited = true
      record.isError = true
      record.result = `Batch limit: ${WRITE_BATCH_LIMIT} writes already landed this turn. Stop now, summarize what you did, and let the user say "continue" before the next batch.`
      return record.result
    }
  }
  try {
    if (mock) {
      const result = typeof mock === 'function' ? await mock(args, trace) : mock
      if (result instanceof Error) throw result
      record.result = result
      return result
    }
    if (WRITE_TOOL_NAMES.has(name)) {
      dryCounter += 1
      record.dryRun = true
      // The rehearsal note matters: reads are REAL and will not reflect
      // this write — without it the model re-reads, concludes the write
      // failed, and retries (observed: doubled add_lane).
      record.result =
        name === 'record_finding'
          ? `Recorded ${args.severity ?? 'warn'} finding for ${args.check_name ?? '?'}. run_id ${args.run_id ?? `00000000-0000-4000-8000-00000000d${dryCounter}`}; reuse it for the rest of this run. NOTE: this is a rehearsal environment — reads will not show this change; do NOT re-read to verify or retry this write.`
          : `Done (${name} accepted, ref dry-${dryCounter}). NOTE: this is a rehearsal environment — reads will not show this change; do NOT re-read to verify or retry this write.`
      return record.result
    }
    switch (name) {
      case 'read_reference':
        record.result = readFileSync(resolve(REFERENCES_DIR, `${String(args.name).replace(/[^a-z-]/g, '')}.md`), 'utf8')
        return record.result
      case 'list_scenarios': record.result = await realListScenarios(); return record.result
      case 'get_blueprint': record.result = await realGetBlueprint(args.scenario_id); return record.result
      case 'get_cell': record.result = await realGetCell(args.cell_id); return record.result
      case 'get_compare_diff':
        // The compare model is a client-bundle computation (compareSlots.ts);
        // the harness has no bundler, so rehearsal falls back to the raw grids.
        record.result = 'get_compare_diff is unavailable in this rehearsal environment — read get_blueprint and compare the paths by hand (steps align across paths by name).'
        return record.result
      case 'list_owner_tags': record.result = await realListOwnerTags(); return record.result
      case 'list_slices': record.result = await realListSlices(); return record.result
      case 'get_slice': {
        const rows = await rest(
          `slices?select=id,title,description,slice_type,actor,origin,slice_items(id,position,caption,narrative,cell_ids)&id=eq.${encodeURIComponent(String(args.slice_id))}`,
        )
        if (!rows?.[0]) throw new Error('No slice with that id.')
        const slice = rows[0]
        const frames = [...(slice.slice_items ?? [])]
          .sort((a, b) => a.position - b.position)
          .map((f, i) => `frame ${i + 1}: cells [${(f.cell_ids ?? []).join(', ')}]${f.caption ? ` caption "${f.caption}"` : ''}`)
        record.result = `slice "${slice.title}" (${slice.id}) type=${slice.slice_type}\n${frames.join('\n') || '(no frames)'}`
        return record.result
      }
      case 'list_findings': {
        const filter = typeof args.status === 'string' ? args.status : 'open'
        const rows = await rest(
          `findings?select=id,source,check_name,severity,note,status,cell_ids,created_at&order=created_at.desc&limit=100${filter === 'all' ? '' : `&status=eq.${encodeURIComponent(filter)}`}`,
        )
        record.result = rows?.length
          ? rows.map((r) => `${r.id} [${r.severity}] ${r.check_name} (${r.source}, ${r.status}, ${String(r.created_at).slice(0, 10)}) cells:${(r.cell_ids ?? []).length}${r.note ? ` — ${r.note}` : ''}`).join('\n')
          : filter === 'all' ? 'No findings recorded yet.' : `No ${filter} findings.`
        return record.result
      }
      case 'open_cell_panel': record.result = 'Opened the cell detail panel.'; return record.result
      case 'set_canvas_mode': record.result = `Canvas mode is now ${args.mode === 'design' ? 'design' : 'view'}.`; return record.result
      case 'set_sidebar': record.result = args.collapsed === true ? 'Sidebar collapsed.' : 'Sidebar expanded.'; return record.result
      case 'list_ui_commands': record.result = UI_COMMANDS_SNAPSHOT; return record.result
      case 'ui_command': record.result = `Done (${args.command}${args.arg ? `: ${args.arg}` : ''}).`; return record.result
      case 'annotate_cells': record.result = `Drew boxes around ${Array.isArray(args.cell_ids) ? args.cell_ids.length : 0} cell(s).`; return record.result
      case 'get_ui_state': record.result = 'No UI state is being reported right now.'; return record.result
      case 'get_change_history': record.result = 'No changes recorded in this browser session yet.'; return record.result
      case 'get_deletion_impact':
        record.result = `Deleting this ${args.kind} would destroy:\n  4 cells\n  2 arrows\nWarnings:\n  1 slice will lose frames: \u201cTutor journey\u201d.\nWhat survives:\n  Archived to the recovery table first \u2014 nothing is destroyed without a copy behind it.\nRelay these sentences as they are. You cannot perform this delete \u2014 only the human can, through the confirm dialog, by typing the name.`
        return record.result
      case 'open_phase': record.result = 'Opened the phase on the canvas.'; return record.result
      case 'open_scenario': record.result = 'Opened the scenario on the canvas.'; return record.result
      case 'focus_cell': record.result = 'Scrolled the canvas to the cell.'; return record.result
      default:
        record.result = `Tool "${name}" is not on the allow-list.`
        return record.result
    }
  } catch (error) {
    record.isError = true
    record.result = `Error: ${error.message}`
    return record.result
  }
}

// ---------------------------------------------------------------------------
// Gemini (mirrors src/lib/agent/providers/google.ts incl. thoughtSignature)
// ---------------------------------------------------------------------------
async function geminiGenerate(model, body) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
  )
  if (!response.ok) throw new Error(`google ${response.status}: ${(await response.text()).slice(0, 400)}`)
  return response.json()
}

function toGoogleSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toGoogleSchema)
  if (schema && typeof schema === 'object') {
    const out = {}
    for (const [key, value] of Object.entries(schema)) {
      if (key === '$schema' || key === 'additionalProperties' || key === 'default') continue
      out[key] = toGoogleSchema(value)
    }
    return out
  }
  return schema
}

// The app loop's round cap (loop.ts MAX_ROUNDS) — keep them equal or the
// harness grades a budget the app does not have.
const MAX_ROUNDS = 12

async function runCaseLLM(caseDef) {
  const trace = []
  const replies = [] // final text per user turn
  const contents = []
  // One pass, mirroring loop.ts: mobile's whitelist already contains zero
  // write tools, so it subsumes the tier filter.
  const offered = TOOL_SPECS.filter((spec) =>
    caseDef.mobile
      ? MOBILE_READ_TOOL_NAMES.has(spec.name)
      : caseDef.allowWrites !== false || !WRITE_TOOL_NAMES.has(spec.name),
  )
  const tools = [{ functionDeclarations: offered.map((t) => ({ name: t.name, description: t.description, parameters: toGoogleSchema(t.parameters) })) }]
  // The tier / mobile injections are the app's, verbatim (loop.ts). The
  // mobile paragraph subsumes the tier one, so only one may speak.
  const system =
    buildSystem(caseDef.skill, caseDef.contextNote) +
    (caseDef.allowWrites !== false || caseDef.mobile
      ? ''
      : '\n\n--- session tier ---\nThis session is VIEW-ONLY (not a service account): you have no write tools. Navigate, read, annotate, and answer with citations; when the user wants an edit, describe the exact change for a service account to make — never imply you made it.') +
    (caseDef.mobile
      ? '\n\n--- mobile shell ---\nThe user is on the MOBILE app, which is view-only for everyone — your tools are navigation and reading only (no writes, no annotations, no canvas mode switch). The mobile view is a vertical journey reader: scrolling down moves forward through the steps; a Map view shows the 2-D board. When the user wants an edit, explain it is made on desktop — never imply you made it.'
      : '')

  for (const [turnIndex, turn] of caseDef.turns.entries()) {
    contents.push({ role: 'user', parts: [{ text: turn }] })
    let turnText = []
    let capped = true
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const data = await geminiGenerate(MODEL, {
        systemInstruction: { parts: [{ text: system }] },
        contents,
        tools,
      })
      const parts = data.candidates?.[0]?.content?.parts ?? []
      contents.push({ role: 'model', parts })
      const calls = parts.filter((p) => p.functionCall)
      for (const part of parts) {
        if (part.text && !part.thought) {
          turnText.push(part.text)
          // Text lands in the trace too (as __text events) so narration
          // ORDER is deterministically checkable — "narrated before the
          // first write" no longer needs a judge.
          trace.push({
            name: '__text',
            args: {},
            turn: turnIndex,
            result: part.text.slice(0, 200),
            isError: false,
          })
        }
      }
      if (calls.length === 0) {
        capped = false
        break
      }
      const responses = []
      for (const call of calls) {
        const result = await dispatch(caseDef, call.functionCall.name, call.functionCall.args ?? {}, trace, turnIndex)
        responses.push({ functionResponse: { name: call.functionCall.name, response: { result } } })
      }
      contents.push({ role: 'user', parts: responses })
    }
    // Round cap hit while the model still wanted tools: force one final
    // text-only answer so a flailing run yields something gradeable (the
    // app's equivalent is its round-limit status line).
    if (capped) {
      contents.push({
        role: 'user',
        parts: [
          {
            text: '[system] Tool-call budget exhausted. Answer the user NOW with what you have — no more tool calls.',
          },
        ],
      })
      const data = await geminiGenerate(MODEL, {
        systemInstruction: { parts: [{ text: system }] },
        contents,
        toolConfig: { functionCallingConfig: { mode: 'NONE' } },
        tools,
      })
      const parts = data.candidates?.[0]?.content?.parts ?? []
      contents.push({ role: 'model', parts })
      for (const part of parts) {
        if (part.text && !part.thought) turnText.push(part.text)
      }
    }
    replies.push(turnText.join('\n'))
  }
  return { trace, replies }
}

// Smoke provider: scripted minimal behavior to validate the machinery.
async function runCaseSmoke(caseDef) {
  const trace = []
  const replies = []
  for (const [index] of caseDef.turns.entries()) {
    if (index === 0 && caseDef.smokeCalls) {
      for (const [name, callArgs] of caseDef.smokeCalls) {
        await dispatch(caseDef, name, callArgs, trace)
      }
    }
    replies.push(caseDef.smokeReply ?? 'smoke reply — no model involved')
  }
  return { trace, replies }
}

// ---------------------------------------------------------------------------
// Judge
// ---------------------------------------------------------------------------
async function judge(caseDef, trace, replies) {
  if (!caseDef.judgeLines?.length) return []
  if (SMOKE)
    return caseDef.judgeLines.map((line) => ({ id: line.id, pass: null, note: 'smoke: judge skipped' }))
  const traceSummary = trace
    .map(
      (t, i) =>
        `${i + 1}. [turn ${t.turn + 1}] ${t.name}(${JSON.stringify(t.args)})${t.dryRun ? ' [dry-run]' : ''}${t.isError ? ' [ERROR]' : ''}\n   → ${String(t.result ?? '').replace(/\s+/g, ' ').slice(0, 300)}`,
    )
    .join('\n')
  const prompt = `You are grading an AI agent's behavior against a rubric.

Case: ${caseDef.id} — ${caseDef.title}
User turns:\n${caseDef.turns.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Tool-call trace:\n${traceSummary || '(no tool calls)'}

Agent replies (one per user turn):\n${replies.map((r, i) => `--- reply ${i + 1} ---\n${r}`).join('\n')}

Rubric lines to grade (pass/fail each, be strict but fair):
${caseDef.judgeLines.map((line) => `- id "${line.id}": ${line.text}`).join('\n')}

Respond with ONLY a JSON array: [{"id": "...", "pass": true/false, "note": "one short sentence"}]`
  const data = await geminiGenerate(JUDGE_MODEL, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  })
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '[]'
  try {
    return JSON.parse(text)
  } catch {
    return caseDef.judgeLines.map((line) => ({ id: line.id, pass: false, note: 'judge output unparseable' }))
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const transcriptsDir = resolve(ROOT, 'scripts/agent-harness/transcripts')
mkdirSync(transcriptsDir, { recursive: true })

let selected = CASES.filter((c) => !ONLY || c.id.toLowerCase() === ONLY.toLowerCase())
if (SMOKE) selected = selected.filter((c) => c.smokeCalls)
if (selected.length === 0) {
  console.error(`No case matches "${ONLY}". Known: ${CASES.map((c) => c.id).join(', ')}`)
  process.exit(2)
}

async function runAttempt(caseDef) {
  let trace = []
  let replies = []
  let runError = null
  try {
    ;({ trace, replies } = SMOKE ? await runCaseSmoke(caseDef) : await runCaseLLM(caseDef))
  } catch (error) {
    runError = error.message
  }
  const results = []
  if (runError) {
    results.push({ id: 'run', pass: false, note: `run failed: ${runError}` })
  } else {
    for (const check of caseDef.traceChecks ?? []) {
      try {
        const verdict = check.fn(trace, replies)
        results.push({ id: check.id, pass: verdict === true, note: verdict === true ? '' : String(verdict) })
      } catch (error) {
        results.push({ id: check.id, pass: false, note: `check threw: ${error.message}` })
      }
    }
    results.push(...(await judge(caseDef, trace, replies)))
  }
  return { trace, replies, results }
}

const rows = []
let failures = 0
for (const caseDef of selected) {
  process.stdout.write(`\n▶ ${caseDef.id} · ${caseDef.title}${REPEAT > 1 ? ` (×${REPEAT}, majority)` : ''}\n`)
  if (caseDef.prepare) {
    try {
      Object.assign(caseDef, await caseDef.prepare({ rest }))
    } catch (error) {
      process.stdout.write(`   FAIL  prepare — ${error.message}\n`)
      failures += 1
      continue
    }
  }
  const attempts = []
  for (let attempt = 0; attempt < REPEAT; attempt += 1) {
    attempts.push(await runAttempt(caseDef))
  }
  // Majority per line id across attempts; a line missing from an attempt
  // (e.g. a crashed run) counts as a fail for that attempt.
  const lineIds = [...new Set(attempts.flatMap((a) => a.results.map((r) => r.id)))]
  const results = lineIds.map((id) => {
    const verdicts = attempts.map((a) => a.results.find((r) => r.id === id))
    const passes = verdicts.filter((v) => v?.pass === true).length
    const skips = verdicts.filter((v) => v?.pass === null).length
    if (skips === attempts.length) return { id, pass: null, note: verdicts[0]?.note ?? '' }
    const pass = passes > attempts.length / 2
    const note =
      REPEAT > 1
        ? `${passes}/${attempts.length}${pass ? '' : ` — ${verdicts.find((v) => v && v.pass === false)?.note ?? ''}`}`
        : (verdicts[0]?.note ?? '')
    return { id, pass, note }
  })
  const { trace, replies } = attempts[attempts.length - 1]
  for (const result of results) {
    const mark = result.pass === true ? 'PASS' : result.pass === null ? 'SKIP' : 'FAIL'
    if (result.pass === false) failures += 1
    process.stdout.write(`   ${mark}  ${result.id}${result.note ? ` — ${result.note}` : ''}\n`)
    rows.push({ case: caseDef.id, ...result })
  }
  writeFileSync(
    resolve(transcriptsDir, `${stamp}-${caseDef.id}.md`),
    [
      `# ${caseDef.id} · ${caseDef.title}`,
      `model: ${SMOKE ? 'smoke' : MODEL}`,
      '',
      '## Turns',
      ...caseDef.turns.map((t, i) => `${i + 1}. ${t}`),
      '',
      '## Trace',
      ...trace.map((t, i) => `${i + 1}. ${t.name}(${JSON.stringify(t.args)})${t.dryRun ? ' [dry-run]' : ''}${t.isError ? ' [ERROR]' : ''}\n\n${String(t.result).slice(0, 600)}\n`),
      '## Replies',
      ...replies.map((r, i) => `--- reply ${i + 1} ---\n${r}\n`),
      '## Results',
      ...results.map((r) => `- ${r.pass === true ? 'PASS' : r.pass === null ? 'SKIP' : 'FAIL'} ${r.id} ${r.note ?? ''}`),
    ].join('\n'),
  )
}

const total = rows.filter((r) => r.pass !== null).length
console.log(`\n${'='.repeat(60)}`)
console.log(`${total - failures}/${total} rubric lines passed · transcripts in scripts/agent-harness/transcripts/${stamp}-*.md`)
process.exit(failures > 0 ? 1 : 0)

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  addLane,
  addStep,
  createPath,
  createPhase,
  createScenario,
  duplicatePath,
  renamePath,
  setCellDependency,
  upsertCell,
} from '@/lib/authoringRpc'
import {
  createSlice,
  replaceSliceFrames,
  updateSliceMeta,
} from '@/lib/sliceMutations'
import type { SliceType } from '@/lib/sliceValidation'
import { asUpdatedAtToken } from '@/lib/optimisticConcurrency'
import { setSharedCanvasMode } from '@/contexts/canvasModeContext'
import {
  listAgentUiCommands,
  runAgentUiCommand,
} from '@/lib/agent/uiCommands'
import {
  describeChange,
  sessionSnapshot,
  setAgentAttribution,
} from '@/lib/authoringSession'
import {
  updateCellContent,
  type CellContentUpdate,
} from '@/lib/cellContentMutations'
import { updateCellSpec } from '@/lib/cellSpecMutations'
import { findingFingerprint } from '@/lib/findingFingerprint'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import type { ToolSpec } from '@/lib/agent/providers/provider'
import {
  agentAnnotateCells,
  agentFocusCell,
  agentOpenCellPanel,
  agentOpenPhase,
  agentOpenScenario,
  agentSetSidebar,
  collectAgentUiContext,
} from '@/lib/agent/uiBridge'
import {
  getBlueprint,
  getCell,
  getCompareDiff,
  listOwnerTags,
  listScenarios,
  listSlices,
  readReference,
  REFERENCE_NAMES,
} from '@/lib/agent/tools/read'

type Client = SupabaseClient<Database>

/**
 * The static allow-list — the agent's entire reach. Each write dispatches
 * onto the SAME wrapper the UI calls, so RLS, validation, session logging
 * and revert capture come free; there is no dynamic dispatch, no table
 * name as an argument, no free SQL. A request for anything else is a
 * refusal, not an attempt. Deliberately absent: every delete.
 */

const str = (description: string) => ({ type: 'string', description })

/** The tools that mutate data — the loop enforces batch etiquette on these. */
export const WRITE_TOOL_NAMES = new Set([
  'add_step',
  'add_lane',
  'upsert_cell',
  'update_cell_content',
  'update_cell_spec',
  'set_cell_dependency',
  'rename_path',
  'create_phase',
  'create_scenario',
  'create_path',
  'duplicate_path',
  'create_slice',
  'update_slice',
  'replace_slice_frames',
  'record_finding',
  'set_finding_status',
])

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: 'read_reference',
    description: `Read a rulebook reference before acting on its topic. Available: ${REFERENCE_NAMES.join(', ')}. Read canvas-adapter before your first write of a session; layer-roles and lane-vocabulary before any lane/role work; elicitation-protocol before co-creating a scenario from notes.`,
    parameters: {
      type: 'object',
      properties: { name: str('Reference name, e.g. "layer-roles"') },
      required: ['name'],
    },
  },
  {
    name: 'list_scenarios',
    description: 'List every phase and its scenarios, with ids.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_blueprint',
    description:
      'Full grid of one scenario: every path with its steps, lanes, and cells (ids included). Read before writing into a scenario.',
    parameters: {
      type: 'object',
      properties: { scenario_id: str('Scenario id from list_scenarios') },
      required: ['scenario_id'],
    },
  },
  {
    name: 'get_compare_diff',
    description:
      "Structured comparison of a scenario's paths: canonical columns with verdicts, one group per divergent STEP (the same \"Step N\" the ledger groups by and jump_divergence takes) tagged with the divergence zone ①②③ the strip draws, every differing slot with per-path quotes and cell ids, and the detail-only (description/links) group. Read before driving the compare UI or answering \"what differs\". Triggers/needs edges are not compared.",
    parameters: {
      type: 'object',
      properties: {
        scenario_id: str('Scenario id from list_scenarios'),
        path_ids: {
          type: 'array',
          description:
            'Optional subset (2+) of the scenario\'s path ids, in comparison order; omit to compare every path',
          items: { type: 'string' },
        },
      },
      required: ['scenario_id'],
    },
  },
  {
    name: 'get_cell',
    description: 'One cell in full: content, summary, owners, function/form/value, position.',
    parameters: {
      type: 'object',
      properties: { cell_id: str('Cell id') },
      required: ['cell_id'],
    },
  },
  {
    name: 'list_slices',
    description: 'List existing slices (stakeholder views) with ids and types.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_slice',
    description:
      'One slice in full: fields plus every frame with its cells, caption, narrative. Read before update_slice or replace_slice_frames.',
    parameters: {
      type: 'object',
      properties: { slice_id: str('Slice id from list_slices') },
      required: ['slice_id'],
    },
  },
  {
    name: 'list_owner_tags',
    description:
      'The owner tag vocabulary in use. ALWAYS read before writing owner or perceived_owner — reuse an existing tag unless creating one deliberately.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_ui_state',
    description:
      'What the user is looking at RIGHT NOW: view level, selected phase/scenario, active tab, open cell panel, Design-mode selection. Call after navigating, or whenever "this/here/what I selected" needs grounding. When the user asks what they are looking at, relay EVERY line — view level included, not just the selection.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_change_history',
    description:
      "This session's edit history — every change made in this browser session (human and agent), newest first. When reporting it, distinguish user edits from agent edits and remind the user rows are revertible from the change sheet.",
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max entries (default 30)' },
      },
    },
  },
  {
    name: 'open_phase',
    description:
      'Navigate the user\'s canvas to a phase. Use when asked to go to / show / open something, or to show your work after writing into it.',
    parameters: {
      type: 'object',
      properties: { phase_id: str('Phase id from list_scenarios') },
      required: ['phase_id'],
    },
  },
  {
    name: 'open_scenario',
    description:
      'Navigate the user\'s canvas to a scenario. Open the scenario before focus_cell.',
    parameters: {
      type: 'object',
      properties: { scenario_id: str('Scenario id from list_scenarios') },
      required: ['scenario_id'],
    },
  },
  {
    name: 'focus_cell',
    description:
      'Scroll the open scenario\'s canvas to a specific cell — use to point at evidence when answering questions. The cell\'s scenario must be open first (open_scenario).',
    parameters: {
      type: 'object',
      properties: { cell_id: str('Cell id') },
      required: ['cell_id'],
    },
  },
  {
    name: 'list_ui_commands',
    description:
      'The LIVE list of UI controls you can drive right now (panel tabs, zoom, compare toggle, presentation, undo, …). Commands appear/disappear with the surfaces that own them — list before ui_command when unsure what exists.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'ui_command',
    description:
      'Fire a UI control by name (from list_ui_commands), with an optional arg. Interface only, with ONE exception the list marks "[changes data]": undo_last_change reverts through the delete path, counts against your write batch, and undoes whatever is newest — including the human\'s own edit. Say whose change you are undoing before firing it.',
    parameters: {
      type: 'object',
      properties: {
        command: str('Command name from list_ui_commands'),
        arg: str('Argument where the command takes one; omit otherwise'),
      },
      required: ['command'],
    },
  },
  {
    name: 'open_cell_panel',
    description:
      "Open the cell detail side panel on the user's screen — the same panel a click opens. The cell's scenario must be open first (open_scenario).",
    parameters: {
      type: 'object',
      properties: { cell_id: str('Cell id') },
      required: ['cell_id'],
    },
  },
  {
    name: 'set_canvas_mode',
    description:
      "Switch the user's canvas between 'view' (reading) and 'design' (authoring) mode — same switch as the toolbar's.",
    parameters: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['view', 'design'], description: 'Target mode' },
      },
      required: ['mode'],
    },
  },
  {
    name: 'set_sidebar',
    description: 'Collapse or expand the sidebar (more canvas vs more navigation).',
    parameters: {
      type: 'object',
      properties: {
        collapsed: { type: 'boolean', description: 'true = collapse' },
      },
      required: ['collapsed'],
    },
  },
  {
    name: 'annotate_cells',
    description:
      'Draw ephemeral annotation boxes around cells on the open canvas (optional short text note above them) — use to point at things visually, like a human with a marker. Marks are scratch-layer only: never saved, cleared on reload.',
    parameters: {
      type: 'object',
      properties: {
        cell_ids: {
          type: 'array',
          description: 'Cells to box (must be on the open scenario)',
          items: { type: 'string' },
        },
        note: str('Optional short label drawn above the boxes; omit for none'),
      },
      required: ['cell_ids'],
    },
  },
  {
    name: 'create_phase',
    description:
      'Create a new phase in the service lifecycle. Propose the structure as text and get a nod first.',
    parameters: {
      type: 'object',
      properties: {
        name: str('Phase name'),
        description: str('One-line description; omit for none'),
      },
      required: ['name'],
    },
  },
  {
    name: 'create_scenario',
    description:
      'Create a new scenario in a phase, with its first path and empty steps. lane_source_path_id copies an existing path\'s lane stack (STRONGLY preferred — lane labels must match across scenarios). Propose as text and get a nod first.',
    parameters: {
      type: 'object',
      properties: {
        phase_id: str('Phase id from list_scenarios'),
        name: str('Scenario name'),
        path_name: str('First path name; defaults to "Happy Path"'),
        step_count: { type: 'number', description: 'Initial step columns (default 5)' },
        lane_source_path_id: str('Path id whose lanes to copy; omit for none'),
      },
      required: ['phase_id', 'name'],
    },
  },
  {
    name: 'create_path',
    description:
      'Add a path (variant) to a scenario — alternative/unhappy/exception. lane_source_path_id copies the sibling\'s lane stack (preferred).',
    parameters: {
      type: 'object',
      properties: {
        scenario_id: str('Scenario id'),
        name: str('Path name'),
        path_type: {
          type: 'string',
          enum: ['happy', 'unhappy', 'exception', 'alternative', 'named'],
          description: 'Default alternative',
        },
        lane_source_path_id: str('Sibling path id whose lanes to copy; omit for none'),
      },
      required: ['scenario_id', 'name'],
    },
  },
  {
    name: 'duplicate_path',
    description:
      'Copy a path — lanes, steps, optionally cells and arrows — as a new variant of the same scenario.',
    parameters: {
      type: 'object',
      properties: {
        source_path_id: str('Path to copy'),
        name: str('New path name'),
        path_type: { type: 'string', enum: ['happy', 'unhappy', 'exception', 'alternative', 'named'], description: 'Default alternative' },
        copy_cells: { type: 'boolean', description: 'Default true' },
      },
      required: ['source_path_id', 'name'],
    },
  },
  {
    name: 'create_slice',
    description:
      'Create a slice (stakeholder view) that REFERENCES existing cells — never copies. cell_ids in journey order, one frame per cell by default. Propose members by name and get a nod first.',
    parameters: {
      type: 'object',
      properties: {
        title: str('Slice title'),
        description: str('One-line description; omit for none'),
        slice_type: {
          type: 'string',
          enum: ['journey', 'lane', 'step', 'custom'],
          description: 'Kind of cut',
        },
        actor: str('Whose view this is; omit for none'),
        cell_ids: {
          type: 'array',
          description: 'Existing cell ids, in journey order',
          items: { type: 'string' },
        },
      },
      required: ['title', 'slice_type', 'cell_ids'],
    },
  },
  {
    name: 'update_slice',
    description: "Edit a slice's own fields: title, description, actor, type.",
    parameters: {
      type: 'object',
      properties: {
        slice_id: str('Slice id from list_slices'),
        title: str('omit to keep'),
        description: str('omit to keep'),
        actor: str('omit to keep'),
        slice_type: { type: 'string', enum: ['journey', 'lane', 'step', 'custom'], description: 'omit to keep' },
      },
      required: ['slice_id'],
    },
  },
  {
    name: 'replace_slice_frames',
    description:
      "Replace a slice's frames wholesale — THE tool for reordering, resequencing, merging cells into one screen, or splitting them apart. Read the slice first; pass the complete new frame list (each frame: cells in order + optional caption/narrative). When a reorder instruction is positionally ambiguous (e.g. \"move the last one up, then merge 2 and 3\" — original numbering or after the move?), confirm which you mean before writing.",
    parameters: {
      type: 'object',
      properties: {
        slice_id: str('Slice id'),
        frames: {
          type: 'array',
          description: 'Full replacement, in order',
          items: {
            type: 'object',
            properties: {
              cells: { type: 'array', description: 'Cell ids in this frame', items: { type: 'string' } },
              caption: str('Frame caption; omit for none'),
              narrative: str('Frame narrative; omit for none'),
            },
            required: ['cells'],
          },
        },
      },
      required: ['slice_id', 'frames'],
    },
  },
  {
    name: 'add_step',
    description:
      'Add a step (column) to a path. Read sibling paths first — step names align across paths BY NAME, so reuse the exact name when the step exists elsewhere.',
    parameters: {
      type: 'object',
      properties: {
        path_id: str('Path id'),
        name: str('Step name'),
        at_position: {
          type: 'number',
          description: 'Insert position (1-based); omit to append',
        },
      },
      required: ['path_id', 'name'],
    },
  },
  {
    name: 'add_lane',
    description:
      'Add a lane to EVERY path of a scenario. Read layer-roles and lane-vocabulary first; lane labels are byte-identical for the same actor group across scenarios.',
    parameters: {
      type: 'object',
      properties: {
        scenario_id: str('Scenario id'),
        name: str('Lane label'),
        layer_role: str(
          'Semantic role (e.g. frontstage_actions, backstage_tech); omit if none fits',
        ),
        at_row: { type: 'number', description: 'Insert row (1-based); omit to append' },
      },
      required: ['scenario_id', 'name'],
    },
  },
  {
    name: 'upsert_cell',
    description:
      'Create the cell at (path, lane, step). content is REQUIRED and must be real journey text — an empty or placeholder cell is invisible in the grid.',
    parameters: {
      type: 'object',
      properties: {
        path_id: str('Path id'),
        layer_id: str('Lane id (from get_blueprint)'),
        step_id: str('Step id (from get_blueprint)'),
        content: str('The cell text — a journey moment, not a system capability'),
      },
      required: ['path_id', 'layer_id', 'step_id', 'content'],
    },
  },
  {
    name: 'update_cell_content',
    description:
      'Edit a cell: text, summary (the tl;dr — never a copy of the text), owner and perceived_owner (existing tags — see list_owner_tags). Reads the current values first internally, so only pass fields you mean to change.',
    parameters: {
      type: 'object',
      properties: {
        cell_id: str('Cell id'),
        content: str('New cell text; omit to keep'),
        summary: str('New summary; omit to keep'),
        owner: str('Owner tag; omit to keep'),
        perceived_owner: str('Perceived-owner tag; omit to keep'),
      },
      required: ['cell_id'],
    },
  },
  {
    name: 'update_cell_spec',
    description:
      'Edit a cell’s spec: function (what it does), form (how it appears), value_props (audience/value pairs).',
    parameters: {
      type: 'object',
      properties: {
        cell_id: str('Cell id'),
        function: str('Function text; omit to keep'),
        form: str('Form text; omit to keep'),
        value_props: {
          type: 'array',
          description: 'Full replacement list of {for, value}; omit to keep',
          items: {
            type: 'object',
            properties: { for: str('Audience'), value: str('The value delivered') },
            required: ['for', 'value'],
          },
        },
      },
      required: ['cell_id'],
    },
  },
  {
    name: 'set_cell_dependency',
    description:
      'Connect two cells on the SAME path. kind "trigger" = source sets target in motion (drawn as an arrow); "needs" = source depends on target existing (panel-only) — "only makes sense after X" / "depends on X" reads as needs. State which kind you chose and why in your reply. Arrows only where they add information.',
    parameters: {
      type: 'object',
      properties: {
        source_cell_id: str('Source cell id'),
        target_cell_id: str('Target cell id'),
        kind: { type: 'string', enum: ['trigger', 'needs'], description: 'Default trigger' },
        label: str('Short arrow label; omit for none'),
      },
      required: ['source_cell_id', 'target_cell_id'],
    },
  },
  {
    name: 'rename_path',
    description: 'Rename a path.',
    parameters: {
      type: 'object',
      properties: { path_id: str('Path id'), name: str('New name') },
      required: ['path_id', 'name'],
    },
  },
  {
    name: 'list_findings',
    description:
      'The findings ledger: audit/whatif findings with status. Read before recording (see what is already open) and when the human asks to triage.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['open', 'resolved', 'dismissed', 'all'],
          description: 'Filter; default open',
        },
      },
    },
  },
  {
    name: 'record_finding',
    description:
      'Record one sb:audit / sb:whatif finding as a triageable row. Dedupe is built in: an open finding with the same fingerprint (check_name + cited cells) is updated in place, a dismissed one stays dismissed (the call reports it and writes nothing), a resolved one reopens as a new row. Omit run_id on the first finding of a run and reuse the returned run_id for the rest of that run. Cite cells by id; for a zero-cell finding pass scope instead (e.g. "scenario:Warm-Up").',
    parameters: {
      type: 'object',
      properties: {
        source: { type: 'string', enum: ['audit', 'whatif'], description: 'Which skill produced it' },
        check_name: str('Roster check name, e.g. "gap-sweep"'),
        severity: { type: 'string', enum: ['info', 'warn', 'critical'], description: 'Per the check doc default unless evidence says otherwise' },
        note: str('The finding itself — what is wrong, where, and why it matters. No raw ids in this text.'),
        cell_ids: {
          type: 'array',
          description: 'Cells the finding is about; omit only for zero-cell findings',
          items: { type: 'string' },
        },
        scope: str('Zero-cell fingerprint scope, required when cell_ids is empty. Include a short reason slug so two zero-cell findings from one check cannot collide, e.g. "scenario:Warm-Up:orphan-step-cooldown"'),
        run_id: str('The run identity returned by the first record_finding of this run'),
      },
      required: ['source', 'check_name', 'severity', 'note'],
    },
  },
  {
    name: 'set_finding_status',
    description:
      'Triage a finding: resolved (fixed / no longer true) or dismissed (accepted as-is; dismissed findings never reopen), or open to reopen. This is the only edit humans or agents make to an existing finding.',
    parameters: {
      type: 'object',
      properties: {
        finding_id: str('Finding id from list_findings'),
        status: { type: 'string', enum: ['open', 'resolved', 'dismissed'], description: 'New status' },
      },
      required: ['finding_id', 'status'],
    },
  },
]

// One lifecycle per deployment today; cached after the first ask.
let cachedLifecycleId: string | null = null
async function lifecycleId(client: Client): Promise<string> {
  if (cachedLifecycleId) return cachedLifecycleId
  const { data, error } = await client
    .from('service_lifecycles')
    .select('id')
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No service lifecycle exists yet.')
  cachedLifecycleId = data.id
  return data.id
}

function s(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key]
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function need(args: Record<string, unknown>, key: string): string {
  const value = s(args, key)
  if (!value) throw new Error(`Missing required argument "${key}".`)
  return value
}

/**
 * Execute one tool call. Returns the text the model sees. Writes are
 * attributed to the agent session for the ledger's ✦ badge, and the query
 * cache is invalidated so the canvas repaints live.
 */
export async function dispatchTool(
  client: Client,
  agentSessionId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case 'read_reference':
      return readReference(need(args, 'name'))
    case 'list_scenarios':
      return listScenarios(client)
    case 'get_blueprint':
      return getBlueprint(client, need(args, 'scenario_id'))
    case 'get_compare_diff': {
      const pathIds = Array.isArray(args.path_ids)
        ? args.path_ids.filter(
            (value): value is string => typeof value === 'string',
          )
        : undefined
      return getCompareDiff(client, need(args, 'scenario_id'), pathIds)
    }
    case 'get_cell':
      return getCell(client, need(args, 'cell_id'))
    case 'list_slices':
      return listSlices(client)
    case 'list_owner_tags':
      return listOwnerTags(client)
    case 'get_ui_state': {
      const context = collectAgentUiContext()
      return context || 'No UI state is being reported right now.'
    }
    case 'get_change_history': {
      const limit =
        typeof args.limit === 'number' && args.limit > 0 ? args.limit : 30
      const entries = [...sessionSnapshot()].reverse().slice(0, limit)
      if (entries.length === 0)
        return 'No changes recorded in this browser session yet.'
      return entries
        .map((entry) => {
          const who =
            entry.author === 'agent'
              ? `agent${entry.agentSessionId === agentSessionId ? ' (this session)' : ''}`
              : 'user'
          const when = new Date(entry.at).toISOString().slice(11, 19)
          return `[${when} UTC] ${who}: ${describeChange(entry)}${entry.revert ? '' : ' (not revertible)'}`
        })
        .join('\n')
    }
    case 'get_slice': {
      const sliceId = need(args, 'slice_id')
      const { data, error } = await client
        .from('slices')
        .select('id, title, description, slice_type, actor, origin, slice_items(id, position, caption, narrative, cell_ids)')
        .eq('id', sliceId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) throw new Error(`No slice with id ${sliceId}.`)
      const frames = [...(data.slice_items ?? [])]
        .sort((a, b) => a.position - b.position)
        .map(
          (frame, index) =>
            `frame ${index + 1}: cells [${(frame.cell_ids ?? []).join(', ')}]${frame.caption ? ` caption "${frame.caption}"` : ''}${frame.narrative ? ` narrative "${frame.narrative}"` : ''}`,
        )
      return `slice "${data.title}" (${data.id}) type=${data.slice_type}${data.actor ? ` actor=${data.actor}` : ''}\n${frames.join('\n') || '(no frames)'}`
    }
    case 'list_findings': {
      const filter = s(args, 'status') ?? 'open'
      let query = client
        .from('findings')
        .select('id, source, check_name, severity, note, status, cell_ids, created_at')
        .order('created_at', { ascending: false })
        .limit(100)
      if (filter !== 'all')
        query = query.eq('status', filter)
      const { data, error } = await query
      if (error) throw new Error(error.message)
      if (!data || data.length === 0)
        return filter === 'all'
          ? 'No findings recorded yet.'
          : `No ${filter} findings.`
      return data
        .map(
          (row) =>
            `${row.id} [${row.severity}] ${row.check_name} (${row.source}, ${row.status}, ${row.created_at.slice(0, 10)}) cells:${(row.cell_ids ?? []).length}${row.note ? ` — ${row.note}` : ''}`,
        )
        .join('\n')
    }
    // UI control + navigation: drives the interface, changes no data — no
    // attribution, no ledger entry. Same gestures the human has.
    case 'open_phase':
      return agentOpenPhase(need(args, 'phase_id'))
    case 'open_scenario':
      return agentOpenScenario(need(args, 'scenario_id'))
    case 'focus_cell':
      return agentFocusCell(need(args, 'cell_id'))
    case 'list_ui_commands':
      return listAgentUiCommands()
    case 'ui_command':
      return await runAgentUiCommand(need(args, 'command'), s(args, 'arg'))
    case 'open_cell_panel':
      return agentOpenCellPanel(need(args, 'cell_id'))
    case 'set_canvas_mode': {
      const mode = args.mode === 'design' ? 'design' : 'view'
      setSharedCanvasMode(mode)
      return `Canvas mode is now ${mode}.`
    }
    case 'set_sidebar':
      return agentSetSidebar(args.collapsed === true)
    case 'annotate_cells': {
      const ids = Array.isArray(args.cell_ids)
        ? args.cell_ids.filter((value): value is string => typeof value === 'string')
        : []
      if (ids.length === 0) throw new Error('cell_ids must be a non-empty array.')
      return agentAnnotateCells(ids, s(args, 'note'))
    }
  }

  // Everything below writes.
  setAgentAttribution(agentSessionId)
  try {
    switch (name) {
      case 'add_step': {
        const at = typeof args.at_position === 'number' ? args.at_position : undefined
        const id = await addStep(client, {
          pathId: need(args, 'path_id'),
          name: need(args, 'name'),
          atPosition: at,
        })
        return `Added step (${id}).`
      }
      case 'add_lane': {
        await addLane(client, {
          scenarioId: need(args, 'scenario_id'),
          name: need(args, 'name'),
          layerRole: s(args, 'layer_role') ?? null,
          atRow: typeof args.at_row === 'number' ? args.at_row : undefined,
        })
        return 'Added lane to every path of the scenario. Re-read the blueprint for the new lane ids.'
      }
      case 'upsert_cell': {
        const id = await upsertCell(client, {
          pathId: need(args, 'path_id'),
          layerId: need(args, 'layer_id'),
          stepId: need(args, 'step_id'),
          content: need(args, 'content'),
        })
        return `Created cell (${id}).`
      }
      case 'update_cell_content': {
        const cellId = need(args, 'cell_id')
        const { data, error } = await client
          .from('cells')
          .select('content, description, owner, perceived_owner')
          .eq('id', cellId)
          .maybeSingle()
        if (error) throw new Error(error.message)
        if (!data) throw new Error(`No cell with id ${cellId}.`)
        const previous: CellContentUpdate = {
          content: data.content ?? '',
          description: data.description ?? '',
          owner: data.owner ?? '',
          perceivedOwner: data.perceived_owner ?? '',
        }
        await updateCellContent(
          client,
          cellId,
          {
            content: s(args, 'content') ?? previous.content,
            description: s(args, 'summary') ?? previous.description,
            owner: s(args, 'owner') ?? previous.owner,
            perceivedOwner: s(args, 'perceived_owner') ?? previous.perceivedOwner,
          },
          previous,
        )
        return 'Cell updated.'
      }
      case 'update_cell_spec': {
        const cellId = need(args, 'cell_id')
        const { data, error } = await client
          .from('cells')
          .select('function, form, value_props')
          .eq('id', cellId)
          .maybeSingle()
        if (error) throw new Error(error.message)
        if (!data) throw new Error(`No cell with id ${cellId}.`)
        const prevProps = Array.isArray(data.value_props)
          ? (data.value_props as Array<{ for?: string; value?: string }>).map(
              (entry) => ({ for: entry.for ?? '', value: entry.value ?? '' }),
            )
          : []
        const previous = {
          function: data.function ?? '',
          form: data.form ?? '',
          valueProps: prevProps,
        }
        const nextProps = Array.isArray(args.value_props)
          ? (args.value_props as Array<{ for?: string; value?: string }>).map(
              (entry) => ({ for: entry.for ?? '', value: entry.value ?? '' }),
            )
          : previous.valueProps
        await updateCellSpec(
          client,
          cellId,
          {
            function: s(args, 'function') ?? previous.function,
            form: s(args, 'form') ?? previous.form,
            valueProps: nextProps,
          },
          previous,
        )
        return 'Cell spec updated.'
      }
      case 'set_cell_dependency': {
        const kind = args.kind === 'needs' ? 'needs' : 'trigger'
        const id = await setCellDependency(client, {
          sourceCellId: need(args, 'source_cell_id'),
          targetCellId: need(args, 'target_cell_id'),
          kind,
          label: s(args, 'label') ?? null,
        })
        return `Dependency set (${id}).`
      }
      case 'rename_path': {
        await renamePath(client, {
          pathId: need(args, 'path_id'),
          name: need(args, 'name'),
        })
        return 'Path renamed.'
      }
      case 'create_phase': {
        const id = await createPhase(client, {
          lifecycleId: await lifecycleId(client),
          name: need(args, 'name'),
          description: s(args, 'description') ?? null,
        })
        return `Created phase (${id}).`
      }
      case 'create_scenario': {
        const created = await createScenario(client, {
          phaseId: need(args, 'phase_id'),
          name: need(args, 'name'),
          pathName: s(args, 'path_name'),
          stepCount:
            typeof args.step_count === 'number' ? args.step_count : undefined,
          laneSourcePathId: s(args, 'lane_source_path_id') ?? null,
        })
        return `Created scenario. ${JSON.stringify(created)} — re-read the blueprint for its steps and lanes.`
      }
      case 'create_path': {
        const id = await createPath(client, {
          scenarioId: need(args, 'scenario_id'),
          name: need(args, 'name'),
          pathType: s(args, 'path_type'),
          laneSourcePathId: s(args, 'lane_source_path_id') ?? null,
        })
        return `Created path (${id}).`
      }
      case 'duplicate_path': {
        const id = await duplicatePath(client, {
          sourcePathId: need(args, 'source_path_id'),
          name: need(args, 'name'),
          pathType: s(args, 'path_type'),
          copyCells: args.copy_cells !== false,
        })
        return `Duplicated path (${id}).`
      }
      case 'create_slice': {
        const cellIds = Array.isArray(args.cell_ids)
          ? args.cell_ids.filter(
              (value): value is string => typeof value === 'string',
            )
          : []
        if (cellIds.length === 0)
          throw new Error('cell_ids must be a non-empty array of existing cell ids.')
        const slice = await createSlice(client, {
          lifecycleId: await lifecycleId(client),
          title: need(args, 'title'),
          description: s(args, 'description') ?? '',
          sliceType: need(args, 'slice_type') as SliceType,
          actor: s(args, 'actor') ?? '',
          cellIds,
        })
        return `Created slice "${slice.title}" (${slice.id}) with one frame per cell — replace_slice_frames regroups them.`
      }
      case 'update_slice': {
        const sliceId = need(args, 'slice_id')
        const { data, error } = await client
          .from('slices')
          .select('title, description, slice_type, actor, origin, updated_at')
          .eq('id', sliceId)
          .maybeSingle()
        if (error) throw new Error(error.message)
        if (!data) throw new Error(`No slice with id ${sliceId}.`)
        const outcome = await updateSliceMeta(client, sliceId, asUpdatedAtToken(data.updated_at), {
          title: s(args, 'title') ?? data.title,
          description: s(args, 'description') ?? data.description ?? '',
          sliceType: (s(args, 'slice_type') ?? data.slice_type) as SliceType,
          actor: s(args, 'actor') ?? data.actor ?? '',
          origin: data.origin,
        })
        if (outcome.status === 'conflict')
          throw new Error('The slice changed since you read it — re-read and retry.')
        return 'Slice updated.'
      }
      case 'replace_slice_frames': {
        const sliceId = need(args, 'slice_id')
        const rawFrames = Array.isArray(args.frames) ? args.frames : []
        if (rawFrames.length === 0)
          throw new Error('frames must be a non-empty array.')
        const frames = (rawFrames as Array<Record<string, unknown>>).map(
          (frame) => ({
            cells: Array.isArray(frame.cells)
              ? frame.cells.filter(
                  (value): value is string => typeof value === 'string',
                )
              : [],
            caption: typeof frame.caption === 'string' ? frame.caption : '',
            narrative:
              typeof frame.narrative === 'string' ? frame.narrative : '',
          }),
        )
        await replaceSliceFrames(client, sliceId, frames)
        return `Replaced the slice's frames (${frames.length}).`
      }
      case 'record_finding': {
        const source = args.source === 'whatif' ? 'whatif' : 'audit'
        const checkName = need(args, 'check_name')
        const severityArg = s(args, 'severity')
        if (severityArg !== 'info' && severityArg !== 'warn' && severityArg !== 'critical')
          throw new Error('severity must be info, warn, or critical.')
        const note = need(args, 'note')
        const cellIds = Array.isArray(args.cell_ids)
          ? args.cell_ids.filter(
              (value): value is string => typeof value === 'string',
            )
          : []
        const scope = s(args, 'scope')
        if (cellIds.length === 0 && !scope)
          throw new Error('A zero-cell finding needs a scope (e.g. "scenario:Warm-Up").')
        const runId = s(args, 'run_id') ?? crypto.randomUUID()
        const fingerprint = await findingFingerprint(checkName, cellIds, scope)
        const lifecycle = await lifecycleId(client)
        const { data: existing, error: readError } = await client
          .from('findings')
          .select('id, status')
          .eq('service_lifecycle_id', lifecycle)
          .eq('fingerprint', fingerprint)
          .order('updated_at', { ascending: false })
        if (readError) throw new Error(readError.message)
        const open = existing?.find((row) => row.status === 'open')
        const dismissed = existing?.find((row) => row.status === 'dismissed')
        if (open) {
          const { error } = await client
            .from('findings')
            .update({ severity: severityArg, note, run_id: runId, cell_ids: cellIds, cell_keys: cellIds, source })
            .eq('id', open.id)
          if (error) throw new Error(error.message)
          return `An open finding already had this fingerprint — updated it in place (dedupe). run_id ${runId}; reuse it for the rest of this run.`
        }
        if (dismissed)
          return `A finding with this fingerprint was dismissed by a human — dismissed stays dismissed. Nothing recorded. run_id ${runId}; reuse it for the rest of this run.`
        const { error: insertError } = await client.from('findings').insert({
          service_lifecycle_id: lifecycle,
          run_id: runId,
          source,
          check_name: checkName,
          severity: severityArg,
          note,
          cell_ids: cellIds,
          cell_keys: cellIds,
          fingerprint,
        })
        if (insertError) throw new Error(insertError.message)
        const reopened = existing && existing.length > 0
        return `Recorded ${severityArg} finding for ${checkName}${reopened ? ' (a resolved twin existed — this reopens the issue)' : ''}. run_id ${runId}; reuse it for the rest of this run.`
      }
      case 'set_finding_status': {
        const status = s(args, 'status')
        if (status !== 'open' && status !== 'resolved' && status !== 'dismissed')
          throw new Error('status must be open, resolved, or dismissed.')
        const findingId = need(args, 'finding_id')
        const { data, error } = await client
          .from('findings')
          .update({ status })
          .eq('id', findingId)
          .select('id')
        if (error) throw new Error(error.message)
        if (!data || data.length === 0)
          throw new Error(`No finding with id ${findingId}.`)
        return `Finding is now ${status}.`
      }
      default:
        return `Tool "${name}" is not on the allow-list. Available tools are fixed; deletes do not exist here — removal is human-only.`
    }
  } finally {
    setAgentAttribution(null)
    // The canvas reads through the shared query cache; empty prefix
    // matches every key, so the grids refetch and repaint after a write.
    invalidateQueries('')
  }
}

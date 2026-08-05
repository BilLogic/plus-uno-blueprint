import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  addLane,
  addStep,
  renamePath,
  setCellDependency,
  upsertCell,
} from '@/lib/authoringRpc'
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
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import type { ToolSpec } from '@/lib/agent/providers/provider'
import {
  agentFocusCell,
  agentOpenPhase,
  agentOpenScenario,
  collectAgentUiContext,
} from '@/lib/agent/uiBridge'
import {
  getBlueprint,
  getCell,
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
    name: 'list_owner_tags',
    description:
      'The owner tag vocabulary in use. ALWAYS read before writing owner or perceived_owner — reuse an existing tag unless creating one deliberately.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_ui_state',
    description:
      'What the user is looking at RIGHT NOW: view level, selected phase/scenario, active tab, open cell panel, Design-mode selection. Call after navigating, or whenever "this/here/what I selected" needs grounding.',
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
]

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
    // Navigation: drives the camera, changes no data — no attribution,
    // no ledger entry.
    case 'open_phase':
      return agentOpenPhase(need(args, 'phase_id'))
    case 'open_scenario':
      return agentOpenScenario(need(args, 'scenario_id'))
    case 'focus_cell':
      return agentFocusCell(need(args, 'cell_id'))
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

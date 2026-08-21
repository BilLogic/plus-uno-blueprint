import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  countCompareDifferences,
  deriveCompareStepGroups,
  deriveCompareZones,
  getDetailOnlyCompareSlots,
  isDetailOnlyCompareSlot,
} from '@/lib/compareLedger'
import { buildCompareModel, type CompareBlueprints, type CompareSlot } from '@/lib/compareSlots'
import { normalizeBlueprint, type RawPath } from '@/lib/normalizeBlueprint'
import { PATH_BLUEPRINT_SELECT } from '@/lib/workflowQueries'
import {
  DELETION_NOUNS,
  readDeletionImpact,
  type DeletableKind,
} from '@/lib/deletionSafety'
import type { BlueprintData } from '@/types/blueprint'
import { agentSessionsSnapshot } from '@/lib/agent/sessions'
import { loadPersistedEvents } from '@/lib/agent/persistence'
import { REFERENCE_NAMES } from '@/lib/agent/tools/referenceNames'
import canvasAdapter from '@/lib/agent/skill/references/canvas-adapter.md?raw'
import dataModel from '@/lib/agent/skill/references/data-model.md?raw'
import elicitationProtocol from '@/lib/agent/skill/references/elicitation-protocol.md?raw'
import cocreatePlaybook from '@/lib/agent/skill/references/cocreate-playbook.md?raw'
import laneVocabulary from '@/lib/agent/skill/references/lane-vocabulary.md?raw'
import laneRoles from '@/lib/agent/skill/references/lane-roles.md?raw'
import auditPlaybook from '@/lib/agent/skill/references/audit-playbook.md?raw'
import whatifPlaybook from '@/lib/agent/skill/references/whatif-playbook.md?raw'
import checkGapSweep from '@/lib/agent/skill/references/check-gap-sweep.md?raw'
import checkJargonLint from '@/lib/agent/skill/references/check-jargon-lint.md?raw'
import checkChannelConflict from '@/lib/agent/skill/references/check-channel-conflict.md?raw'
import checkKpiAlignment from '@/lib/agent/skill/references/check-kpi-alignment.md?raw'
import checkPerceivedOwner from '@/lib/agent/skill/references/check-perceived-owner.md?raw'
import checkValueLedger from '@/lib/agent/skill/references/check-value-ledger.md?raw'
import checkFeeVisibility from '@/lib/agent/skill/references/check-fee-visibility.md?raw'
import slicePlaybook from '@/lib/agent/skill/references/slice-playbook.md?raw'
import sliceTemplates from '@/lib/agent/skill/references/slice-templates.md?raw'

type Client = SupabaseClient<Database>

/**
 * Read tools return COMPACT TEXT, not JSON dumps — the model reads them the
 * way a person skims a grid, and ids ride along in parentheses so every
 * later write can name its target precisely.
 */

/**
 * The same reference files the IDE skills read from disk, served as a tool.
 * One progressive-disclosure mechanism, two consumers: editing a file in
 * the plugin repo upgrades both (vendored here by scripts/sync-agent-skill).
 */
const REFERENCES: Record<string, string> = {
  'canvas-adapter': canvasAdapter,
  'lane-roles': laneRoles,
  'lane-vocabulary': laneVocabulary,
  'elicitation-protocol': elicitationProtocol,
  'cocreate-playbook': cocreatePlaybook,
  'data-model': dataModel,
  'audit-playbook': auditPlaybook,
  'whatif-playbook': whatifPlaybook,
  'check-gap-sweep': checkGapSweep,
  'check-jargon-lint': checkJargonLint,
  'check-channel-conflict': checkChannelConflict,
  'check-kpi-alignment': checkKpiAlignment,
  'check-perceived-owner': checkPerceivedOwner,
  'check-value-ledger': checkValueLedger,
  'check-fee-visibility': checkFeeVisibility,
  'slice-playbook': slicePlaybook,
  'slice-templates': sliceTemplates,
}

// The names live in `referenceNames.ts` (a leaf module, so specs.ts can
// quote them without this file's ?raw import graph). This record is the
// documents themselves; the init-time check keeps the two in lockstep.
{
  const here = Object.keys(REFERENCES).sort().join(',')
  const published = [...REFERENCE_NAMES].sort().join(',')
  if (here !== published)
    throw new Error(
      'REFERENCES (read.ts) and REFERENCE_NAMES (referenceNames.ts) drifted — add the reference to both.',
    )
}

export function readReference(name: string): string {
  const doc = REFERENCES[name]
  if (doc) return doc
  return `Unknown reference "${name}". Available: ${REFERENCE_NAMES.join(', ')}`
}

export { REFERENCE_NAMES }

export const GRANULARITY_LEVELS = [
  'phase',
  'scenario',
  'path',
  'step',
  'lane',
  'cell',
] as const

/**
 * The COMPLETE set at one or more rungs of the journey walk, straight off
 * `public.search_blueprint` in its filter-only mode — the same portal
 * uno-bot and any CLI reader call, so relevance and scoping are the
 * database's job once rather than each consumer's job separately.
 *
 * This is what `list_scenarios` was: granularity ['phase','scenario'] with
 * no filters. It is also what uno-bot's fetchBlueprintIndex was, one rung
 * deeper. Neither could say which rung it wanted, so both hand-rolled the
 * walk.
 *
 * `list_`, not `search_`: no query, no ranking, no truncation past the
 * caller's own limit — and `total` is reported so a clipped list says so.
 */
export async function listBlueprint(
  client: Client,
  options: {
    granularity: string[]
    phase?: string
    scenario?: string
    pathType?: string
    laneRole?: string
    limit?: number
  },
): Promise<string> {
  const bad = options.granularity.filter(
    (level) => !GRANULARITY_LEVELS.includes(level as never),
  )
  if (bad.length > 0) {
    throw new Error(
      `Unknown granularity: ${bad.join(', ')}. Use one or more of ${GRANULARITY_LEVELS.join(', ')}.`,
    )
  }
  const limit = Math.min(options.limit ?? 200, 500)
  const { data, error } = await client.rpc('search_blueprint', {
    granularity: options.granularity,
    match_count: limit,
    filter_phase: options.phase,
    filter_scenario: options.scenario,
    filter_path_type: options.pathType,
    filter_lane_role: options.laneRole,
  })
  if (error) throw new Error(error.message)
  return renderPortalRows(
    data ?? [],
    'Nothing at that granularity within those filters.',
    false,
  )
}

/** A row as `public.search_blueprint` returns it. */
type PortalRow = {
  kind: string
  id: string
  snippet: string | null
  description: string | null
  lane: string | null
  step: string | null
  scenario: string | null
  phase: string | null
  path: string | null
  matched_by: string | null
  total_matched: number | null
}

/**
 * One rendering for both portal doors, so a phase row reads the same
 * whether it arrived by enumeration or by ranking, and ids always ride
 * along for the write that follows.
 *
 * The header carries the honesty number either way: `list_` says when it
 * clipped, `search_` says how many matched corpus-wide so a top-k answer
 * cannot be mistaken for the whole set.
 */
function renderPortalRows(
  rows: PortalRow[],
  emptyMessage: string,
  ranked: boolean,
): string {
  if (rows.length === 0) return emptyMessage
  const total = Number(rows[0].total_matched ?? rows.length)
  const header = ranked
    ? `${rows.length} shown of ${total} matching:`
    : rows.length < total
      ? `${rows.length} of ${total} (clipped — raise limit or narrow the filters):`
      : `${total} of ${total}:`

  const lines = rows.map((row) => {
    const where = [row.phase, row.scenario, row.path, row.step, row.lane]
      .filter(Boolean)
      .join(' › ')
    // A structural row IS its breadcrumb, so the name is not repeated; a
    // cell is identified by its content, first line only.
    const body =
      row.kind === 'cell'
        ? `"${(row.snippet ?? '').split('\n')[0]}"`
        : `"${row.snippet}"`
    const detail = row.description ? ` — ${row.description}` : ''
    const how = ranked && row.matched_by ? `  [${row.matched_by}]` : ''
    return `[${row.kind}] ${body} · ${where}${detail} (${row.id})${how}`
  })
  return [header, ...lines].join('\n')
}

/**
 * RANKED retrieval over the same portal — for when you have WORDS but not
 * a name or an id.
 *
 * The canvas agent runs in the browser on the user's chat key and cannot
 * embed a query (`providers/models.ts` filters embedding models out), so
 * this reaches the portal's keyword and structural arms only, never the
 * vector one. That is a real capability difference from uno-bot and it is
 * why the tool description says, in as many words, that zero rows means
 * "no row uses these words" and NEVER "the blueprint does not cover this".
 * `matched_by` is surfaced per row so the model can see which arm fired.
 */
export async function searchBlueprint(
  client: Client,
  options: {
    query: string
    granularity?: string[]
    phase?: string
    scenario?: string
    pathType?: string
    laneRole?: string
    limit?: number
  },
): Promise<string> {
  const { data, error } = await client.rpc('search_blueprint', {
    q: options.query,
    granularity: options.granularity ?? ['cell'],
    match_count: Math.min(options.limit ?? 15, 100),
    filter_phase: options.phase,
    filter_scenario: options.scenario,
    filter_path_type: options.pathType,
    filter_lane_role: options.laneRole,
  })
  if (error) throw new Error(error.message)
  return renderPortalRows(
    data ?? [],
    `Nothing matches the words "${options.query}". That means no row USES those words — it does not mean the blueprint has no such moment. Try the board's own vocabulary, or list_blueprint to see what exists.`,
    true,
  )
}

/**
 * The reference list was an interpolated enumeration inside get_reference's
 * DESCRIPTION string — static prose that had to be rewritten by hand every
 * time a reference landed. Same reason list_ui_commands exists: a live list
 * beats a hardcoded one that drifts.
 */
export function listReferences(): string {
  return REFERENCE_NAMES.map((name) => `- ${name}`).join('\n')
}

/**
 * The lane vocabulary ACTUALLY in use, distinct from the lane-roles
 * reference doc, which says what the roles mean rather than which ones this
 * blueprint uses. Reuse a label before minting one — same discipline
 * list_owner_tags enforces for owner tags.
 */
export async function listLanes(client: Client): Promise<string> {
  const { data, error } = await client
    .from('lanes')
    .select('name, lane_role')
    .order('position')
  if (error) throw new Error(error.message)
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const key = JSON.stringify([row.name, row.lane_role ?? null])
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  if (counts.size === 0) return 'No lanes defined yet.'
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => {
      const [name, role] = JSON.parse(key) as [string, string | null]
      return `${name}${role ? ` (role ${role})` : ''} — ${count} lane${count === 1 ? '' : 's'}`
    })
    .join('\n')
}

/**
 * The service's cast list.
 *
 * The registry is the answer to "who is this lane for?" and "who receives
 * this value?" — one list, with the other spellings each name has been
 * written as. Read it before inventing an audience: `tutor` and `Regular
 * Tutor` are one person, and the aliases column is where that is recorded.
 */
export async function listStakeholders(client: Client): Promise<string> {
  const { data, error } = await client
    .from('stakeholders')
    .select('id, name, kind, note, aliases')
    .order('kind')
    .order('name')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return 'No stakeholders registered yet.'
  return data
    .map((row) => {
      const aliases = (row.aliases ?? []).length
        ? ` — also written ${(row.aliases ?? []).join(', ')}`
        : ''
      return `${row.name} (${row.kind}) [${row.id}]${aliases}${row.note ? ` — ${row.note}` : ''}`
    })
    .join('\n')
}

/**
 * The arrows, readable on their own. `create_cell_dependency` could write an edge
 * the agent had no way to read back; this is the missing half of that pair.
 * Scope to one cell when you have one — the whole graph is large.
 */
export async function listCellDependencies(
  client: Client,
  cellId?: string,
): Promise<string> {
  let query = client
    .from('cell_dependencies')
    .select('id, source_cell_id, target_cell_id, kind, label, note')
    .limit(200)
  if (cellId) {
    query = query.or(`source_cell_id.eq.${cellId},target_cell_id.eq.${cellId}`)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    return cellId ? `No links on cell ${cellId}.` : 'No links recorded yet.'
  }
  const lines = data.map((edge) => {
    const label = edge.label ? ` "${edge.label}"` : ''
    const note = edge.note ? ` — ${edge.note}` : ''
    return `${edge.source_cell_id} --${edge.kind ?? 'leads_to'}--> ${edge.target_cell_id}${label}${note} (${edge.id})`
  })
  const header = cellId
    ? `${data.length} link(s) touching ${cellId}:`
    : `${data.length} link(s)${data.length === 200 ? ' (capped at 200)' : ''}:`
  return [header, ...lines].join('\n')
}

const EVIDENCE_SELECT =
  'id, cell_id, kind, title, ref, excerpt, note, observed_at, created_at'

/** One evidence row as a line — the shape both evidence readers render. */
function evidenceLine(row: {
  id: string
  cell_id: string | null
  kind: string
  title: string
  ref: string | null
  observed_at: string | null
}): string {
  const ref = row.ref ? ` ref=${row.ref}` : ''
  const seen = row.observed_at ? ` observed=${row.observed_at.slice(0, 10)}` : ''
  const cell = row.cell_id ? ` cell=${row.cell_id}` : ''
  return `[${row.kind}] "${row.title}"${ref}${seen}${cell} (${row.id})`
}

/**
 * Evidence the blueprint's claims rest on. The UI has had this since
 * 2026-08-06 (`useEvidence`, `evidenceMutations`); the agent had no tool at
 * all, so it could neither cite a source nor notice a claim standing on none.
 */
export async function listEvidence(
  client: Client,
  cellId?: string,
): Promise<string> {
  let query = client
    .from('evidence')
    .select(EVIDENCE_SELECT)
    .order('created_at', { ascending: false })
    .limit(100)
  if (cellId) query = query.eq('cell_id', cellId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    return cellId
      ? `No evidence attached to cell ${cellId}.`
      : 'No evidence recorded yet.'
  }
  return [
    `${data.length} evidence row(s)${data.length === 100 ? ' (capped at 100)' : ''}:`,
    ...data.map(evidenceLine),
  ].join('\n')
}

/** Named evidence rows in full — excerpt and note included. */
export async function getEvidence(
  client: Client,
  ids: string[],
): Promise<string> {
  if (ids.length === 0) return 'Pass at least one evidence id.'
  const { data, error } = await client
    .from('evidence')
    .select(EVIDENCE_SELECT)
    .in('id', ids)
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return 'No evidence with those ids.'
  const sections = data.map((row) => {
    const lines = [evidenceLine(row)]
    if (row.excerpt) lines.push(`  excerpt: ${row.excerpt}`)
    if (row.note) lines.push(`  note: ${row.note}`)
    return lines.join('\n')
  })
  const missing = ids.filter((id) => !data.some((row) => row.id === id))
  if (missing.length > 0) {
    sections.push(`(no evidence with id: ${missing.join(', ')})`)
  }
  return sections.join('\n')
}

/**
 * Past conversations on this blueprint. Sourced from the session store the
 * switcher reads, never from `agent_sessions` — see `agentSessionsSnapshot`
 * for why that distinction is load-bearing.
 *
 * No `search_sessions` companion: the complete list is small enough to
 * return whole, and search exists for when complete is too big.
 */
export function listSessions(currentSessionId: string): string {
  const sessions = agentSessionsSnapshot()
  if (sessions.length === 0) return 'No past sessions.'
  return [...sessions]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((session) => {
      const mine = session.id === currentSessionId ? ' (this session)' : ''
      const edits =
        session.changeCount > 0 ? `, ${session.changeCount} edit(s)` : ''
      return `"${session.title}"${mine} — updated ${session.updatedAt.slice(0, 10)}${edits} (${session.id})`
    })
    .join('\n')
}

/** One past conversation's transcript, oldest turn first. */
export async function getSession(sessionId: string): Promise<string> {
  const known = agentSessionsSnapshot().find((s) => s.id === sessionId)
  const events = await loadPersistedEvents(sessionId)
  if (events === null) {
    return known
      ? `Session "${known.title}" is in the local list but its transcript is not persisted (persistence attaches only when signed in).`
      : `No session with id ${sessionId}.`
  }
  if (events.length === 0) return 'That session has no recorded turns.'
  const lines = events.map((event) => {
    if (event.kind === 'user') return `user: ${event.text}`
    if (event.kind === 'assistant') return `assistant: ${event.text}`
    if (event.kind === 'tool')
      return `tool ${event.name}${event.isError ? ' (error)' : ''}: ${event.summary}`
    return `${event.kind}:`
  })
  const header = known ? `Session "${known.title}" (${sessionId}):` : `Session ${sessionId}:`
  return [header, ...lines].join('\n')
}

/**
 * The service's business model — one row per lifecycle, so there is nothing
 * to list and no id to pass.
 */
export async function getProposition(client: Client): Promise<string> {
  const { data, error } = await client
    .from('business_model')
    .select('pricing, funding, partners, revenue_model, delivery_cost')
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return 'No proposition recorded for this service yet.'
  const fields: Array<[string, unknown]> = [
    ['pricing', data.pricing],
    ['revenue_model', data.revenue_model],
    ['funding', data.funding],
    ['partners', data.partners],
    ['delivery_cost', data.delivery_cost],
  ]
  const filled = fields.filter(([, value]) => value !== null && value !== '')
  if (filled.length === 0) return 'The proposition row exists but is empty.'
  return filled.map(([key, value]) => `${key}: ${String(value)}`).join('\n')
}


export async function getBlueprint(
  client: Client,
  scenarioId: string,
): Promise<string> {
  const { data, error } = await client
    .from('paths')
    .select(PATH_BLUEPRINT_SELECT)
    .eq('scenario_id', scenarioId)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as RawPath[]
  if (rows.length === 0) return 'No paths in this scenario.'

  const sections: string[] = []
  for (const raw of rows) {
    const blueprint = normalizeBlueprint(raw)
    const { path, steps, lanes, cells, dependencies } = blueprint
    const lines: string[] = [
      `Path "${path.name}" (${path.id}, type ${path.path_type})`,
      `Steps: ${steps
        .map((step) => `${step.position}. "${step.name}" (${step.id})`)
        .join(' | ')}`,
    ]
    for (const lane of lanes) {
      lines.push(
        `Lane "${lane.name}" (${lane.id}${lane.role ? `, role ${lane.role}` : ''}):`,
      )
      const byStep = new Map<string, typeof cells>()
      for (const cell of cells) {
        if (cell.lane_id !== lane.id) continue
        const list = byStep.get(cell.step_id) ?? []
        list.push(cell)
        byStep.set(cell.step_id, list)
      }
      for (const step of steps) {
        for (const cell of byStep.get(step.id) ?? []) {
          lines.push(
            `  [step ${step.position}] "${cell.content}" (${cell.id})`,
          )
        }
      }
    }
    // The arrows. `PATH_BLUEPRINT_SELECT` has always joined `cell_dependencies`
    // and this renderer used to drop them on the floor — the agent could
    // WRITE an edge (create_cell_dependency) and never read one back, and the
    // relationships the user sees on the canvas were invisible to it. The
    // join was already paid for; only the rendering was missing.
    if (dependencies.length > 0) {
      lines.push(`Edges (${dependencies.length}):`)
      for (const edge of dependencies) {
        const label = edge.label ? ` "${edge.label}"` : ''
        lines.push(
          `  ${edge.source_cell_id} --${edge.kind ?? 'leads_to'}--> ${edge.target_cell_id}${label}`,
        )
      }
    }
    sections.push(lines.join('\n'))
  }
  return sections.join('\n\n')
}

function compareSlotLine(
  slot: CompareSlot,
  blueprints: readonly BlueprintData[],
): string {
  const fields =
    slot.differingFields.length > 0
      ? ` (fields: ${slot.differingFields.join(', ')})`
      : ''
  const perPath = blueprints
    .map((blueprint) => {
      const entry = slot.perPath[blueprint.path.id]
      if (!entry?.present) return `${blueprint.path.name}: —`
      const quoted = entry.contents.map((content) => `"${content}"`).join(' + ')
      return `${blueprint.path.name}: ${quoted} (${entry.cellIds.join(', ')})`
    })
    .join(' | ')
  return `  [${slot.verdict}] lane "${slot.laneLabel}" @ step "${slot.columnLabel}"${fields}: ${perPath}`
}

/**
 * Headless compare: fetches the scenario's blueprints through the same
 * query the panel uses, runs `buildCompareModel`, and serializes slots /
 * step groups / columns as compact text. This grounds every other compare
 * argument the agent can pass — step numbers for jump_divergence, lane and
 * step names for differences_filter, cell ids for focus/annotate.
 */
export async function getCompareDiff(
  client: Client,
  scenarioId: string,
  pathIds?: string[],
): Promise<string> {
  const { data, error } = await client
    .from('paths')
    .select(PATH_BLUEPRINT_SELECT)
    .eq('scenario_id', scenarioId)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as RawPath[]
  if (rows.length === 0) return 'No paths in this scenario.'

  let blueprints = rows.map((raw) => normalizeBlueprint(raw))
  if (pathIds && pathIds.length > 0) {
    const wanted = blueprints.filter((blueprint) =>
      pathIds.includes(blueprint.path.id),
    )
    // Keep the caller's order — column insertion follows the first path.
    blueprints = pathIds
      .map((id) => wanted.find((blueprint) => blueprint.path.id === id))
      .filter((blueprint): blueprint is BlueprintData => Boolean(blueprint))
  }
  if (blueprints.length < 2)
    return `Comparison needs at least two paths; this scenario ${
      pathIds && pathIds.length > 0 ? 'selection' : ''
    } resolves to ${blueprints.length}. Path ids here: ${rows
      .map((raw) => (raw as { id?: string }).id)
      .join(', ')}.`

  const model = buildCompareModel(blueprints as CompareBlueprints)
  const zones = deriveCompareZones(model)
  const stepGroups = deriveCompareStepGroups(model)
  const detailOnly = getDetailOnlyCompareSlots(model)

  const lines: string[] = [
    `Comparing ${blueprints
      .map((blueprint) => `"${blueprint.path.name}" (${blueprint.path.id})`)
      .join(' vs ')}`,
    `Canonical columns: ${model.columns
      .map((column, index) => `${index + 1}."${column.label}" ${column.verdict}`)
      .join(' | ')}`,
    `${countCompareDifferences(model)} differences · ${zones.length} zones · ${detailOnly.length} detail-only`,
  ]
  // Grouped by STEP — the ledger's grain and jump_divergence's argument;
  // each group names the divergence zone (run) it sits in, which is the
  // grain used to group related divergent steps.
  for (const group of stepGroups) {
    lines.push(
      `${group.headerLabel} (zone ${group.zoneIndex}, ${group.slots.length} difference${
        group.slots.length === 1 ? '' : 's'
      }):`,
    )
    for (const slot of group.slots) lines.push(compareSlotLine(slot, blueprints))
  }
  if (detailOnly.length > 0) {
    lines.push(`Detail-only differences (${detailOnly.length}) — no canvas step:`)
    for (const slot of detailOnly) lines.push(compareSlotLine(slot, blueprints))
  }
  const shared = model.slots.filter(
    (slot) => slot.verdict === 'shared' && !isDetailOnlyCompareSlot(slot),
  ).length
  lines.push(
    `${shared} shared slots. Note: dependencies/needs edges are not compared.`,
  )
  return lines.join('\n')
}

export async function getCell(client: Client, cellId: string): Promise<string> {
  const { data, error } = await client
    .from('cells')
    .select(
      'id, content, summary, owner, perceived_owner, function, form, value_props, links, lane_id, step_id, position',
    )
    .eq('id', cellId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return `No cell with id ${cellId}.`
  const fields: Array<[string, unknown]> = [
    ['content', data.content],
    ['summary', data.summary],
    ['owner', data.owner],
    ['perceived_owner', data.perceived_owner],
    ['function', data.function],
    ['form', data.form],
    ['value_props', data.value_props ? JSON.stringify(data.value_props) : null],
    // search_blueprint returns `links`; this did not, so the two tools
    // disagreed about what a cell is.
    ['links', data.links ? JSON.stringify(data.links) : null],
    ['lane_id', data.lane_id],
    ['step_id', data.step_id],
    ['position', data.position],
  ]
  return fields
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n')
}

export async function listSlices(client: Client): Promise<string> {
  const { data, error } = await client
    .from('slices')
    .select('id, title, slice_type')
    .order('slice_type')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return 'No slices yet.'
  return data
    .map((slice) => `"${slice.title}" (${slice.id}, type ${slice.slice_type})`)
    .join('\n')
}

/** The tag vocabulary — read this before writing any owner value. */
export async function listOwnerTags(client: Client): Promise<string> {
  const { data, error } = await client
    .from('cells')
    .select('owner, perceived_owner')
    .or('owner.not.is.null,perceived_owner.not.is.null')
  if (error) throw new Error(error.message)
  const tags = new Set<string>()
  for (const row of data ?? []) {
    if (row.owner) tags.add(row.owner)
    if (row.perceived_owner) tags.add(row.perceived_owner)
  }
  if (tags.size === 0) return 'No owner tags in use yet.'
  return [...tags].sort().join(', ')
}

/**
 * What a delete would cost, in the words the confirm dialog uses.
 *
 * The agent cannot delete anything — no delete is on the allow-list, by
 * design — but it was also unable to SAY what a delete would cost, which made
 * "what happens if I remove this path?" a question it had to decline or guess
 * at. The impact RPCs are side-effect-free reads (that is what this branch
 * proves), so answering is free.
 *
 * `readDeletionImpact` is the very function `DeleteStructureDialog` calls, and
 * the facts/warnings/reassurances are rendered VERBATIM. Deliberately not
 * paraphrased: the warning about slices undo cannot restore, and the qualified
 * archive reassurance beside it, were written word by word to not overstate
 * what comes back. An agent rewording them in its own voice is exactly how the
 * "nothing is destroyed" over-promise gets reintroduced on a second surface.
 */
export async function getDeletionImpact(
  client: Client,
  kind: DeletableKind,
  targetId: string,
  scopeId?: string,
): Promise<string> {
  const summary = await readDeletionImpact(client, kind, targetId, scopeId)
  const lines = [
    `Deleting this ${DELETION_NOUNS[kind]} would destroy:`,
    ...summary.facts.map(
      (fact) => `  ${fact.count} ${fact.noun}${fact.count === 1 ? '' : 's'}`,
    ),
  ]
  // Verbatim, one per line, under headings that say which kind of sentence
  // each is — a warning read as a reassurance is the failure mode here.
  if (summary.warnings.length > 0) {
    lines.push('Warnings:', ...summary.warnings.map((line) => `  ${line}`))
  }
  if (summary.reassurances.length > 0) {
    lines.push('What survives:', ...summary.reassurances.map((line) => `  ${line}`))
  }
  lines.push(
    'Relay these sentences as they are. You cannot perform this delete — only the human can, in the desktop app\'s confirm dialog, by typing the name.',
  )
  return lines.join('\n')
}

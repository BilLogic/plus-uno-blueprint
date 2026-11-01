import { isDeepStrictEqual } from 'node:util'

/** Owner-approved deletes: each RPC archives what it destroys into the trash. */
export const DELETIONS = new Set(['delete_cell', 'remove_step', 'remove_lane'])
export const CAPABILITIES = new Set(['update_cell_status', 'rename_step', 'move_cell', 'insert_cell_at_position', ...DELETIONS])
export const COORDINATES = ['path_id', 'lane_id', 'step_id', 'position']
export const coordinates = (row) => Object.fromEntries(COORDINATES.map((key) => [key, row[key]]))
// The database regenerates these columns on every write, so a projected row
// cannot predict them; the approved fields are still compared exactly.
const GENERATED = new Set(['updated_at', 'search_tsv'])
export const stableRow = (row) => structuredClone(Object.fromEntries(Object.entries(row).filter(([key]) => !GENERATED.has(key))))

export function matchesScope(row, target) {
  return (!target.id || target.id === row.id) && (!target.cell_key || target.cell_key === row.cell_key)
    && Object.entries(target.where ?? {}).every(([key, value]) => isDeepStrictEqual(row[key], value))
}

// A path_steps membership has no id of its own; its identity is the pair.
const identity = (row) => row.id ?? `${row.path_id}:${row.step_id}`

/**
 * Advance captured postconditions only through a successfully read-back
 * write. A null `after` is a delete; removing a membership renumbers what is
 * left on its path contiguously, as remove_step does.
 */
export function projectChecks(checks, table, before, after) {
  for (const check of checks) {
    if (check.target.table !== table) continue
    const index = check.rows.findIndex((row) => identity(row) === identity(before ?? after))
    if (before && index !== -1) check.rows.splice(index, 1)
    if (after && matchesScope(after, check.target)) check.rows.push(stableRow(after))
    if (!after && table === 'path_steps' && index !== -1) {
      check.rows.filter((row) => row.path_id === before.path_id).sort((a, b) => a.position - b.position)
        .forEach((row, position) => { row.position = position })
    }
  }
}

export async function verifyChecks(read, checks) {
  const failures = []
  for (const check of checks) {
    const rows = await read(check.target)
    if (rows.length !== check.rows.length) failures.push(`preservation ${JSON.stringify(check.target)}: expected ${check.rows.length} rows, found ${rows.length}`)
    const remaining = [...rows]
    for (const expected of check.rows) {
      const index = remaining.findIndex((row) => Object.entries(expected).every(([key, value]) => isDeepStrictEqual(row[key], value)))
      if (index === -1) failures.push(`preservation ${JSON.stringify(check.target)}: missing or changed ${JSON.stringify(expected)}`)
      else remaining.splice(index, 1)
    }
  }
  return failures
}

/**
 * What a delete may destroy, captured and guarded. `removes.guarded` must be
 * identical at apply; `cascades` are the captures the RPC empties.
 */
async function prepareDeletion(read, op, before) {
  const checks = []
  const cascades = []
  async function capture(target, { cascade = false } = {}) {
    const rows = await read(target)
    checks.push({ target, rows: structuredClone(rows) })
    if (cascade) cascades.push(target)
    return rows
  }
  if (op.operation === 'delete_cell') {
    await capture({ table: 'cells', where: { path_id: before.path_id } })
    const outgoing = await capture({ table: 'cell_dependencies', where: { source_cell_id: before.id } }, { cascade: true })
    const incoming = await capture({ table: 'cell_dependencies', where: { target_cell_id: before.id } }, { cascade: true })
    const placements = await capture({ table: 'cell_touchpoints', where: { cell_id: before.id } }, { cascade: true })
    const resources = await capture({ table: 'resources', where: { cell_id: before.id } }, { cascade: true })
    // evidence has no foreign key to cells: its rows stay, keyed to the gone cell.
    const evidence = await capture({ table: 'evidence', where: { cell_id: before.id } })
    const removes = {
      dependencies: [...outgoing, ...incoming].map((row) => row.id).sort(),
      placements: placements.map((row) => row.id).sort(),
      resources: resources.map((row) => row.id).sort(),
      evidence_kept: evidence.map((row) => row.id).sort(),
    }
    return { checks, cascades, removes: { ...removes, guarded: removes } }
  }
  if (op.operation === 'remove_step') {
    const links = await capture({ table: 'path_steps', where: { step_id: before.step_id } })
    const ordered = (rows) => rows.map(({ path_id, position }) => ({ path_id, position })).sort((a, b) => a.path_id.localeCompare(b.path_id) || a.position - b.position)
    if (!isDeepStrictEqual(ordered(links), ordered(op.input.expected_path_steps))) throw new Error('Step memberships differ from the reviewed expected paths')
    if (!links.some((link) => link.path_id !== before.path_id)) throw new Error('The step has no other path; removing its last membership would delete the step')
    const column = await read({ table: 'cells', where: { path_id: before.path_id, step_id: before.step_id } })
    const cleared = new Set(op.input.cells_deleted_earlier ?? [])
    if (column.some((row) => !cleared.has(row.id))) throw new Error('The column on this path holds a cell this batch does not delete')
    await capture({ table: 'path_steps', where: { path_id: before.path_id } })
    await capture({ table: 'steps', id: before.step_id })
    await capture({ table: 'cells', where: { path_id: before.path_id } })
    await capture({ table: 'cells', where: { step_id: before.step_id } })
    const kept = ordered(links).filter((link) => link.path_id !== before.path_id)
    return { checks, cascades, removes: { membership: { path_id: before.path_id, position: before.position }, step_kept_on: kept, column_cells: column.length, guarded: { kept } } }
  }
  // remove_lane: one lane by id. The name-based RPC would take every
  // same-named lane in the scenario, so those are captured and must stay.
  const occupants = await read({ table: 'cells', where: { lane_id: before.id } })
  if (occupants.length) throw new Error(`The lane holds ${occupants.length} cell(s); only an empty lane is removed`)
  const [path] = await read({ table: 'paths', id: before.path_id })
  if (!path) throw new Error('The lane\'s path no longer exists')
  await capture({ table: 'lanes', where: { path_id: before.path_id } })
  const kept = []
  for (const sibling of await read({ table: 'paths', where: { scenario_id: path.scenario_id } })) {
    for (const lane of await capture({ table: 'lanes', where: { path_id: sibling.id, name: before.name } })) {
      if (lane.id === before.id) continue
      const cells = await capture({ table: 'cells', where: { lane_id: lane.id } })
      kept.push({ id: lane.id, path_id: lane.path_id, cells: cells.length })
    }
  }
  kept.sort((a, b) => a.id.localeCompare(b.id))
  return { checks, cascades, removes: { lane: before.name, cells: 0, same_name_lanes_kept: kept, guarded: { kept } } }
}

export async function prepareCapability(read, op, before) {
  if (!CAPABILITIES.has(op.operation)) return null
  if (DELETIONS.has(op.operation)) return prepareDeletion(read, op, before)
  const checks = []
  async function capture(target) {
    const rows = await read(target)
    checks.push({ target, rows: structuredClone(rows) })
    return rows
  }
  let cells = before ? [before] : []
  let affectedPaths
  async function one(table, rowId) {
    const rows = await read({ table, id: rowId })
    if (rows.length !== 1) throw new Error(`Expected one ${table} parent ${rowId}`)
    return rows[0]
  }
  if (op.operation !== 'update_cell_status') {
    let scenarioId = before?.scenario_id
    if (op.operation === 'rename_step') {
      if (!before.name?.trim() || before.name === op.value.name) throw new Error('Rename requires a restorable prior name and a changed name')
      const links = await read({ table: 'path_steps', where: { step_id: before.id } })
      const ordered = (rows) => rows.map(({ path_id, position }) => ({ path_id, position })).sort((a, b) => a.path_id.localeCompare(b.path_id) || a.position - b.position)
      if (!isDeepStrictEqual(ordered(links), ordered(op.input.expected_path_steps))) throw new Error('Shared step memberships differ from the reviewed expected paths')
    } else {
      const destination = coordinates(op.operation === 'move_cell' ? op.value : op.target.where)
      if (!Number.isSafeInteger(destination.position) || destination.position < 0) throw new Error('Destination requires a nonnegative integer position')
      const path = await one('paths', destination.path_id)
      const sourcePath = before ? await one('paths', before.path_id) : path
      if (before) {
        const sourceLane = await one('lanes', before.lane_id)
        const sourceStep = await one('steps', before.step_id)
        const sourceMembership = await read({ table: 'path_steps', where: { path_id: before.path_id, step_id: before.step_id } })
        if (sourceLane.path_id !== sourcePath.id || sourceStep.scenario_id !== sourcePath.scenario_id || sourceMembership.length !== 1)
          throw new Error('Source parents or membership no longer match the cell')
      }
      const lane = await one('lanes', destination.lane_id)
      const step = await one('steps', destination.step_id)
      if (sourcePath.scenario_id !== path.scenario_id || lane.path_id !== path.id || step.scenario_id !== path.scenario_id)
        throw new Error('Move parents must belong to the same scenario and destination path')
      const membership = await read({ table: 'path_steps', where: { path_id: path.id, step_id: step.id } })
      if (membership.length !== 1) throw new Error('Destination path must already carry the step')
      if ((await read({ table: 'cells', where: destination })).length) throw new Error('Destination slot is occupied')
      for (const field of before ? ['source_cell_id', 'target_cell_id'] : []) {
        for (const edge of await read({ table: 'cell_dependencies', where: { [field]: before.id } })) {
          const other = await one('cells', edge[field === 'source_cell_id' ? 'target_cell_id' : 'source_cell_id'])
          if (other.id !== before.id && other.path_id !== path.id) throw new Error('Move would violate an incident dependency; resolve separately')
        }
      }
      scenarioId = sourcePath.scenario_id
      if (!before && (!op.value.content?.trim() || !op.value.status)) throw new Error('Insertion requires content and explicit status')
    }
    const paths = await capture({ table: 'paths', where: { scenario_id: scenarioId } })
    if (op.operation === 'rename_step' && op.input.expected_path_steps.some((link) => !paths.some((path) => path.id === link.path_id)))
      throw new Error('Shared step membership is outside its scenario')
    await capture({ table: 'steps', where: { scenario_id: scenarioId } })
    cells = []
    const memberships = []
    for (const path of paths) {
      await capture({ table: 'lanes', where: { path_id: path.id } })
      memberships.push(...await capture({ table: 'path_steps', where: { path_id: path.id } }))
      cells.push(...await capture({ table: 'cells', where: { path_id: path.id } }))
    }
    affectedPaths = op.operation === 'rename_step'
      ? memberships.filter((link) => link.step_id === before.id).map((link) => ({
        path_id: link.path_id, position: link.position, name: paths.find((path) => path.id === link.path_id)?.name ?? null,
      }))
      : paths.filter((path) => [before?.path_id, op.value.path_id ?? op.target.where?.path_id].includes(path.id)).map((path) => ({ path_id: path.id, name: path.name ?? null }))
    affectedPaths.sort((a, b) => a.path_id.localeCompare(b.path_id))
  } else {
    if (before.status === op.value.status) throw new Error('The status changeset would write no change')
    await capture({ table: 'cells', id: before.id })
  }
  // Whole-scenario cell rows catch identity/count/content drift. Relationship
  // reads are scoped to affected cells and the destination square, rather
  // than doing five extra requests for every unrelated cell in the scenario.
  const destination = op.operation === 'insert_cell_at_position' ? op.target.where : op.value
  const related = cells.filter((row) => op.operation === 'rename_step'
    ? row.step_id === before.id
    : row.id === before?.id || ['path_id', 'lane_id', 'step_id'].every((field) => destination[field] !== undefined && row[field] === destination[field]))
  for (const row of related) {
    for (const table of ['evidence', 'cell_touchpoints', 'resources']) await capture({ table, where: { cell_id: row.id } })
    for (const field of ['source_cell_id', 'target_cell_id']) await capture({ table: 'cell_dependencies', where: { [field]: row.id } })
  }
  return { checks, ...(affectedPaths ? { affectedPaths } : {}) }
}

/** Expected durable payloads come from approved input/pre-state, never wire JSON. */
export function expectedChange(op, before, result) {
  if (op.operation === 'update_cell_status') return {
    fn: op.operation, args: { cell_id: before.id, status: op.value.status, expected_status: before.status },
    revert: { fn: op.operation, args: { cell_id: before.id, status: before.status, expected_status: op.value.status } },
  }
  if (op.operation === 'rename_step') return {
    fn: op.operation, args: { step_id: before.id, expected_name: before.name, new_name: op.value.name },
    revert: { fn: op.operation, args: { step_id: before.id, expected_name: op.value.name, new_name: before.name } },
  }
  if (op.operation === 'move_cell') return {
    fn: op.operation, args: { cell_id: before.id, expected_source: coordinates(before), destination: coordinates(op.value) },
    revert: { fn: op.operation, args: { cell_id: before.id, expected_source: coordinates(op.value), destination: coordinates(before) } },
  }
  if (op.operation === 'insert_cell_at_position') return {
    fn: op.operation, args: { ...coordinates(op.target.where), ...op.value, cell_id: result.id },
    revert: { fn: 'delete_cell', args: { cell_id: result.id } },
  }
  // A delete's record is the trash row the RPC archives in its own
  // transaction: no args and no executable inverse. Recovery is from trash.
  const recovery = 'restore from trash: this authoring_changes row\'s payload holds the deleted rows; no restore RPC exists, so recovery is a reviewed manual re-insert'
  if (op.operation === 'delete_cell') return {
    archived: true, fn: 'delete_cell', deleted_kind: 'cell', args: {}, revert: null, recovery,
    payload: Object.fromEntries(['id', 'path_id', 'lane_id', 'step_id', 'position', 'status', 'content'].map((field) => [`cell.${field}`, before[field]])),
  }
  if (op.operation === 'remove_step') return {
    archived: true, fn: 'remove_step', deleted_kind: 'step', args: {}, revert: null, recovery,
    payload: { 'step.id': before.step_id, path_id: before.path_id, cells: [] },
  }
  if (op.operation === 'remove_lane') return {
    archived: true, fn: 'remove_lanes', deleted_kind: 'lane', args: {}, revert: null, recovery,
    payload: { lane_ids: [before.id], lane_name: before.name, cells: [] },
  }
  throw new Error(`No inverse contract for ${op.operation}: ${result?.id ?? ''}`)
}

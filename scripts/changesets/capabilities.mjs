import { isDeepStrictEqual } from 'node:util'

export const CAPABILITIES = new Set(['update_cell_status', 'rename_step', 'move_cell', 'insert_cell_at_position'])
export const COORDINATES = ['path_id', 'lane_id', 'step_id', 'position']
export const coordinates = (row) => Object.fromEntries(COORDINATES.map((key) => [key, row[key]]))
export const stableRow = (row) => structuredClone(Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'updated_at')))

export function matchesScope(row, target) {
  return (!target.id || target.id === row.id) && (!target.cell_key || target.cell_key === row.cell_key)
    && Object.entries(target.where ?? {}).every(([key, value]) => isDeepStrictEqual(row[key], value))
}

/** Advance captured postconditions only through a successfully read-back write. */
export function projectChecks(checks, table, before, after) {
  for (const check of checks) {
    if (check.target.table !== table) continue
    const index = check.rows.findIndex((row) => row.id === (before?.id ?? after.id))
    if (before && index !== -1) check.rows.splice(index, 1)
    if (matchesScope(after, check.target)) check.rows.push(stableRow(after))
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

export async function prepareCapability(read, op, before) {
  if (!CAPABILITIES.has(op.operation)) return null
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
  throw new Error(`No inverse contract for ${op.operation}: ${result?.id ?? ''}`)
}

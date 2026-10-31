import { isDeepStrictEqual } from 'node:util'

const OPERATIONS = {
  update_cell_content: { table: 'cells', fields: ['content', 'summary', 'status', 'owner', 'perceived_owner'] },
  create_path_at_status: { table: 'paths', fields: ['kind', 'status', 'summary', 'note'], create: true },
  upsert_cell_at_status: { table: 'cells', fields: ['content', 'status', 'summary'], create: true },
  create_scenario: { table: 'scenarios', fields: ['name', 'layout', 'summary'], create: true },
  add_step: { table: 'steps', fields: ['name', 'summary'], create: true },
  add_lane: { table: 'lanes', fields: ['name', 'lane_role'], create: true },
  add_evidence: { table: 'evidence', fields: ['kind', 'title', 'note'], create: true },
  set_cell_dependency: { table: 'cell_dependencies', fields: ['kind', 'note', 'name'], create: true },
  set_placement_touchpoint: { table: 'cell_touchpoints', fields: ['touchpoint_id', 'name'] },
  set_path_steps: { table: 'paths', fields: ['step_ids'] },
  set_path_status: { table: 'paths', fields: ['status'] },
  update_path_spec: { table: 'paths', fields: ['summary', 'note'] },
  update_scenario_spec: { table: 'scenarios', fields: ['summary'] },
  update_step_spec: { table: 'steps', fields: ['summary'] },
}

const REQUIRED_SCOPE = {
  create_path_at_status: ['scenario_id', 'name'],
  upsert_cell_at_status: ['path_id', 'lane_id', 'step_id', 'position'],
  create_scenario: ['phase_id', 'name'],
  add_step: ['scenario_id', 'name'],
  add_lane: ['path_id', 'name'],
  add_evidence: ['service_id', 'cell_id', 'cell_key', 'title'],
  set_cell_dependency: ['source_cell_id', 'target_cell_id', 'kind'],
}

const TABLES = new Set(['services', 'phases', 'scenarios', 'paths', 'steps', 'path_steps', 'lanes', 'cells', 'cell_dependencies', 'cell_touchpoints', 'resources', 'evidence', 'authoring_changes'])

function validateTarget(target) {
  if (!TABLES.has(target?.table) || (!target.id && !target.cell_key && !Object.keys(target.where ?? {}).length))
    throw new Error('Expected a supported table and a scoped target (id, cell_key or where)')
}

export function validateChangeset(changeset) {
  if (changeset.version !== 1 || !Number.isInteger(changeset.issue) || !changeset.operations?.length)
    throw new Error('Expected version 1, issue number and nonempty operations')
  const keys = new Set()
  for (const op of changeset.operations) {
    const contract = OPERATIONS[op.operation]
    if (!contract || contract.table !== op.target?.table)
      throw new Error(`${op.key}: unsupported operation/table; no sanctioned write operation registered`)
    validateTarget(op.target)
    if (op.expected === null) {
      if (op.target.id || op.target.cell_key) throw new Error(`${op.key}: new rows require a named parent scope, not an assigned id`)
      for (const field of REQUIRED_SCOPE[op.operation] ?? []) {
        if (!Object.hasOwn(op.target.where ?? {}, field)) throw new Error(`${op.key}: expected parent scope field ${field}`)
      }
    }
    if (!op.key || keys.has(op.key)) throw new Error('Expected unique operation keys')
    keys.add(op.key)
    if (!op.evidence?.length || op.evidence.some((e) => typeof e !== 'string' || !e.trim()))
      throw new Error(`${op.key}: evidence citations required`)
    if (!op.value || !Object.keys(op.value).length) throw new Error(`${op.key}: expected value fields`)
    for (const field of Object.keys(op.value)) {
      if (!contract.fields.includes(field)) throw new Error(`${op.key}: unsupported field ${field}`)
      if (op.expected === null && contract.create) continue
      if (!op.expected || !Object.hasOwn(op.expected, field))
        throw new Error(`${op.key}: expected-current missing ${field}`)
    }
    if (contract.create !== (op.expected === null)) {
      if (contract.create || op.expected === null) throw new Error(`${op.key}: creation requires expected: null; edits require expected fields`)
    }
    if (Object.hasOwn(op.value, 'status') && !['proposed', 'planned', 'built', 'live', 'at_risk', 'deprecated'].includes(op.value.status))
      throw new Error(`${op.key}: unsupported status`)
    for (const [field, value] of Object.entries(op.value)) {
      if (Object.hasOwn(op.target.where ?? {}, field) && !isDeepStrictEqual(op.target.where[field], value))
        throw new Error(`${op.key}: target scope disagrees with value.${field}`)
      if (['content', 'name', 'title'].includes(field) && (typeof value !== 'string' || !value.trim() || value.trim() !== value))
        throw new Error(`${op.key}: expected nonempty trimmed ${field}`)
      if (['summary', 'note', 'owner', 'perceived_owner'].includes(field) && value !== null && (typeof value !== 'string' || !value.trim() || value.trim() !== value))
        throw new Error(`${op.key}: use trimmed text or null for ${field}`)
    }
    if (op.value.layout && !['stacked', 'merged'].includes(op.value.layout)) throw new Error(`${op.key}: unsupported layout`)
    if (op.value.kind && op.target.table === 'paths' && !['happy', 'variant', 'exception'].includes(op.value.kind))
      throw new Error(`${op.key}: unsupported path kind`)
    if (op.operation === 'set_path_steps' && (!op.target.withSteps || !Array.isArray(op.value.step_ids)))
      throw new Error(`${op.key}: expected target.withSteps and value.step_ids`)
  }
  for (const check of changeset.checks ?? []) {
    validateTarget(check.target)
    if (!Number.isInteger(check.beforeCount) || !Number.isInteger(check.afterCount))
      throw new Error('Expected beforeCount and afterCount on each count check')
    for (const [field, count] of [['beforeRows', check.beforeCount], ['afterRows', check.afterCount]]) {
      if (check[field] && (!Array.isArray(check[field]) || check[field].length !== count))
        throw new Error(`Expected ${field} to describe exactly ${count} rows`)
    }
  }
}

async function resolveRefs(value, known, database) {
  if (Array.isArray(value)) return Promise.all(value.map((v) => resolveRefs(v, known, database)))
  if (value && typeof value === 'object') {
    if (Object.hasOwn(value, 'ref')) {
      if (!known.has(value.ref)) throw new Error(`Expected a preceding operation for ref ${value.ref}`)
      const row = known.get(value.ref)
      if (!row || !Object.hasOwn(row, value.field ?? 'id')) throw new Error(`Cannot resolve ${value.ref}.${value.field ?? 'id'}`)
      return row[value.field ?? 'id']
    }
    if (Object.hasOwn(value, 'lookup')) {
      const target = await resolveRefs(value.lookup, known, database)
      validateTarget(target)
      if (pending(target)) return { $pending: 'lookup' }
      const rows = await database.read(target)
      if (rows.length !== 1) throw new Error(`lookup ${JSON.stringify(target)}: expected exactly one row, found ${rows.length}`)
      if (typeof rows[0].id !== 'string' || !rows[0].id) throw new Error(`lookup ${JSON.stringify(target)}: missing id`)
      return rows[0].id
    }
    return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k, v]) => [k, await resolveRefs(v, known, database)])))
  }
  return value
}

function pending(value) {
  return value && typeof value === 'object' && (Object.hasOwn(value, '$pending') || Object.values(value).some(pending))
}

async function observe(database, target) {
  return pending(target) ? [] : database.read(target)
}

function differences(actual, expected, label) {
  return Object.entries(expected).flatMap(([field, value]) =>
    isDeepStrictEqual(actual?.[field], value) ? [] : [
      `${label}.${field}: expected ${JSON.stringify(value)}, found ${JSON.stringify(actual?.[field])}`,
    ],
  )
}

function durableRecord(row) {
  return structuredClone(Object.fromEntries(
    ['id', 'fn', 'args', 'revert', 'author', 'agent_session_id'].map((key) => [key, row[key] ?? null]),
  ))
}

async function checkLog(database, receipt, { capture = false } = {}) {
  const failures = []
  for (const entry of receipt) {
    if (!entry.changeIds?.length) failures.push(`${entry.key}: no durable change ids`)
    for (const id of entry.changeIds ?? []) {
      const rows = await database.read({ table: 'authoring_changes', id })
      const row = rows[0]
      if (rows.length !== 1 || !row.fn || !row.args || !row.author || !row.revert?.fn || !row.revert?.args) {
        failures.push(`${entry.key}: ${id} missing durable operation, args, author or inverse`)
      } else if (capture) {
        entry.changes ??= []
        entry.changes.push(durableRecord(row))
      } else {
        const captured = entry.changes?.find((change) => change.id === id)
        if (!captured || !isDeepStrictEqual(captured, durableRecord(row)))
          failures.push(`${entry.key}: ${id} differs from the captured durable record`)
      }
    }
  }
  return failures
}

export async function runChangeset(changeset, mode, database, { receipt = [], onProgress = async () => {} } = {}) {
  validateChangeset(changeset)
  if (!['verify', 'apply', 'dry-run'].includes(mode)) throw new Error('Expected dry-run, apply or verify')
  const failures = []
  const diff = []
  const planned = []
  const applied = []
  const known = new Map()
  const auditCounts = mode === 'dry-run' && database.auditCount ? { before: await database.auditCount() } : null
  for (const source of changeset.operations) {
    const op = await resolveRefs(source, known, database)
    const rows = await observe(database, op.target)
    const creating = op.expected === null && mode !== 'verify'
    if (creating ? rows.length !== 0 : rows.length !== 1) {
      failures.push(`${op.key}: expected ${creating ? 'no rows' : 'exactly one row'}, found ${rows.length}`)
    } else {
      if (!creating) failures.push(...differences(rows[0], mode === 'verify' ? { ...op.expected, ...op.value } : op.expected, op.key))
      diff.push({
        key: op.key, operation: op.operation,
        target: creating ? op.target : { table: op.target.table, id: rows[0].id },
        before: creating ? null : Object.fromEntries(Object.keys(op.value).map((key) => [key, rows[0][key]])),
        after: op.value, evidence: op.evidence,
      })
      planned.push({ source, before: rows[0] ?? null })
      if (mode !== 'verify' && database.prepare) {
        try { await database.prepare(op, rows[0] ?? null) }
        catch (error) { failures.push(`${op.key}: ${error.message}`) }
      }
    }
    known.set(op.key, rows[0] ?? {
      ...op.target.where, ...op.value, id: { $pending: op.key },
      ...(op.target.table === 'cells' ? { cell_key: { $pending: `${op.key}.cell_key` } } : {}),
    })
  }
  for (const check of changeset.checks ?? []) {
    const rows = await observe(database, await resolveRefs(check.target, known, database))
    const count = mode === 'verify' ? check.afterCount : check.beforeCount
    if (rows.length !== count) failures.push(`count ${JSON.stringify(check.target)}: expected ${count}, found ${rows.length}`)
    const field = mode === 'verify' ? 'afterRows' : 'beforeRows'
    const remaining = [...rows]
    for (const expected of await resolveRefs(check[field] ?? [], known, database)) {
      const index = remaining.findIndex((row) => differences(row, expected, field).length === 0)
      if (index === -1) failures.push(`${field} ${JSON.stringify(check.target)}: missing ${JSON.stringify(expected)}`)
      else remaining.splice(index, 1)
    }
  }
  if (mode === 'apply' && failures.length === 0) {
    known.clear()
    for (const { source, before } of planned) {
      try {
        const op = await resolveRefs(source, known, database)
        const current = await database.read(op.target)
        if (before === null ? current.length !== 0 : current.length !== 1 || !isDeepStrictEqual(current[0], before))
          throw new Error('Target changed since preflight; no write attempted for this operation')
        await database.prepare?.(op, before)
        // Mark the attempt before sending it: a connection can fail after the
        // server committed. A receipt prevents a blind retry of that request.
        await onProgress(applied, { started: op.key })
        const written = await database.write(op, before)
        const entry = { key: op.key, changeIds: written.changeIds }
        applied.push(entry)
        failures.push(...await checkLog(database, [entry], { capture: true }))
        await onProgress(applied, { started: op.key })
        const rows = await database.read(op.target)
        if (rows.length !== 1) failures.push(`${op.key}: zero-row or ambiguous write`)
        else {
          failures.push(...differences(rows[0], op.value, op.key))
          known.set(op.key, rows[0])
        }
        if (failures.length) break
      } catch (error) {
        failures.push(`${source.key}: ${error.message}; batch stopped, inspect partial writes before retrying`)
        break
      }
    }
    if (!failures.length) {
      const verified = await runChangeset(changeset, 'verify', database, { receipt: applied })
      failures.push(...verified.failures)
    }
  }
  if (mode === 'dry-run') {
    for (const { source, before } of planned) {
      const op = await resolveRefs(source, known, database)
      const rows = await observe(database, op.target)
      if (!isDeepStrictEqual(rows, before === null ? [] : [before]))
        failures.push(`${op.key}: dry-run read-back changed; inspect concurrent edits`)
    }
    if (auditCounts) {
      auditCounts.after = await database.auditCount()
      if (auditCounts.before !== auditCounts.after) failures.push('dry-run: durable change count changed')
    }
  }
  if (mode === 'verify') failures.push(...await checkLog(database, receipt))
  return { ok: failures.length === 0, mode, failures, diff, applied, ...(auditCounts ? { auditCounts } : {}) }
}

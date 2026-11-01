import { isDeepStrictEqual } from 'node:util'
import { verifyChecks, projectChecks, CAPABILITIES, COORDINATES } from './changesets/capabilities.mjs'

const OPERATIONS = {
  update_cell_status: { table: 'cells', fields: ['status'] },
  rename_step: { table: 'steps', fields: ['name'] },
  move_cell: { table: 'cells', fields: COORDINATES },
  insert_cell_at_position: { table: 'cells', fields: ['content', 'status'], create: true },
  update_cell_content: { table: 'cells', fields: ['content', 'summary', 'status', 'owner', 'perceived_owner'] },
  create_path_at_status: { table: 'paths', fields: ['kind', 'status', 'summary', 'note'], create: true },
  upsert_cell_at_status: { table: 'cells', fields: ['content', 'status', 'summary'], create: true },
  create_scenario: { table: 'scenarios', fields: ['name', 'layout', 'summary'], create: true },
  add_step: { table: 'steps', fields: ['name', 'summary'], create: true },
  add_lane: { table: 'lanes', fields: ['name', 'lane_role'], create: true },
  add_evidence: { table: 'evidence', fields: ['kind', 'title', 'note'], create: true },
  set_cell_dependency: { table: 'cell_dependencies', fields: ['kind', 'note', 'name'], create: true },
  update_cell_dependency: { table: 'cell_dependencies', fields: ['kind', 'note'] },
  set_placement_touchpoint: { table: 'cell_touchpoints', fields: ['touchpoint_id', 'name'] },
  set_path_steps: { table: 'paths', fields: ['step_ids'] },
  set_path_status: { table: 'paths', fields: ['status'] },
  update_path_spec: { table: 'paths', fields: ['summary', 'note'] },
  update_scenario_spec: { table: 'scenarios', fields: ['summary'] },
  update_step_spec: { table: 'steps', fields: ['summary'] },
}

/**
 * Edits that may address a row generated earlier in the same batch: a
 * generated step's rename or summary, and a new path's copied step list.
 */
const DEFERRABLE = new Set(['rename_step', 'update_step_spec', 'set_path_steps'])

const REQUIRED_SCOPE = {
  insert_cell_at_position: COORDINATES,
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
    if (op.operation === 'rename_step') {
      const links = op.input?.expected_path_steps
      if (!Array.isArray(links) || links.some((link) => !link.path_id || !Number.isSafeInteger(link.position) || link.position < 0))
        throw new Error(`${op.key}: rename requires input.expected_path_steps with every reviewed path and position`)
    }
    if (op.operation === 'move_cell') {
      if (!op.target.id && !op.target.cell_key) throw new Error(`${op.key}: move must address an existing identity`)
      for (const field of COORDINATES) if (!Object.hasOwn(op.expected ?? {}, field) || !Object.hasOwn(op.value ?? {}, field))
        throw new Error(`${op.key}: move requires every expected and destination coordinate`)
    }
    if (op.operation === 'update_cell_dependency') {
      if (!op.target.id) throw new Error(`${op.key}: a dependency edit must address the existing edge by id`)
      if (!['leads_to', 'enables'].includes(op.value.kind)) throw new Error(`${op.key}: a dependency edit requires value.kind leads_to or enables`)
    }
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
      if (pending(target)) return { $pending: 'lookup', roots: pendingRoots(target) }
      // `field` names an identity column on a row without its own id, such as
      // a path_steps membership's step_id. It is still exactly one row's value.
      const field = value.field ?? 'id'
      const rows = await database.read(target)
      if (rows.length !== 1) throw new Error(`lookup ${JSON.stringify(target)}: expected exactly one row, found ${rows.length}`)
      if (typeof rows[0][field] !== 'string' || !rows[0][field]) throw new Error(`lookup ${JSON.stringify(target)}: missing ${field}`)
      return rows[0][field]
    }
    return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k, v]) => [k, await resolveRefs(v, known, database)])))
  }
  return value
}

function pending(value) {
  return value && typeof value === 'object' && (Object.hasOwn(value, '$pending') || Object.values(value).some(pending))
}

/** The keys of the batch operations a pending value is waiting on. */
function pendingRoots(value) {
  if (!value || typeof value !== 'object') return []
  if (Object.hasOwn(value, '$pending')) return value.roots ?? [value.$pending]
  return [...new Set(Object.values(value).flatMap(pendingRoots))]
}

/**
 * A deferred edit may only reach a row this batch creates: its target must be
 * pending solely through one scenario created earlier in the batch, and it
 * must name that scenario in expected.scenario_id, which apply re-checks.
 * Returns the scenario's operation key, or the reasons to refuse.
 */
function deferral(source, op, index, operations, rootedIn) {
  if (op.operation === 'set_path_steps') return pathDeferral(source, op, index, operations)
  const scenario = source.expected?.scenario_id?.ref
  if (!scenario || (source.expected.scenario_id.field ?? 'id') !== 'id' || operations.findIndex((other) => other.key === scenario) >= index
    || operations.find((other) => other.key === scenario)?.operation !== 'create_scenario')
    return { failures: [`${op.key}: a deferred edit requires expected.scenario_id to be the ref of a scenario created earlier in this batch`] }
  const failures = []
  for (const root of pendingRoots(op.target)) {
    if (rootedIn.get(root) !== scenario)
      failures.push(`${op.key}: deferred target is reached through ${root}, not only through scenario ${scenario}; an existing row cannot be deferred`)
  }
  if (op.operation === 'rename_step') {
    const later = operations.slice(index + 1).find((other) => other.operation === 'add_step' && other.target?.where?.scenario_id?.ref === scenario)
    if (later) failures.push(`${op.key}: a deferred rename must follow every add_step on scenario ${scenario}; ${later.key} comes after it`)
  }
  return { scenario, failures }
}

/**
 * create_path_at_status copies its source path's step memberships. Trimming
 * that copied list is deferred only when target.id is the ref of that
 * creation, so it can never reach an existing path. Apply re-reads the new
 * path and refuses unless its memberships equal the reviewed expected list.
 */
function pathDeferral(source, op, index, operations) {
  const path = source.target?.id?.ref
  const creation = operations.findIndex((other) => other.key === path)
  if (!path || (source.target.id.field ?? 'id') !== 'id' || creation === -1 || creation >= index
    || operations[creation].operation !== 'create_path_at_status')
    return { failures: [`${op.key}: a deferred set_path_steps requires target.id to be the ref of a path created earlier in this batch`] }
  const later = operations.slice(index + 1).find((other) => other.operation === 'add_step' && other.input?.path_id?.ref === path)
  return { path, failures: later ? [`${op.key}: a deferred set_path_steps must follow every add_step on path ${path}; ${later.key} comes after it`] : [] }
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
    if (entry.expectedChanges) {
      if (entry.changeIds.length !== 1 || entry.expectedChanges.length !== 1 || entry.ledgerCounts?.after - entry.ledgerCounts?.before !== 1)
        failures.push(`${entry.key}: expected exactly one durable record, with no duplicate append or concurrent ledger growth`)
    }
    for (const [index, id] of (entry.changeIds ?? []).entries()) {
      const rows = await database.read({ table: 'authoring_changes', id })
      const row = rows[0]
      if (rows.length !== 1 || !row.fn || !row.args || !row.author || !row.revert?.fn || !row.revert?.args) {
        failures.push(`${entry.key}: ${id} missing durable operation, args, author or inverse`)
      } else {
        const expected = entry.expectedChanges?.[index]
        if (expected && (!isDeepStrictEqual(expected.args, row.args) || !isDeepStrictEqual(expected.revert, row.revert) || expected.fn !== row.fn || row.author !== 'human'))
          failures.push(`${entry.key}: ${id} does not match the captured pre-write inverse contract`)
        if (capture) {
          entry.changes ??= []
          entry.changes.push(durableRecord(row))
        } else {
          const captured = entry.changes?.find((change) => change.id === id)
          if (!captured || !isDeepStrictEqual(captured, durableRecord(row)))
            failures.push(`${entry.key}: ${id} differs from the captured durable record`)
        }
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
  let failedAttempt
  const known = new Map()
  // Which scenario created in this batch each pending row descends from.
  const rootedIn = new Map()
  const auditCounts = mode === 'dry-run' && database.auditCount ? { before: await database.auditCount() } : null
  for (const [index, source] of changeset.operations.entries()) {
    const op = await resolveRefs(source, known, database)
    const rows = await observe(database, op.target)
    const creating = op.expected === null && mode !== 'verify'
    // A step a preceding creation generates (create_scenario's placeholder)
    // has no row to preflight. Its rename and summary are deferred, not
    // assumed: apply reads the row after its parent exists, re-checks its
    // scenario and every expected field, and prepares (memberships,
    // preservation) before writing. Anything else on a pending row fails.
    const deferrable = !creating && mode !== 'verify' && DEFERRABLE.has(op.operation) && pending(op.target)
    const deferred = deferrable ? deferral(source, op, index, changeset.operations, rootedIn) : null
    if (creating) {
      const roots = pendingRoots(op.target)
      const scenario = op.operation === 'create_scenario' ? op.key : rootedIn.get(roots[0])
      if (scenario && roots.every((root) => rootedIn.get(root) === scenario)) rootedIn.set(op.key, scenario)
    }
    if (deferred?.failures.length) {
      failures.push(...deferred.failures)
    } else if (deferred) {
      if (deferred.scenario) rootedIn.set(op.key, deferred.scenario)
      diff.push({
        key: op.key, operation: op.operation, target: { table: op.target.table, generated: true },
        before: op.expected, after: op.value, evidence: op.evidence,
        deferred: 'Generated by a preceding operation; read, guarded and captured at apply time',
      })
      planned.push({ source, before: null, deferred: deferred.path ? { path: deferred.path } : { scenario: deferred.scenario } })
    } else if (creating ? rows.length !== 0 : rows.length !== 1) {
      failures.push(`${op.key}: expected ${creating ? 'no rows' : 'exactly one row'}, found ${rows.length}`)
    } else {
      if (!creating) failures.push(...differences(rows[0], mode === 'verify' ? { ...op.expected, ...op.value } : op.expected, op.key))
      diff.push({
        key: op.key, operation: op.operation,
        target: creating ? op.target : { table: op.target.table, id: rows[0].id },
        before: creating ? null : Object.fromEntries(Object.keys(op.value).map((key) => [key, rows[0][key]])),
        after: op.value, evidence: op.evidence,
      })
      const plan = { source, before: rows[0] ?? null }
      planned.push(plan)
      if (mode !== 'verify' && database.prepare) {
        try {
          plan.preparation = await database.prepare(op, rows[0] ?? null)
          if (plan.preparation?.affectedPaths) diff.at(-1).affectedPaths = plan.preparation.affectedPaths
          if (plan.preparation?.endpoints) diff.at(-1).endpoints = plan.preparation.endpoints
        }
        catch (error) { failures.push(`${op.key}: ${error.message}`) }
      }
    }
    known.set(op.key, rows[0] ?? {
      ...op.target.where, ...op.value, id: { $pending: op.key },
      ...(op.target.table === 'cells' ? { cell_key: { $pending: op.key, field: 'cell_key' } } : {}),
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
    for (const { source, preparation: preflight, deferred, ...plan } of planned) {
      let op
      let before = plan.before
      try {
        op = await resolveRefs(source, known, database)
        if (pending(op.target)) throw new Error('Target is still pending after its parent; no write attempted for this operation')
        const current = await database.read(op.target)
        if (deferred) {
          if (current.length !== 1) throw new Error(`Generated target resolved to ${current.length} rows; no write attempted for this operation`)
          if (deferred.path) {
            const pathId = known.get(deferred.path)?.id
            if (!pathId || current[0].id !== pathId)
              throw new Error(`Target is not the path ${deferred.path} created by this batch; no write attempted for this operation`)
          } else {
            const scenarioId = known.get(deferred.scenario)?.id
            if (!scenarioId || current[0].scenario_id !== scenarioId)
              throw new Error(`Generated target is not in scenario ${deferred.scenario} created by this batch; no write attempted for this operation`)
          }
          const mismatch = differences(current[0], op.expected, op.key)
          if (mismatch.length) throw new Error(`${mismatch.join('; ')}; no write attempted for this operation`)
          before = current[0]
        } else if (before === null ? current.length !== 0 : current.length !== 1 || !isDeepStrictEqual(current[0], before))
          throw new Error('Target changed since preflight; no write attempted for this operation')
        // A deferred rename has no preflight capture to compare; its prepare
        // still refuses memberships that differ from the reviewed input.
        const preparation = await database.prepare?.(op, before)
        if (!deferred && !isDeepStrictEqual(preparation?.affectedPaths, preflight?.affectedPaths)) throw new Error('Affected paths changed since the reviewed preflight')
        if (!isDeepStrictEqual(preparation?.endpoints, preflight?.endpoints)) throw new Error('Link endpoints changed since the reviewed preflight')
        const preservationFailures = await verifyChecks(database.read, preflight?.checks ?? [])
        if (preservationFailures.length) throw new Error(preservationFailures.join('; '))
        // Mark the attempt before sending it: a connection can fail after the
        // server committed. A receipt prevents a blind retry of that request.
        await onProgress(applied, { started: op.key })
        const written = await database.write(op, before, preparation)
        const entry = { key: op.key, changeIds: written.changeIds, ...(written.checks ? { checks: written.checks, expectedChanges: written.expectedChanges, ledgerCounts: written.ledgerCounts } : {}) }
        applied.push(entry)
        failures.push(...await checkLog(database, [entry], { capture: true }))
        if (entry.checks) failures.push(...await verifyChecks(database.read, entry.checks))
        await onProgress(applied, { started: op.key })
        const rows = await database.read(op.target)
        if (rows.length !== 1) failures.push(`${op.key}: zero-row or ambiguous write`)
        else {
          failures.push(...differences(rows[0], op.value, op.key))
          known.set(op.key, rows[0])
          for (const previous of applied.slice(0, -1)) projectChecks(previous.checks ?? [], op.target.table, before, before ? { ...before, ...op.value } : rows[0])
          for (const next of planned) projectChecks(next.preparation?.checks ?? [], op.target.table, before, before ? { ...before, ...op.value } : rows[0])
        }
        if (failures.length) break
      } catch (error) {
        const key = op?.key ?? source.key
        failedAttempt = { key, message: error.message, before }
        if (error.entry?.revert) failedAttempt.partial = {
          fn: error.entry.fn, args: error.entry.args, revert: error.entry.revert,
        }
        await onProgress(applied, { started: key, ...failedAttempt })
        failures.push(`${key}: ${error.message}; batch stopped, inspect partial writes before retrying`)
        break
      }
    }
    if (!failures.length) {
      const verified = await runChangeset(changeset, 'verify', database, { receipt: applied })
      failures.push(...verified.failures)
    }
  }
  if (mode === 'dry-run') {
    for (const { source, before, preparation, deferred } of planned) {
      if (deferred) continue // Its target is pending: nothing exists to re-read.
      const op = await resolveRefs(source, known, database)
      const rows = await observe(database, op.target)
      if (!isDeepStrictEqual(rows, before === null ? [] : [before]))
        failures.push(`${op.key}: dry-run read-back changed; inspect concurrent edits`)
      failures.push(...await verifyChecks(database.read, preparation?.checks ?? []))
    }
    if (auditCounts) {
      auditCounts.after = await database.auditCount()
      if (auditCounts.before !== auditCounts.after) failures.push('dry-run: durable change count changed')
    }
  }
  if (mode === 'verify') {
    failures.push(...await checkLog(database, receipt))
    const checks = new Map()
    for (const entry of receipt) for (const check of entry.checks ?? []) checks.set(JSON.stringify(check.target), check)
    for (const source of changeset.operations.filter((op) => CAPABILITIES.has(op.operation))) {
      const entry = receipt.find((item) => item.key === source.key)
      if (!entry?.checks?.length || !entry.expectedChanges?.length) failures.push(`${source.key}: missing captured preservation/inverse receipt`)
    }
    failures.push(...await verifyChecks(database.read, [...checks.values()]))
  }
  return { ok: failures.length === 0, mode, failures, diff, applied, ...(failedAttempt ? { failedAttempt } : {}), ...(auditCounts ? { auditCounts } : {}) }
}

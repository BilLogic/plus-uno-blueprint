import { test, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { modules } from '../../deployment/lib/contentChangesetModules.ts'
import { createDatabase } from '../changesets/database.mjs'
import { readFileSync } from 'node:fs'
import { runChangeset } from '../content-changeset.mjs'

const id = '10000000-0000-4000-8000-000000000001'
const seed = {
  id, content: 'Creates and edits sessions.', summary: 'Old schedule summary.', status: 'built',
  owner: null, perceived_owner: null,
}
const changeset = {
  version: 1, issue: 738, operations: [{
    key: 'tracer', operation: 'update_cell_content', target: { table: 'cells', id },
    expected: { content: seed.content, summary: seed.summary, status: seed.status },
    value: { content: 'Creates sessions.', summary: 'Card 2451 archived.', status: 'proposed' },
    evidence: ['Card 2451'],
  }],
}

/** Column defaults the hosted schema fills when an RPC's insert omits them. */
const COLUMN_DEFAULTS = { paths: { status: 'live' } }

/** A disposable PostgREST boundary, never a mock of the mutation modules. */
function databaseFixture({ zeroRows = false, failAppend = false, corruptCell = false, wrongInverse = false, duplicateLog = false, missingRpc = false, nilReceipt = false, raceMove = false } = {}) {
  const tables = {
    cells: [{ ...seed }], authoring_changes: [], evidence: [], cell_touchpoints: [], resources: [], cell_dependencies: [], services: [{ id }],
    paths: [{ id, scenario_id: id }], lanes: [{ id, path_id: id }], steps: [{ id, scenario_id: id, name: 'Old step' }], path_steps: [],
    phases: [], scenarios: [],
  }
  const uuid = (prefix) => `${prefix}-0000-4000-8000-${String(counter++).padStart(12, '0')}`
  // Shift then insert, as add_step does under its deferred position constraint.
  const addPathStep = (pathId, stepId, position) => {
    for (const link of tables.path_steps) if (link.path_id === pathId && link.position >= position) link.position += 1
    tables.path_steps.push({ path_id: pathId, step_id: stepId, position })
  }
  const requests = []
  let counter = 1
  const fetch = async (input, init = {}) => {
    const url = new URL(input)
    const method = init.method ?? 'GET'
    requests.push({ method, path: url.pathname })
    const body = init.body ? JSON.parse(init.body) : null
    const answer = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
      status, headers: { 'Content-Type': 'application/json', ...headers },
    })
    if (url.pathname.endsWith('/rpc/sync_cell_touchpoints')) {
      // Touchpoint lanes place each named line; actor lanes are skipped.
      const cell = tables.cells.find((row) => row.id === body.p_cell_id)
      const lane = tables.lanes.find((row) => row.id === cell?.lane_id)
      if (['frontstage_touchpoints', 'backstage_touchpoints'].includes(lane?.lane_role)) {
        for (const [position, name] of body.p_names.entries()) {
          if (!tables.cell_touchpoints.some((row) => row.cell_id === cell.id && row.touchpoint_name === name))
            tables.cell_touchpoints.push({ id: uuid('70000000'), cell_id: cell.id, touchpoint_name: name, position, name: null, summary: null, role: null })
        }
      }
      return answer({ removed: [] })
    }
    if (url.pathname.endsWith('/rpc/create_scenario')) {
      // The hosted RPC: one happy path, copied lanes, and at least one
      // placeholder column named Step 1 at position 0 even for step_count 0.
      const scenarioId = uuid('80000000')
      const pathId = uuid('80000000')
      const siblings = tables.scenarios.filter((row) => row.phase_id === body.phase_id)
      tables.scenarios.push({ id: scenarioId, phase_id: body.phase_id, name: body.name, layout: body.layout, summary: null,
        position: Math.max(-1, ...siblings.map((row) => row.position)) + 1 })
      // The RPC leaves status to the column default (live); it never sets one.
      tables.paths.push({ id: pathId, scenario_id: scenarioId, name: body.path_name, kind: 'happy', status: COLUMN_DEFAULTS.paths.status, summary: null, note: null })
      for (const lane of tables.lanes.filter((row) => row.path_id === body.lane_source_path_id))
        tables.lanes.push({ id: uuid('80000000'), path_id: pathId, name: lane.name, lane_role: lane.lane_role, position: lane.position })
      for (let index = 0; index < Math.max(body.step_count, 1); index++) {
        const stepId = uuid('80000000')
        tables.steps.push({ id: stepId, scenario_id: scenarioId, name: `Step ${index + 1}`, summary: null })
        tables.path_steps.push({ path_id: pathId, step_id: stepId, position: index })
      }
      return answer({ scenario_id: scenarioId, path_id: pathId })
    }
    if (url.pathname.endsWith('/rpc/add_step')) {
      const path = tables.paths.find((row) => row.id === body.path_id)
      const stepId = uuid('80000000')
      const end = Math.max(-1, ...tables.path_steps.filter((row) => row.path_id === path.id).map((row) => row.position)) + 1
      tables.steps.push({ id: stepId, scenario_id: path.scenario_id, name: body.name, summary: null })
      addPathStep(path.id, stepId, body.at_position ?? end)
      return answer(stepId)
    }
    if (missingRpc && /\/rpc\/(rename_step|move_cell|insert_cell_at_position)$/.test(url.pathname)) return answer({ code: 'PGRST202', message: 'Missing host operation' }, 404)
    if (url.pathname.endsWith('/rpc/insert_cell_at_position')) {
      const cellId = `40000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`
      const changeId = `50000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`
      const row = { id: cellId, cell_key: `fixture/new--${cellId}`, path_id: body.path_id, lane_id: body.lane_id, step_id: body.step_id, position: body.at_position, content: body.content, status: body.status }
      tables.cells.push(row)
      tables.authoring_changes.push({ id: changeId, fn: 'insert_cell_at_position', author: 'human',
        args: { path_id: body.path_id, lane_id: body.lane_id, step_id: body.step_id, position: body.at_position, content: body.content, status: body.status, cell_id: cellId },
        revert: { fn: 'delete_cell', args: { cell_id: cellId } },
      })
      return answer({ id: cellId, cell_key: row.cell_key, change_id: changeId })
    }
    if (url.pathname.endsWith('/rpc/move_cell')) {
      const row = tables.cells.find((cell) => cell.id === body.cell_id)
      if (raceMove) row.position = 2
      if (!row || Object.entries(body.expected_source).some(([field, value]) => row[field] !== value)) return answer({ message: 'Cell moved', code: '40001' }, 409)
      const changeId = `50000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`
      const revert = { fn: 'move_cell', args: { cell_id: row.id, expected_source: body.destination, destination: body.expected_source } }
      Object.assign(row, body.destination)
      tables.authoring_changes.push({ id: changeId, fn: 'move_cell', args: body, revert, author: 'human' })
      return answer({ id: row.id, change_id: changeId })
    }
    if (url.pathname.endsWith('/rpc/rename_step')) {
      const row = tables.steps.find((step) => step.id === body.step_id)
      if (!row || row.name !== body.expected_name) return answer({ message: 'Step name changed', code: '40001' }, 409)
      const changeId = `50000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`
      const revert = { fn: 'rename_step', args: { step_id: row.id, expected_name: body.new_name, new_name: row.name } }
      row.name = body.new_name
      tables.authoring_changes.push({ id: changeId, fn: 'rename_step', args: body, revert, author: 'human' })
      if (wrongInverse) revert.args.new_name = 'Not the prior name'
      if (duplicateLog) tables.authoring_changes.push({ id: '60000000-0000-4000-8000-000000000001', fn: 'rename_step', args: body, revert, author: 'human' })
      if (corruptCell) tables.cells[0].content = 'Unexpected rewrite'
      return answer({ id: row.id, change_id: nilReceipt ? '00000000-0000-0000-0000-000000000000' : changeId })
    }
    if (url.pathname.endsWith('/rpc/upsert_cell_at_status')) {
      const cellId = `40000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`
      const changeId = `50000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`
      tables.cells.push({ id: cellId, ...body, position: 0, summary: null, owner: null, perceived_owner: null, cell_key: `fixture/minted--${cellId}` })
      tables.authoring_changes.push({
        id: changeId, fn: 'upsert_cell_at_status', args: body, author: 'human',
        revert: { fn: 'delete_cell', args: { cell_id: cellId } },
      })
      return answer({ id: cellId, change_id: changeId, inserted: true, previous: null })
    }
    if (url.pathname.endsWith('/rpc/record_authoring_change')) {
      if (failAppend) return answer({ message: 'Audit append refused', code: '42501' }, 403)
      const change = { id: `20000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`, ...body }
      tables.authoring_changes.push(change)
      return answer(change.id)
    }
    const table = url.pathname.split('/').at(-1)
    if (!Object.hasOwn(tables, table)) throw new Error(`Unexpected database request: ${method} ${table}`)
    const rows = tables[table].filter((row) => [...url.searchParams].every(([key, value]) => {
      if (['select', 'order', 'offset', 'limit'].includes(key)) return true
      return value === 'is.null' ? row[key] === null : String(row[key]) === value.replace(/^eq\./, '')
    }))
    if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': `0-0/${rows.length}` } })
    if (method === 'PATCH') {
      if (zeroRows) return answer([])
      rows.forEach((row) => Object.assign(row, body))
      return answer(rows.map((row) => ({ id: row.id })))
    }
    if (method === 'POST' && table === 'evidence') {
      const row = { ...body, id: `30000000-0000-4000-8000-${String(counter++).padStart(12, '0')}` }
      tables.evidence.push(row)
      return answer({ id: row.id })
    }
    return answer(rows)
  }
  const client = createClient('https://fixture.supabase.test', 'fixture-public-key', {
    global: { fetch }, auth: { persistSession: false, autoRefreshToken: false },
  })
  return { tables, requests, database: createDatabase(client, modules) }
}

test('the actual cell mutation supplies a durable inverse and zero-row failures reach the runner', async () => {
  const fixture = databaseFixture()
  try {
    const before = await runChangeset(changeset, 'verify', fixture.database)
    expect(before.ok).toBe(false)
    expect((await runChangeset(changeset, 'dry-run', fixture.database)).ok).toBe(true)
    expect(fixture.requests.every((request) => ['GET', 'HEAD'].includes(request.method))).toBe(true)
    const result = await runChangeset(changeset, 'apply', fixture.database)
    expect(result.failures).toEqual([])
    expect(fixture.tables.cells[0]).toMatchObject(changeset.operations[0].value)
    expect(fixture.tables.authoring_changes).toHaveLength(1)
    expect(fixture.tables.authoring_changes[0]).toMatchObject({
      fn: 'update_cell_content', author: 'human', args: { cell_id: id },
      revert: { fn: 'update_cell_content', args: {
        cell_id: id, update: {
          content: 'Creates and edits sessions.', summary: 'Old schedule summary.',
          status: 'built', owner: '', perceivedOwner: '',
        },
      } },
    })
    expect(fixture.requests.some((request) => request.path.endsWith('sync_cell_touchpoints'))).toBe(true)
    expect((await runChangeset(changeset, 'verify', fixture.database, { receipt: result.applied })).ok).toBe(true)
  } finally { fixture.database.close() }

  const missing = databaseFixture({ zeroRows: true })
  try {
    const result = await runChangeset(changeset, 'apply', missing.database)
    expect(result.ok).toBe(false)
    expect(missing.tables.cells[0].content).toBe('Creates and edits sessions.')
    expect(missing.tables.authoring_changes).toEqual([])
  } finally { missing.database.close() }
})

test('the command awaits the mutation module’s append and refuses success when it fails', async () => {
  const fixture = databaseFixture({ failAppend: true })
  try {
    const result = await runChangeset(changeset, 'apply', fixture.database)
    expect(result.ok).toBe(false)
    expect(result.failures.join('\n')).toContain('Durable append failed after write')
    expect(fixture.tables.cells[0].content).toBe('Creates sessions.')
    expect(fixture.tables.authoring_changes).toEqual([])
  } finally { fixture.database.close() }
})

test('status-only changes preserve a blank cell, wait for its one durable inverse and verify separately', async () => {
  const fixture = databaseFixture()
  fixture.tables.cells[0].content = ''
  const batch = { version: 1, issue: 766, operations: [{
    key: 'blank-status', operation: 'update_cell_status', target: { table: 'cells', id },
    expected: { status: 'built' }, value: { status: 'planned' }, evidence: ['Fixture source'],
  }] }
  try {
    expect((await runChangeset(batch, 'verify', fixture.database)).ok).toBe(false)
    expect((await runChangeset(batch, 'dry-run', fixture.database)).ok).toBe(true)
    expect(fixture.requests.every(({ method }) => ['GET', 'HEAD'].includes(method))).toBe(true)
    const applied = await runChangeset(batch, 'apply', fixture.database)
    expect(applied.failures).toEqual([])
    expect(fixture.tables.cells[0]).toMatchObject({ content: '', summary: seed.summary, status: 'planned' })
    expect(fixture.tables.authoring_changes).toHaveLength(1)
    expect(fixture.tables.authoring_changes[0]).toMatchObject({
      fn: 'update_cell_status', args: { cell_id: id, status: 'planned', expected_status: 'built' },
      revert: { fn: 'update_cell_status', args: { cell_id: id, status: 'built', expected_status: 'planned' } },
    })
    expect(fixture.requests.some(({ path }) => path.endsWith('sync_cell_touchpoints'))).toBe(false)
    expect((await runChangeset(batch, 'verify', fixture.database, { receipt: applied.applied })).ok).toBe(true)
    fixture.tables.cells[0].content = 'Unexpected rewrite'
    expect((await runChangeset(batch, 'verify', fixture.database, { receipt: applied.applied })).ok).toBe(false)
  } finally { fixture.database.close() }
})

const secondPath = '10000000-0000-4000-8000-000000000002'
function sharedStepFixture(options) {
  const fixture = databaseFixture(options)
  fixture.tables.paths.push({ id: secondPath, scenario_id: id })
  fixture.tables.path_steps.push({ path_id: id, step_id: id, position: 0 }, { path_id: secondPath, step_id: id, position: 2 })
  Object.assign(fixture.tables.cells[0], { path_id: id, lane_id: id, step_id: id, position: 0, cell_key: 'fixture/stable-cell' })
  fixture.tables.cell_touchpoints.push({ id, cell_id: id, name: 'Keep placement', position: 0, updated_at: '2026-10-20T00:00:00Z' })
  fixture.tables.resources.push({ id, cell_id: id, cell_touchpoint_id: id, name: 'Keep source' })
  fixture.tables.evidence.push({ id, cell_id: id, title: 'Keep evidence' })
  return fixture
}
const renameBatch = { version: 1, issue: 766, operations: [{
  key: 'rename', operation: 'rename_step', target: { table: 'steps', id },
  input: { expected_path_steps: [{ path_id: id, position: 0 }, { path_id: secondPath, position: 2 }] },
  expected: { name: 'Old step' }, value: { name: 'New step' }, evidence: ['Fixture source'],
}] }

test('a placement changed after preflight is refused before a status write', async () => {
  const fixture = sharedStepFixture()
  const batch = { version: 1, issue: 766, operations: [{
    key: 'status', operation: 'update_cell_status', target: { table: 'cells', id },
    expected: { status: 'built' }, value: { status: 'planned' }, evidence: ['Fixture source'],
  }] }
  const prepare = fixture.database.prepare
  let calls = 0
  fixture.database.prepare = async (...args) => {
    if (++calls === 2) fixture.tables.cell_touchpoints[0].name = 'Concurrent placement edit'
    return prepare(...args)
  }
  try {
    const result = await runChangeset(batch, 'apply', fixture.database)
    expect(result.ok).toBe(false)
    expect(result.failures.join('\n')).toContain('preservation')
    expect(fixture.tables.cells[0].status).toBe('built')
    expect(fixture.tables.authoring_changes).toEqual([])
    expect(fixture.requests.every(({ method }) => ['GET', 'HEAD'].includes(method))).toBe(true)
  } finally { fixture.database.close() }
})

test('a shared-step membership changed since the posted changeset aborts before writing', async () => {
  const fixture = sharedStepFixture()
  fixture.tables.path_steps[1].position = 3
  try {
    const result = await runChangeset(renameBatch, 'apply', fixture.database)
    expect(result.ok).toBe(false)
    expect(fixture.requests.every(({ method }) => ['GET', 'HEAD'].includes(method))).toBe(true)
  } finally { fixture.database.close() }
})

test('shared-step dry-run enumerates every affected path; rename preserves cells and logs once', async () => {
  const fixture = sharedStepFixture()
  try {
    const dry = await runChangeset(renameBatch, 'dry-run', fixture.database)
    expect(dry.failures).toEqual([])
    expect(dry.diff[0].affectedPaths.map((path) => path.path_id)).toEqual([id, secondPath])
    expect(fixture.requests.every(({ method }) => ['GET', 'HEAD'].includes(method))).toBe(true)
    const applied = await runChangeset(renameBatch, 'apply', fixture.database)
    expect(applied.failures).toEqual([])
    expect(fixture.tables.authoring_changes).toHaveLength(1)
    expect(fixture.tables.steps[0].name).toBe('New step')
    expect((await runChangeset(renameBatch, 'verify', fixture.database, { receipt: applied.applied })).ok).toBe(true)
    fixture.tables.cell_touchpoints[0].updated_at = '2026-10-30T00:00:00Z'
    expect((await runChangeset(renameBatch, 'verify', fixture.database, { receipt: applied.applied })).ok).toBe(false)
    fixture.tables.cell_touchpoints[0].updated_at = '2026-10-20T00:00:00Z'
    fixture.tables.cell_touchpoints[0].name = 'Lost placement'
    expect((await runChangeset(renameBatch, 'verify', fixture.database, { receipt: applied.applied })).ok).toBe(false)
  } finally { fixture.database.close() }
})

test('read-back refuses a rename that also rewrites a cell', async () => {
  const fixture = sharedStepFixture({ corruptCell: true })
  try {
    const result = await runChangeset(renameBatch, 'apply', fixture.database)
    expect(result.ok).toBe(false)
    expect(result.failures.join('\n')).toContain('preservation')
  } finally { fixture.database.close() }
})

function moveFixture(options) {
  const fixture = sharedStepFixture(options)
  fixture.tables.lanes.push({ id: secondPath, path_id: secondPath })
  return fixture
}
const moveBatch = { version: 1, issue: 766, operations: [{
  key: 'move', operation: 'move_cell', target: { table: 'cells', id },
  expected: { path_id: id, lane_id: id, step_id: id, position: 0 },
  value: { path_id: secondPath, lane_id: secondPath, step_id: id, position: 1 }, evidence: ['Fixture source'],
}] }

test('a cross-path move keeps identity, text, evidence, placements and resources with one inverse', async () => {
  const fixture = moveFixture()
  fixture.tables.cells.push({ id: secondPath, path_id: secondPath, lane_id: secondPath, step_id: id, position: 0, content: 'Keep the existing conversation' })
  try {
    expect((await runChangeset(moveBatch, 'dry-run', fixture.database)).ok).toBe(true)
    expect(fixture.requests.every(({ method }) => ['GET', 'HEAD'].includes(method))).toBe(true)
    const applied = await runChangeset(moveBatch, 'apply', fixture.database)
    expect(applied.failures).toEqual([])
    expect(fixture.tables.cells[0]).toMatchObject({ ...moveBatch.operations[0].value, cell_key: 'fixture/stable-cell', content: seed.content, status: seed.status })
    expect(fixture.tables.cells[1].content).toBe('Keep the existing conversation')
    expect(fixture.tables.authoring_changes).toHaveLength(1)
    expect((await runChangeset(moveBatch, 'verify', fixture.database, { receipt: applied.applied })).ok).toBe(true)
    fixture.tables.resources.length = 0
    expect((await runChangeset(moveBatch, 'verify', fixture.database, { receipt: applied.applied })).ok).toBe(false)
  } finally { fixture.database.close() }
})

const insertBatch = { version: 1, issue: 766, operations: [{
  key: 'insert', operation: 'insert_cell_at_position', target: { table: 'cells', where: { path_id: id, lane_id: id, step_id: id, position: 1 } },
  expected: null, value: { content: 'A separate action', status: 'planned' }, evidence: ['Fixture source'],
}] }
test('explicit-position insertion keeps position zero, verifies its identity/key and rejects extra placeholders', async () => {
  const fixture = sharedStepFixture()
  try {
    expect((await runChangeset(insertBatch, 'dry-run', fixture.database)).ok).toBe(true)
    const applied = await runChangeset(insertBatch, 'apply', fixture.database)
    expect(applied.failures).toEqual([])
    expect(fixture.tables.cells[0]).toMatchObject({ id, position: 0, content: seed.content })
    expect(fixture.tables.cells[1]).toMatchObject({ position: 1, content: 'A separate action', status: 'planned' })
    expect(fixture.tables.authoring_changes).toHaveLength(1)
    expect(applied.applied[0].expectedChanges[0].revert).toEqual({ fn: 'delete_cell', args: { cell_id: fixture.tables.cells[1].id } })
    expect((await runChangeset(insertBatch, 'verify', fixture.database, { receipt: applied.applied })).ok).toBe(true)
    fixture.tables.cells.push({ ...fixture.tables.cells[1], id: secondPath, position: 2 })
    expect((await runChangeset(insertBatch, 'verify', fixture.database, { receipt: applied.applied })).ok).toBe(false)
    expect(fixture.requests.some(({ method }) => method === 'DELETE')).toBe(false)
  } finally { fixture.database.close() }
})

test.each(['wrongInverse', 'duplicateLog'])('a %s cannot pass apply or separate read-back verification', async (failure) => {
  const fixture = sharedStepFixture({ [failure]: true })
  try {
    const applied = await runChangeset(renameBatch, 'apply', fixture.database)
    expect(applied.ok).toBe(false)
    expect((await runChangeset(renameBatch, 'verify', fixture.database, { receipt: applied.applied })).ok).toBe(false)
  } finally { fixture.database.close() }
})

test.each(['missingRpc', 'nilReceipt'])('a %s stops the batch without claiming success or retrying', async (failure) => {
  const fixture = sharedStepFixture({ [failure]: true })
  try {
    const applied = await runChangeset(renameBatch, 'apply', fixture.database)
    expect(applied.ok).toBe(false)
    expect(applied.applied).toHaveLength(0)
    expect(fixture.requests.filter(({ path }) => path.endsWith('/rpc/rename_step'))).toHaveLength(1)
    if (failure === 'nilReceipt') expect(fixture.tables.steps[0].name).toBe('New step')
    else expect(fixture.tables.steps[0].name).toBe('Old step')
  } finally { fixture.database.close() }
})

test('a concurrent move is refused by the guarded RPC and is never overwritten or retried', async () => {
  const fixture = moveFixture({ raceMove: true })
  try {
    const result = await runChangeset(moveBatch, 'apply', fixture.database)
    expect(result.ok).toBe(false)
    expect(fixture.tables.cells[0].position).toBe(2)
    expect(fixture.tables.authoring_changes).toEqual([])
    expect(fixture.requests.filter(({ path }) => path.endsWith('/rpc/move_cell'))).toHaveLength(1)
  } finally { fixture.database.close() }
})

test.each(['occupied', 'wrong-lane', 'wrong-source-lane', 'wrong-scenario', 'missing-membership', 'incident-edge', 'stale-source'])('preflight %s aborts the whole batch before the first write', async (failure) => {
  const fixture = moveFixture()
  if (failure === 'occupied') fixture.tables.cells.push({ id: secondPath, ...moveBatch.operations[0].value })
  if (failure === 'wrong-lane') fixture.tables.lanes[1].path_id = id
  if (failure === 'wrong-source-lane') fixture.tables.lanes[0].path_id = secondPath
  if (failure === 'wrong-scenario') fixture.tables.paths[1].scenario_id = secondPath
  if (failure === 'missing-membership') fixture.tables.path_steps.pop()
  if (failure === 'incident-edge') {
    fixture.tables.cells.push({ id: secondPath, path_id: id })
    fixture.tables.cell_dependencies.push({ id, source_cell_id: id, target_cell_id: secondPath, kind: 'leads_to' })
  }
  if (failure === 'stale-source') fixture.tables.cells[0].position = 2
  const batch = { version: 1, issue: 766, operations: [...renameBatch.operations, ...moveBatch.operations] }
  try {
    const result = await runChangeset(batch, 'apply', fixture.database)
    expect(result.ok).toBe(false)
    expect(fixture.requests.every(({ method }) => ['GET', 'HEAD'].includes(method))).toBe(true)
    expect(fixture.tables.steps[0].name).toBe('Old step')
  } finally { fixture.database.close() }
})

test('a partial status write retains its typed recovery inverse in the attempt receipt', async () => {
  const fixture = databaseFixture({ failAppend: true })
  const progress = []
  const batch = { version: 1, issue: 766, operations: [{
    key: 'status', operation: 'update_cell_status', target: { table: 'cells', id },
    expected: { status: 'built' }, value: { status: 'planned' }, evidence: ['Fixture source'],
  }] }
  try {
    const result = await runChangeset(batch, 'apply', fixture.database, { onProgress: async (_applied, attempt) => progress.push(structuredClone(attempt)) })
    expect(result.ok).toBe(false)
    expect(fixture.tables.cells[0].status).toBe('planned')
    expect(result.failedAttempt.partial.revert).toEqual({ fn: 'update_cell_status', args: { cell_id: id, status: 'built', expected_status: 'planned' } })
    expect(progress.at(-1).partial.revert).toEqual(result.failedAttempt.partial.revert)
    expect(fixture.tables.authoring_changes).toEqual([])
  } finally { fixture.database.close() }
})

test('separate verification composes rename, move, insertion and its subsequent evidence without relaxing preservation', async () => {
  const fixture = moveFixture()
  const batch = { version: 1, issue: 766, operations: [
    ...renameBatch.operations, ...moveBatch.operations, ...insertBatch.operations,
    { key: 'source', operation: 'add_evidence', target: { table: 'evidence', where: { service_id: id, cell_id: { ref: 'insert' }, cell_key: { ref: 'insert', field: 'cell_key' }, title: 'New source' } }, expected: null, value: { kind: 'doc', title: 'New source', note: 'Fixture citation' }, evidence: ['Fixture source'] },
  ] }
  try {
    const result = await runChangeset(batch, 'apply', fixture.database)
    expect(result.failures).toEqual([])
    expect(result.applied).toHaveLength(4)
    expect(fixture.tables.authoring_changes).toHaveLength(4)
    expect((await runChangeset(batch, 'verify', fixture.database, { receipt: result.applied })).failures).toEqual([])
  } finally { fixture.database.close() }
})

test('evidence uses the actual evidence mutation and is read back with its human-only delete inverse', async () => {
  const fixture = databaseFixture()
  const batch = {
    version: 1, issue: 738, operations: [{
      key: 'source', operation: 'add_evidence',
      target: { table: 'evidence', where: { service_id: id, cell_id: id, cell_key: 'fixture/cell', title: 'Card 2451' } },
      expected: null, value: { kind: 'decision', title: 'Card 2451', note: 'Archived.' }, evidence: ['Roadmap'],
    }],
  }
  try {
    const result = await runChangeset(batch, 'apply', fixture.database)
    expect(result.failures).toEqual([])
    expect(fixture.tables.evidence).toHaveLength(1)
    expect(fixture.tables.authoring_changes[0]).toMatchObject({
      fn: 'add_evidence', revert: { fn: 'delete_evidence', args: { evidence_id: fixture.tables.evidence[0].id } },
    })
  } finally { fixture.database.close() }
})

test('new cells use the status RPC, then the sanctioned summary mutation, retaining both inverses', async () => {
  const fixture = databaseFixture()
  const batch = {
    version: 1, issue: 738, operations: [{
      key: 'new', operation: 'upsert_cell_at_status',
      target: { table: 'cells', where: { path_id: id, lane_id: id, step_id: id, position: 0 } },
      expected: null, value: { content: 'Checks goals.', status: 'live', summary: 'Draft Module 9.' }, evidence: ['Draft Module 9'],
    }],
  }
  try {
    const result = await runChangeset(batch, 'apply', fixture.database)
    expect(result.failures).toEqual([])
    expect(fixture.tables.cells[1]).toMatchObject({ content: 'Checks goals.', status: 'live', summary: 'Draft Module 9.' })
    expect(fixture.tables.authoring_changes).toHaveLength(2)
    expect(fixture.tables.authoring_changes[0].revert.fn).toBe('delete_cell')
    expect(fixture.tables.authoring_changes[1].revert.args.update).toMatchObject({ summary: '', content: 'Checks goals.', status: 'live' })
    expect(result.applied[0].changeIds).toHaveLength(2)
  } finally { fixture.database.close() }
})

const PHASE = 'f1000000-0000-4000-8000-000000000001'
const LANE_SOURCE = 'a0000000-0000-4000-8000-000000000811'
const SERVICE = 'a0000000-0000-4000-8000-000000000001'
function scenarioFixture(options) {
  const fixture = databaseFixture(options)
  const { tables } = fixture
  tables.services.push({ id: SERVICE })
  tables.phases.push({ id: PHASE })
  tables.scenarios.push({ id: 'f1000000-0000-4000-8000-000000000002', phase_id: PHASE, name: 'Supervisor Program Administration', position: 1, layout: 'stacked' })
  tables.paths.push({ id: 'f1000000-0000-4000-8000-000000000003', scenario_id: 'f1000000-0000-4000-8000-000000000002' }, { id: LANE_SOURCE, scenario_id: 'a0000000-0000-4000-8000-000000000204' })
  const lanes = ['Storyboard:storyboard', 'Teacher:partner_actions', 'Lead Tutor:customer_actions', 'Regular Tutor:customer_actions',
    'Front Stage Touchpoints:frontstage_touchpoints', 'Front Stage Actions:frontstage_actions', 'Back Stage Touchpoints:backstage_touchpoints',
    'Back Stage Actions:backstage_actions', 'Support Actions:support_actions']
  lanes.forEach((lane, position) => {
    const [name, lane_role] = lane.split(':')
    tables.lanes.push({ id: `a0000000-0000-4000-8000-0000000008${String(position).padStart(2, '0')}`, path_id: LANE_SOURCE, name, lane_role, position })
  })
  return fixture
}
const scenarioSteps = (tables, name) => {
  const scenario = tables.scenarios.find((row) => row.name === name)
  const path = tables.paths.find((row) => row.scenario_id === scenario?.id)
  return tables.path_steps.filter((link) => link.path_id === path?.id).sort((a, b) => a.position - b.position)
    .map((link) => tables.steps.find((row) => row.id === link.step_id).name)
}

// A self-contained batch with the shape the runner supports for a generated
// placeholder: create, add the named steps, then rename and describe the
// placeholder by its membership, then write a cell on it with evidence.
const reportPath = { lookup: { table: 'paths', where: { scenario_id: { ref: 'scenario' }, name: 'Report sent' } } }
const generatedBatch = { version: 1, issue: 759, operations: [{
  key: 'scenario', operation: 'create_scenario', target: { table: 'scenarios', where: { phase_id: PHASE, name: 'Fixture Report' } },
  expected: null, value: { name: 'Fixture Report', layout: 'stacked' },
  input: { lane_source_path_id: LANE_SOURCE, step_count: 1, path_name: 'Report sent' }, evidence: ['Fixture source'],
}, ...['Receive email', 'Read report'].map((name, index) => ({
  key: `step-${index + 1}`, operation: 'add_step', target: { table: 'steps', where: { scenario_id: { ref: 'scenario' }, name } },
  expected: null, value: { name }, input: { path_id: reportPath, at_position: index + 1 }, evidence: ['Fixture source'],
})), {
  key: 'build-step', operation: 'rename_step',
  target: { table: 'steps', id: { lookup: { table: 'path_steps', where: { path_id: reportPath, position: 0 } }, field: 'step_id' } },
  expected: { name: 'Step 1', scenario_id: { ref: 'scenario' } }, value: { name: 'Build report' },
  input: { expected_path_steps: [{ path_id: reportPath, position: 0 }] }, evidence: ['Fixture source'],
}, {
  key: 'build-step-summary', operation: 'update_step_spec', target: { table: 'steps', id: { ref: 'build-step' } },
  expected: { summary: null, name: 'Build report', scenario_id: { ref: 'scenario' } }, value: { summary: 'Records feed the report.' }, evidence: ['Fixture source'],
}, {
  key: 'build-cell', operation: 'upsert_cell_at_status', target: { table: 'cells', where: {
    path_id: reportPath, lane_id: { lookup: { table: 'lanes', where: { path_id: reportPath, name: 'Regular Tutor' } } },
    step_id: { ref: 'build-step' }, position: 0,
  } }, expected: null, value: { content: 'Records attendance.', status: 'live' }, evidence: ['Fixture source'],
}, {
  key: 'build-cell-evidence', operation: 'add_evidence', target: { table: 'evidence', where: {
    service_id: SERVICE, cell_id: { ref: 'build-cell' }, cell_key: { ref: 'build-cell', field: 'cell_key' }, title: 'Fixture source',
  } }, expected: null, value: { kind: 'doc', title: 'Fixture source', note: 'Fixture citation.' }, evidence: ['Fixture source'],
}], checks: [
  { target: { table: 'steps', where: { scenario_id: { ref: 'scenario' } } }, beforeCount: 0, afterCount: 3 },
  { target: { table: 'steps', where: { scenario_id: { ref: 'scenario' }, name: 'Step 1' } }, beforeCount: 0, afterCount: 0 },
] }

/** Changes the fixture right after one named operation's write. */
function after(fixture, key, change) {
  const write = fixture.database.write
  fixture.database.write = async (op, ...rest) => {
    const result = await write(op, ...rest)
    if (op.key === key) change(fixture.tables)
    return result
  }
}
const placeholder = (tables) => {
  const scenario = tables.scenarios.find((row) => row.name === 'Fixture Report')
  return tables.steps.find((row) => row.scenario_id === scenario.id && row.name === 'Step 1')
}

test('a generated placeholder is renamed and described in place, ending with exactly the named steps', async () => {
  const fixture = scenarioFixture()
  try {
    const dry = await runChangeset(generatedBatch, 'dry-run', fixture.database)
    expect(dry.failures).toEqual([])
    expect(dry.diff.find((entry) => entry.key === 'build-step')).toMatchObject({ before: { name: 'Step 1' }, after: { name: 'Build report' }, deferred: expect.any(String) })
    expect(fixture.requests.every(({ method }) => ['GET', 'HEAD'].includes(method))).toBe(true)
    expect((await runChangeset(generatedBatch, 'verify', fixture.database)).ok).toBe(false)

    const applied = await runChangeset(generatedBatch, 'apply', fixture.database)
    expect(applied.failures).toEqual([])
    expect(applied.applied.map((entry) => entry.key)).toEqual(generatedBatch.operations.map((op) => op.key))
    expect(scenarioSteps(fixture.tables, 'Fixture Report')).toEqual(['Build report', 'Receive email', 'Read report'])
    expect(fixture.tables.steps.some((row) => row.name === 'Step 1')).toBe(false)
    expect(fixture.tables.steps.find((row) => row.name === 'Build report').summary).toBe('Records feed the report.')
    const rename = fixture.tables.authoring_changes.filter((row) => row.fn === 'rename_step')
    expect(rename).toHaveLength(1)
    expect(rename[0].revert).toMatchObject({ fn: 'rename_step', args: { expected_name: 'Build report', new_name: 'Step 1' } })
    expect(fixture.tables.evidence).toHaveLength(1)
    expect(fixture.requests.some(({ method }) => method === 'DELETE')).toBe(false)
    expect((await runChangeset(generatedBatch, 'verify', fixture.database, { receipt: applied.applied })).failures).toEqual([])
  } finally { fixture.database.close() }
})

const renameRefusals = [
  ['a placeholder renamed by someone else', 'step-2', (tables) => { placeholder(tables).name = 'Column 1' },
    'build-step: build-step.name: expected "Step 1", found "Column 1"; no write attempted for this operation; batch stopped'],
  ['a placeholder moved to another scenario', 'step-2', (tables) => { placeholder(tables).scenario_id = 'f1000000-0000-4000-8000-000000000002' },
    'build-step: Generated target is not in scenario scenario created by this batch; no write attempted for this operation; batch stopped'],
  ['no membership at position 0', 'step-2', (tables) => { tables.path_steps.splice(tables.path_steps.findIndex((link) => link.step_id === placeholder(tables).id), 1) },
    'expected exactly one row, found 0; batch stopped'],
  ['two memberships at position 0', 'step-2', (tables) => {
    const link = tables.path_steps.find((row) => row.step_id === placeholder(tables).id)
    tables.path_steps.push({ ...link, step_id: id })
  }, 'expected exactly one row, found 2; batch stopped'],
  ['a membership row whose step is gone', 'step-2', (tables) => { tables.path_steps.find((row) => row.step_id === placeholder(tables).id).step_id = 'f1000000-0000-4000-8000-00000000dead' },
    'build-step: Generated target resolved to 0 rows; no write attempted for this operation; batch stopped'],
  ['a membership the review did not list', 'step-2', (tables) => { tables.path_steps.push({ path_id: 'f1000000-0000-4000-8000-000000000003', step_id: placeholder(tables).id, position: 4 }) },
    'build-step: Shared step memberships differ from the reviewed expected paths; batch stopped'],
]
test.each(renameRefusals)('%s stops the batch with its reason, before the rename is sent', async (_name, key, change, reason) => {
  const fixture = scenarioFixture()
  after(fixture, key, change)
  try {
    const applied = await runChangeset(generatedBatch, 'apply', fixture.database)
    expect(applied.ok).toBe(false)
    expect(applied.failures).toHaveLength(1)
    expect(applied.failures[0]).toContain(reason)
    expect(fixture.requests.some(({ path }) => path.endsWith('/rpc/rename_step'))).toBe(false)
    expect(applied.applied.map((entry) => entry.key)).toEqual(['scenario', 'step-1', 'step-2'])
  } finally { fixture.database.close() }
})

test('an existing step reached through a new cell fails dry-run and apply with no write', async () => {
  const fixture = sharedStepFixture()
  fixture.tables.phases.push({ id: PHASE })
  const batch = { version: 1, issue: 759, operations: [generatedBatch.operations[0], ...insertBatch.operations, {
    key: 'rename', operation: 'rename_step',
    target: { table: 'steps', id: { lookup: { table: 'cells', where: { id: { ref: 'insert' } } }, field: 'step_id' } },
    input: { expected_path_steps: renameBatch.operations[0].input.expected_path_steps },
    expected: { name: 'A stale name', scenario_id: { ref: 'scenario' } }, value: { name: 'New step' }, evidence: ['Fixture source'],
  }] }
  const reason = 'rename: deferred target is reached through insert, not only through scenario scenario; an existing row cannot be deferred'
  try {
    const dry = await runChangeset(batch, 'dry-run', fixture.database)
    expect(dry.failures).toEqual([reason])
    const applied = await runChangeset(batch, 'apply', fixture.database)
    expect(applied.failures).toEqual([reason])
    expect(applied.applied).toEqual([])
    expect(fixture.requests.every(({ method }) => ['GET', 'HEAD'].includes(method))).toBe(true)
    expect(fixture.tables.steps[0].name).toBe('Old step')
    expect(fixture.tables.cells).toHaveLength(1)
  } finally { fixture.database.close() }
})

test('the posted Weekly Class Report changeset passes dry-run against the fixture board', async () => {
  const weeklyReport = JSON.parse(readFileSync(new URL('../../changesets/0759-weekly-class-report.json', import.meta.url), 'utf8'))
  const fixture = scenarioFixture()
  try {
    const dry = await runChangeset(weeklyReport, 'dry-run', fixture.database)
    expect(dry.failures).toEqual([])
    expect(dry.diff).toHaveLength(weeklyReport.operations.length)
    expect(fixture.requests.every(({ method }) => ['GET', 'HEAD'].includes(method))).toBe(true)
  } finally { fixture.database.close() }
})

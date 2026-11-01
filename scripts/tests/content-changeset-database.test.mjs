import { test, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { modules } from '../../deployment/lib/contentChangesetModules.ts'
import { createDatabase } from '../changesets/database.mjs'
import { readFileSync } from 'node:fs'
import { runChangeset, validateChangeset } from '../content-changeset.mjs'

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
    if (url.pathname.endsWith('/rpc/create_path_at_status')) {
      // The hosted RPC: copies the source path's lanes and step memberships
      // with their positions, and records itself with a delete_path inverse.
      const pathId = uuid('81000000')
      tables.paths.push({ id: pathId, scenario_id: body.scenario_id, name: body.name, kind: body.kind ?? 'variant', status: body.status, summary: null, note: null })
      for (const lane of tables.lanes.filter((row) => row.path_id === body.lane_source_path_id))
        tables.lanes.push({ id: uuid('81000000'), path_id: pathId, name: lane.name, lane_role: lane.lane_role, position: lane.position })
      for (const link of tables.path_steps.filter((row) => row.path_id === body.lane_source_path_id).sort((a, b) => a.position - b.position))
        tables.path_steps.push({ path_id: pathId, step_id: link.step_id, position: link.position })
      tables.authoring_changes.push({ id: uuid('51000000'), fn: 'create_path_at_status', author: 'human',
        args: { ...body, path_id: pathId }, revert: { fn: 'delete_path', args: { path_id: pathId } } })
      return answer(pathId)
    }
    if (url.pathname.endsWith('/rpc/set_path_steps')) {
      // Deletes memberships not in the list, then upserts each at its index.
      tables.path_steps = [
        ...tables.path_steps.filter((row) => row.path_id !== body.path_id),
        ...body.step_ids.map((step_id, position) => ({ path_id: body.path_id, step_id, position })),
      ]
      return answer(null)
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
    if (url.pathname.endsWith('/rpc/set_cell_dependency')) {
      // The hosted RPC since the one-service rule: cell → path → scenario →
      // phase → service on both ends, then an upsert on (source, target, kind)
      // that reports which half it took and the row as it stood.
      const serviceOf = (cellId) => {
        const cell = tables.cells.find((row) => row.id === cellId)
        const path = tables.paths.find((row) => row.id === cell?.path_id)
        const scenario = tables.scenarios.find((row) => row.id === path?.scenario_id)
        return tables.phases.find((row) => row.id === scenario?.phase_id)?.service_id
      }
      if (body.source_cell_id === body.target_cell_id) return answer({ message: 'A cell cannot depend on itself', code: 'P0001' }, 400)
      const [sourceService, targetService] = [serviceOf(body.source_cell_id), serviceOf(body.target_cell_id)]
      if (!sourceService || !targetService) return answer({ message: 'Both cells must exist', code: 'P0001' }, 400)
      if (sourceService !== targetService) return answer({ message: 'Both cells must be in the same service', code: 'P0001' }, 400)
      const existing = tables.cell_dependencies.find((row) => row.source_cell_id === body.source_cell_id
        && row.target_cell_id === body.target_cell_id && row.kind === body.kind)
      if (existing) {
        const previous = { ...existing }
        existing.name = body.name ?? existing.name
        existing.note = body.note ?? existing.note
        return answer({ id: existing.id, inserted: false, previous })
      }
      const row = { id: uuid('90000000'), source_cell_id: body.source_cell_id, target_cell_id: body.target_cell_id, kind: body.kind, name: body.name, note: body.note }
      tables.cell_dependencies.push(row)
      return answer({ id: row.id, inserted: true, previous: null })
    }
    if (url.pathname.endsWith('/rpc/create_path_at_status')) {
      // The hosted RPC: a path at its status, lanes and step order copied from
      // the source path, and its own durable row with a delete_path inverse.
      const pathId = uuid('a1000000')
      tables.paths.push({ id: pathId, scenario_id: body.scenario_id, name: body.name, kind: body.kind ?? 'variant', status: body.status, summary: null, note: null })
      for (const lane of tables.lanes.filter((row) => row.path_id === body.lane_source_path_id))
        tables.lanes.push({ id: uuid('a2000000'), path_id: pathId, name: lane.name, lane_role: lane.lane_role, position: lane.position })
      for (const link of tables.path_steps.filter((row) => row.path_id === body.lane_source_path_id))
        tables.path_steps.push({ path_id: pathId, step_id: link.step_id, position: link.position })
      tables.authoring_changes.push({ id: uuid('50000000'), fn: 'create_path_at_status', author: 'human',
        args: { scenario_id: body.scenario_id, name: body.name, kind: body.kind, status: body.status, lane_source_path_id: body.lane_source_path_id, path_id: pathId },
        revert: { fn: 'delete_path', args: { path_id: pathId } } })
      return answer(pathId)
    }
    if (url.pathname.endsWith('/rpc/update_cell_dependency')) {
      // The hosted RPC: edits one row where it sits (kind, target, note),
      // keeps the one-service rule, refuses a duplicate of another row, and
      // returns the row as it stood for the self-inverse.
      const serviceOf = (cellId) => {
        const cell = tables.cells.find((row) => row.id === cellId)
        const path = tables.paths.find((row) => row.id === cell?.path_id)
        const scenario = tables.scenarios.find((row) => row.id === path?.scenario_id)
        return tables.phases.find((row) => row.id === scenario?.phase_id)?.service_id
      }
      const row = tables.cell_dependencies.find((edge) => edge.id === body.dependency_id)
      if (!row) return answer({ message: 'That connection no longer exists', code: 'P0001' }, 400)
      if (!['leads_to', 'enables'].includes(body.kind)) return answer({ message: 'Unknown dependency kind', code: 'P0001' }, 400)
      if (row.source_cell_id === body.target_cell_id) return answer({ message: 'A cell cannot depend on itself', code: 'P0001' }, 400)
      const [sourceService, targetService] = [serviceOf(row.source_cell_id), serviceOf(body.target_cell_id)]
      if (!sourceService || !targetService) return answer({ message: 'Both cells must exist', code: 'P0001' }, 400)
      if (sourceService !== targetService) return answer({ message: 'Both cells must be in the same service', code: 'P0001' }, 400)
      if (tables.cell_dependencies.some((edge) => edge.id !== row.id && edge.source_cell_id === row.source_cell_id
        && edge.target_cell_id === body.target_cell_id && edge.kind === body.kind))
        return answer({ message: 'That connection already exists', code: 'P0001' }, 400)
      const previous = { id: row.id, source_cell_id: row.source_cell_id, target_cell_id: row.target_cell_id, kind: row.kind, note: row.note }
      Object.assign(row, { target_cell_id: body.target_cell_id, kind: body.kind, note: body.note?.trim() || null })
      return answer(previous)
    }
    // The three hosted deletes: each archives what it destroys into the log
    // (fn, deleted_kind, payload; no args, no inverse) in the transaction that
    // cascades, and returns that row's id.
    const archive = (fn, kind, payload) => {
      const changeId = uuid('52000000')
      tables.authoring_changes.push({ id: changeId, fn, args: {}, revert: null, author: 'human', deleted_kind: kind, payload })
      return changeId
    }
    const dropCells = (doomed) => {
      const ids = new Set(doomed.map((row) => row.id))
      tables.cells = tables.cells.filter((row) => !ids.has(row.id))
      tables.cell_dependencies = tables.cell_dependencies.filter((row) => !ids.has(row.source_cell_id) && !ids.has(row.target_cell_id))
      tables.cell_touchpoints = tables.cell_touchpoints.filter((row) => !ids.has(row.cell_id))
      tables.resources = tables.resources.filter((row) => !ids.has(row.cell_id))
      // evidence has no foreign key to cells: its rows outlive the cell.
    }
    if (url.pathname.endsWith('/rpc/delete_cell')) {
      const row = tables.cells.find((cell) => cell.id === body.cell_id)
      if (!row) return answer({ message: 'Unknown cell', code: 'P0001' }, 400)
      const changeId = archive('delete_cell', 'cell', { cell: { ...row } })
      dropCells([row])
      return answer(changeId)
    }
    if (url.pathname.endsWith('/rpc/remove_step')) {
      const step = tables.steps.find((row) => row.id === body.step_id)
      const doomed = tables.cells.filter((row) => row.step_id === body.step_id && row.path_id === body.path_id)
      const changeId = archive('remove_step', 'step', { step: { ...step }, path_id: body.path_id, cells: doomed.map((row) => ({ ...row })) })
      dropCells(doomed)
      tables.path_steps = tables.path_steps.filter((row) => !(row.step_id === body.step_id && row.path_id === body.path_id))
      if (!tables.path_steps.some((row) => row.step_id === body.step_id)) tables.steps = tables.steps.filter((row) => row.id !== body.step_id)
      // The renumbering UPDATE touches every row left on the path, and its
      // trigger rewrites updated_at on each one.
      tables.path_steps.filter((row) => row.path_id === body.path_id).sort((a, b) => a.position - b.position)
        .forEach((row, position) => { Object.assign(row, { position, updated_at: '2026-11-01T17:00:00Z' }) })
      return answer(changeId)
    }
    if (url.pathname.endsWith('/rpc/remove_lanes')) {
      const lanes = tables.lanes.filter((row) => body.lane_ids.includes(row.id))
      if (!lanes.length) return answer({ message: 'Those lanes no longer exist', code: 'P0001' }, 400)
      const doomed = tables.cells.filter((row) => body.lane_ids.includes(row.lane_id))
      const changeId = archive('remove_lanes', 'lane', { lane_ids: body.lane_ids, lane_name: lanes[0].name, lanes: lanes.map((row) => ({ ...row })), cells: doomed.map((row) => ({ ...row })) })
      dropCells(doomed)
      tables.lanes = tables.lanes.filter((row) => !body.lane_ids.includes(row.id))
      return answer(changeId)
    }
    if (url.pathname.endsWith('/rpc/remove_lane')) throw new Error('remove_lane deletes by name across a scenario; the runner must not call it')
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

// Two scenarios of one service, in different phases, and a third scenario in
// another service: the shapes a cross-scenario link has to tell apart.
const LINK = {
  services: ['c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002'],
  source: { phase: 'c2000000-0000-4000-8000-000000000001', scenario: 'c3000000-0000-4000-8000-000000000001', path: 'c4000000-0000-4000-8000-000000000001', lane: 'c5000000-0000-4000-8000-000000000001', step: 'c6000000-0000-4000-8000-000000000001', cell: 'c7000000-0000-4000-8000-000000000001' },
  target: { phase: 'c2000000-0000-4000-8000-000000000002', scenario: 'c3000000-0000-4000-8000-000000000002', path: 'c4000000-0000-4000-8000-000000000002', lane: 'c5000000-0000-4000-8000-000000000002', step: 'c6000000-0000-4000-8000-000000000002', cell: 'c7000000-0000-4000-8000-000000000002' },
  foreign: { phase: 'c2000000-0000-4000-8000-000000000003', scenario: 'c3000000-0000-4000-8000-000000000003', path: 'c4000000-0000-4000-8000-000000000003', lane: 'c5000000-0000-4000-8000-000000000003', step: 'c6000000-0000-4000-8000-000000000003', cell: 'c7000000-0000-4000-8000-000000000003' },
}
function linkFixture(options) {
  const fixture = databaseFixture(options)
  const { tables } = fixture
  tables.services.push(...LINK.services.map((service) => ({ id: service })))
  for (const [name, end] of Object.entries({ source: LINK.source, target: LINK.target, foreign: LINK.foreign })) {
    tables.phases.push({ id: end.phase, service_id: LINK.services[name === 'foreign' ? 1 : 0] })
    tables.scenarios.push({ id: end.scenario, phase_id: end.phase, name: `${name} scenario` })
    tables.paths.push({ id: end.path, scenario_id: end.scenario, name: `${name} path` })
    tables.lanes.push({ id: end.lane, path_id: end.path, name: 'Lane' })
    tables.steps.push({ id: end.step, scenario_id: end.scenario, name: `${name} step` })
    tables.cells.push({ id: end.cell, path_id: end.path, lane_id: end.lane, step_id: end.step, position: 0, content: `${name} cell`, status: 'live', cell_key: null })
  }
  return fixture
}
const endpoint = (end, content) => ({ path_id: end.path, lane_id: end.lane, step_id: end.step, scenario_id: end.scenario, content })
const linkBatch = (to = LINK.target, input = {}) => ({ version: 1, issue: 758, operations: [{
  key: 'link', operation: 'set_cell_dependency',
  target: { table: 'cell_dependencies', where: { source_cell_id: LINK.source.cell, target_cell_id: to.cell, kind: 'leads_to' } },
  expected: null, value: { kind: 'leads_to', note: 'The report continues in its own scenario.' },
  input: { expected_source: endpoint(LINK.source, 'source cell'), expected_target: endpoint(to, to === LINK.foreign ? 'foreign cell' : 'target cell'), ...input },
  evidence: ['Fixture source'],
}], checks: [{ target: { table: 'cell_dependencies', where: { source_cell_id: LINK.source.cell } }, beforeCount: 0, afterCount: 1 }] })

test('a link across scenarios of one service is guarded, recorded with its clear inverse and verified separately', async () => {
  const fixture = linkFixture()
  const batch = linkBatch()
  try {
    expect((await runChangeset(batch, 'verify', fixture.database)).ok).toBe(false)
    const dry = await runChangeset(batch, 'dry-run', fixture.database)
    expect(dry.failures).toEqual([])
    expect(fixture.requests.every(({ method }) => ['GET', 'HEAD'].includes(method))).toBe(true)
    expect(dry.diff[0].endpoints).toEqual({
      service_id: LINK.services[0],
      source: { cell_id: LINK.source.cell, ...endpoint(LINK.source, 'source cell') },
      target: { cell_id: LINK.target.cell, ...endpoint(LINK.target, 'target cell') },
    })
    const applied = await runChangeset(batch, 'apply', fixture.database)
    expect(applied.failures).toEqual([])
    expect(fixture.tables.cell_dependencies).toEqual([expect.objectContaining({
      source_cell_id: LINK.source.cell, target_cell_id: LINK.target.cell, kind: 'leads_to', note: 'The report continues in its own scenario.',
    })])
    const dependencyId = fixture.tables.cell_dependencies[0].id
    expect(fixture.tables.authoring_changes).toEqual([expect.objectContaining({
      fn: 'set_cell_dependency', author: 'human', revert: { fn: 'clear_cell_dependency', args: { dependency_id: dependencyId } },
    })])
    expect((await runChangeset(batch, 'verify', fixture.database, { receipt: applied.applied })).failures).toEqual([])
  } finally { fixture.database.close() }
})

const linkRefusals = [
  ['a cross-service link', () => linkBatch(LINK.foreign), /same service; a cross-service link is refused/],
  ['a source moved since review', () => linkBatch(LINK.target, { expected_source: { ...endpoint(LINK.source, 'source cell'), lane_id: LINK.target.lane } }), /source cell no longer matches the reviewed endpoint: lane_id/],
  ['a target in another scenario than reviewed', () => linkBatch(LINK.target, { expected_target: { ...endpoint(LINK.target, 'target cell'), scenario_id: LINK.source.scenario } }), /target cell no longer matches the reviewed endpoint: scenario_id/],
  ['a missing reviewed endpoint', () => linkBatch(LINK.target, { expected_target: undefined }), /requires input.expected_source and input.expected_target/],
  ['an endpoint without its path and scenario', () => linkBatch(LINK.target, { expected_source: { lane_id: LINK.source.lane } }), /expected_source must name path_id, lane_id, step_id and scenario_id/],
]
test.each(linkRefusals)('%s is refused at dry-run and apply before any write', async (_name, batch, reason) => {
  const fixture = linkFixture()
  try {
    const dry = await runChangeset(batch(), 'dry-run', fixture.database)
    expect(dry.ok).toBe(false)
    expect(dry.failures.join('\n')).toMatch(reason)
    const applied = await runChangeset(batch(), 'apply', fixture.database)
    expect(applied.failures.join('\n')).toMatch(reason)
    expect(applied.applied).toEqual([])
    expect(fixture.requests.every(({ method }) => ['GET', 'HEAD'].includes(method))).toBe(true)
    expect(fixture.tables.cell_dependencies).toEqual([])
  } finally { fixture.database.close() }
})

test('a link that lands on an edge created since preflight is refused, not claimed as an insert', async () => {
  const fixture = linkFixture()
  const write = fixture.database.write
  fixture.database.write = async (...args) => {
    fixture.tables.cell_dependencies.push({ id: '90000000-0000-4000-8000-000000000999', source_cell_id: LINK.source.cell,
      target_cell_id: LINK.target.cell, kind: 'leads_to', name: null, note: 'A concurrent note.' })
    return write(...args)
  }
  try {
    const applied = await runChangeset(linkBatch(), 'apply', fixture.database)
    expect(applied.ok).toBe(false)
    expect(applied.failures.join('\n')).toMatch(/updated an existing edge instead of inserting one/)
    expect(applied.applied).toEqual([])
    expect(applied.failedAttempt.key).toBe('link')
  } finally { fixture.database.close() }
})

test('the posted Goal Setting to Weekly Class Report link dry-runs, applies with one clear inverse and verifies on the fixture board', async () => {
  const posted = JSON.parse(readFileSync(new URL('../../changesets/0758-weekly-class-report-link.json', import.meta.url), 'utf8'))
  const [link, linkEvidence] = posted.operations
  const fixture = databaseFixture()
  const { tables } = fixture
  // Goal Setting sits in In-session and Weekly Class Report in Program
  // Administration: two phases, one service.
  tables.services.push({ id: SERVICE })
  for (const [phase, end, cellId] of [
    ['a0000000-0000-4000-8000-000000000104', link.input.expected_source, link.target.where.source_cell_id],
    [PHASE, link.input.expected_target, link.target.where.target_cell_id],
  ]) {
    tables.phases.push({ id: phase, service_id: SERVICE })
    tables.scenarios.push({ id: end.scenario_id, phase_id: phase })
    tables.paths.push({ id: end.path_id, scenario_id: end.scenario_id })
    tables.lanes.push({ id: end.lane_id, path_id: end.path_id })
    tables.steps.push({ id: end.step_id, scenario_id: end.scenario_id })
    const { scenario_id: _scenario, ...cell } = end
    tables.cells.push({ cell_key: null, ...cell, id: cellId })
  }
  for (const check of posted.checks.filter(({ target }) => target.table === 'evidence'))
    tables.evidence.push(...check.beforeRows.map((row) => ({ ...row, cell_id: check.target.where.cell_id })))
  try {
    const dry = await runChangeset(posted, 'dry-run', fixture.database)
    expect(dry.failures).toEqual([])
    expect(fixture.requests.every(({ method }) => ['GET', 'HEAD'].includes(method))).toBe(true)
    const applied = await runChangeset(posted, 'apply', fixture.database)
    expect(applied.failures).toEqual([])
    expect(tables.cell_dependencies).toHaveLength(1)
    expect(tables.authoring_changes.map(({ fn, revert }) => [fn, revert.fn])).toEqual([
      ['set_cell_dependency', 'clear_cell_dependency'], ['add_evidence', expect.any(String)],
    ])
    expect(tables.evidence.filter((row) => row.cell_id === linkEvidence.target.where.cell_id)).toHaveLength(2)
    expect((await runChangeset(posted, 'verify', fixture.database, { receipt: applied.applied })).failures).toEqual([])
  } finally { fixture.database.close() }
})

// An existing edge between two scenarios of one service, retyped in place.
const EDGE = '90000000-0000-4000-8000-0000000000e1'
function retypeFixture(edge = {}) {
  const fixture = linkFixture()
  fixture.tables.cell_dependencies.push({ id: EDGE, source_cell_id: LINK.source.cell, target_cell_id: LINK.target.cell, kind: 'leads_to', name: null, note: null, ...edge })
  return fixture
}
const retypeBatch = (input = {}, value = { kind: 'enables', note: 'Finishing onboarding unlocks sign-up; it is not a handoff.' }) => ({ version: 1, issue: 743, operations: [{
  key: 'retype', operation: 'update_cell_dependency', target: { table: 'cell_dependencies', id: EDGE },
  expected: { source_cell_id: LINK.source.cell, target_cell_id: LINK.target.cell, kind: 'leads_to', note: null }, value,
  input: { expected_source: endpoint(LINK.source, 'source cell'), expected_target: endpoint(LINK.target, 'target cell'), ...input },
  evidence: ['Fixture source'],
}], checks: [{ target: { table: 'cell_dependencies', where: { source_cell_id: LINK.source.cell } }, beforeCount: 1, afterCount: 1,
  beforeRows: [{ id: EDGE, kind: 'leads_to' }], afterRows: [{ id: EDGE, kind: value.kind }] }] })

test('an edge is retyped in place with its self-inverse, keeps its identity and verifies separately', async () => {
  const fixture = retypeFixture()
  const batch = retypeBatch()
  try {
    expect((await runChangeset(batch, 'verify', fixture.database)).ok).toBe(false)
    const dry = await runChangeset(batch, 'dry-run', fixture.database)
    expect(dry.failures).toEqual([])
    expect(fixture.requests.every(({ method }) => ['GET', 'HEAD'].includes(method))).toBe(true)
    expect(dry.diff[0]).toMatchObject({ before: { kind: 'leads_to', note: null }, after: batch.operations[0].value })
    expect(dry.diff[0].endpoints).toMatchObject({ service_id: LINK.services[0], source: { cell_id: LINK.source.cell }, target: { cell_id: LINK.target.cell } })
    const applied = await runChangeset(batch, 'apply', fixture.database)
    expect(applied.failures).toEqual([])
    expect(fixture.tables.cell_dependencies).toEqual([expect.objectContaining({
      id: EDGE, source_cell_id: LINK.source.cell, target_cell_id: LINK.target.cell, kind: 'enables', note: 'Finishing onboarding unlocks sign-up; it is not a handoff.',
    })])
    expect(fixture.tables.authoring_changes).toEqual([expect.objectContaining({
      fn: 'update_cell_dependency', author: 'human',
      args: { dependency_id: EDGE, kind: 'enables', target_cell_id: LINK.target.cell, note: 'Finishing onboarding unlocks sign-up; it is not a handoff.' },
      revert: { fn: 'update_cell_dependency', args: { dependency_id: EDGE, kind: 'leads_to', target_cell_id: LINK.target.cell, note: null } },
    })])
    expect((await runChangeset(batch, 'verify', fixture.database, { receipt: applied.applied })).failures).toEqual([])
  } finally { fixture.database.close() }
})

const retypeRefusals = [
  ['a retype that changes nothing', () => retypeFixture(), () => retypeBatch({}, { kind: 'leads_to', note: null }), /would write no change/],
  ['a retype onto an edge that already exists', () => {
    const fixture = retypeFixture()
    fixture.tables.cell_dependencies.push({ id: '90000000-0000-4000-8000-0000000000e2', source_cell_id: LINK.source.cell, target_cell_id: LINK.target.cell, kind: 'enables', name: null, note: null })
    return fixture
  }, () => retypeBatch(), /an enables edge already joins these cells/i],
  ['a source moved since review', () => retypeFixture(), () => retypeBatch({ expected_source: { ...endpoint(LINK.source, 'source cell'), lane_id: LINK.target.lane } }), /source cell no longer matches the reviewed endpoint: lane_id/],
  ['a missing reviewed endpoint', () => retypeFixture(), () => retypeBatch({ expected_target: undefined }), /requires input.expected_source and input.expected_target/],
]
test.each(retypeRefusals)('%s is refused at dry-run and apply before any write', async (_name, seed, batch, reason) => {
  const fixture = seed()
  const edges = structuredClone(fixture.tables.cell_dependencies)
  try {
    const dry = await runChangeset(batch(), 'dry-run', fixture.database)
    expect(dry.failures.join('\n')).toMatch(reason)
    const applied = await runChangeset(batch(), 'apply', fixture.database)
    expect(applied.failures.join('\n')).toMatch(reason)
    expect(applied.applied).toEqual([])
    expect(fixture.requests.every(({ method }) => ['GET', 'HEAD'].includes(method))).toBe(true)
    expect(fixture.tables.cell_dependencies).toEqual(edges)
  } finally { fixture.database.close() }
})

test('a retype refuses an edge that changed between preflight and write', async () => {
  const fixture = retypeFixture()
  const prepare = fixture.database.prepare
  let calls = 0
  fixture.database.prepare = async (...args) => {
    const prepared = await prepare(...args)
    if (++calls === 1) fixture.tables.cell_dependencies[0].note = 'A concurrent note.'
    return prepared
  }
  try {
    const applied = await runChangeset(retypeBatch(), 'apply', fixture.database)
    expect(applied.ok).toBe(false)
    expect(applied.failures.join('\n')).toMatch(/Target changed since preflight/)
    expect(applied.applied).toEqual([])
    expect(fixture.tables.cell_dependencies[0]).toMatchObject({ kind: 'leads_to', note: 'A concurrent note.' })
    expect(fixture.tables.authoring_changes).toEqual([])
  } finally { fixture.database.close() }
})

test('the posted Onboarding batch dry-runs read-only, applies with one inverse per write and verifies on its board snapshot', async () => {
  const posted = JSON.parse(readFileSync(new URL('../../changesets/0743-a-onboarding-behaviour.json', import.meta.url), 'utf8'))
  const board = JSON.parse(readFileSync(new URL('./fixtures/0743-onboarding-board.json', import.meta.url), 'utf8'))
  const fixture = databaseFixture()
  const { tables } = fixture
  // The read-only snapshot of the five touched scenarios on 2026-11-01.
  for (const table of ['cells', 'paths', 'lanes', 'steps']) tables[table] = []
  for (const [table, rows] of Object.entries(board)) tables[table].push(...structuredClone(rows))
  tables.services.push({ id: SERVICE })
  try {
    const dry = await runChangeset(posted, 'dry-run', fixture.database)
    expect(dry.failures).toEqual([])
    expect(fixture.requests.every(({ method }) => ['GET', 'HEAD'].includes(method))).toBe(true)
    const applied = await runChangeset(posted, 'apply', fixture.database)
    expect(applied.failures).toEqual([])
    expect(applied.applied.map(({ key }) => key)).toEqual(posted.operations.map(({ key }) => key))
    // Every durable row carries an inverse; nothing is ever deleted.
    expect(tables.authoring_changes.every(({ revert }) => revert?.fn)).toBe(true)
    expect(tables.authoring_changes.filter(({ fn }) => fn === 'update_cell_dependency')).toHaveLength(1)
    const edge = tables.cell_dependencies.find(({ id }) => id === '9aeb3883-1ec5-4c23-9305-2a339d311af6')
    expect(edge).toMatchObject({ kind: 'enables', source_cell_id: 'a0000000-0000-4000-8000-000000110703', target_cell_id: 'a0000000-0000-4000-8000-000000130103' })
    expect(tables.cell_dependencies.filter(({ source_cell_id, target_cell_id }) => source_cell_id === edge.source_cell_id && target_cell_id === edge.target_cell_id)).toHaveLength(1)
    expect(tables.paths.filter(({ kind }) => kind === 'exception').map(({ name, status }) => [name, status])).toEqual([['AI returns no feedback', 'live'], ['Onboarding incomplete', 'live']])
    expect(tables.cells.length).toBe(board.cells.length + 12)
    expect((await runChangeset(posted, 'verify', fixture.database, { receipt: applied.applied })).failures).toEqual([])
  } finally { fixture.database.close() }
})

test('a retype whose durable append fails stops with the append error', async () => {
  const fixture = linkFixture({ failAppend: true })
  fixture.tables.cell_dependencies.push({ id: EDGE, source_cell_id: LINK.source.cell, target_cell_id: LINK.target.cell, kind: 'leads_to', name: null, note: null })
  try {
    const applied = await runChangeset(retypeBatch(), 'apply', fixture.database)
    expect(applied.ok).toBe(false)
    expect(applied.failures.join('\n')).toMatch(/Durable append failed after write: Audit append refused/)
  } finally { fixture.database.close() }
})

test('a new path’s copied step list is trimmed in place by a deferred set_path_steps and verified with its inverse', async () => {
  const fixture = databaseFixture()
  const { tables } = fixture
  const scenario = '82000000-0000-4000-8000-000000000001'
  const source = '82000000-0000-4000-8000-000000000002'
  const [need, file, cover, review, late] = [3, 4, 5, 6, 7].map((n) => `82000000-0000-4000-8000-00000000000${n}`)
  tables.scenarios.push({ id: scenario, name: 'Call-off Request' })
  tables.paths.push({ id: source, scenario_id: scenario, name: '12+ hours ahead', kind: 'happy', status: 'live' })
  tables.lanes.push({ id: '82000000-0000-4000-8000-000000000010', path_id: source, name: 'Regular Tutor', lane_role: 'customer_actions', position: 1 })
  ;[need, file, cover, review, late].forEach((step_id, index) => tables.path_steps.push({ path_id: source, step_id, position: index + 1 }))
  const batch = { version: 1, issue: 744, operations: [{
    key: 'path', operation: 'create_path_at_status', target: { table: 'paths', where: { scenario_id: scenario, name: 'Recurring withdrawal' } },
    expected: null, value: { kind: 'variant', status: 'live' }, input: { lane_source_path_id: source }, evidence: ['TE2a'],
  }, {
    key: 'trim', operation: 'set_path_steps', target: { table: 'paths', id: { ref: 'path' }, withSteps: true },
    expected: { scenario_id: scenario, step_ids: [need, file, cover, review, late] }, value: { step_ids: [need, file, review, cover] }, evidence: ['TE2a'],
  }], checks: [{ target: { table: 'path_steps', where: { path_id: source } }, beforeCount: 5, afterCount: 5 }] }
  try {
    expect((await runChangeset(batch, 'dry-run', fixture.database)).failures).toEqual([])
    const applied = await runChangeset(batch, 'apply', fixture.database)
    expect(applied.failures).toEqual([])
    const created = tables.paths.find((row) => row.name === 'Recurring withdrawal')
    expect(tables.path_steps.filter((row) => row.path_id === created.id).map((row) => row.step_id)).toEqual([need, file, review, cover])
    expect(tables.path_steps.filter((row) => row.path_id === source)).toHaveLength(5)
    const trimLog = tables.authoring_changes.find((row) => row.fn === 'set_path_steps')
    expect(trimLog.revert).toEqual({ fn: 'set_path_steps', args: { path_id: created.id, step_ids: [need, file, cover, review, late] } })
    expect((await runChangeset(batch, 'verify', fixture.database, { receipt: applied.applied })).failures).toEqual([])
  } finally { fixture.database.close() }
})

// Owner-approved deletes: a cell, one path's membership of a shared step, and
// one lane by id. Each RPC archives what it destroys into the log; the runner
// guards what it may destroy and records what went with it.
const laterStep = '10000000-0000-4000-8000-000000000003'
const otherLane = '10000000-0000-4000-8000-000000000004'
const neighbour = '10000000-0000-4000-8000-000000000005'
function deleteFixture() {
  const fixture = sharedStepFixture()
  const { tables } = fixture
  tables.steps.push({ id: laterStep, scenario_id: id, name: 'Later step' })
  tables.path_steps.push({ path_id: id, step_id: laterStep, position: 1, updated_at: '2026-06-18T00:00:00Z' })
  tables.lanes.push({ id: secondPath, path_id: secondPath, name: 'Lead Tutor' }, { id: otherLane, path_id: id, name: 'Lead Tutor' })
  Object.assign(tables.lanes[0], { name: 'Teacher' })
  tables.cells.push(
    { id: neighbour, path_id: id, lane_id: id, step_id: laterStep, position: 0, content: 'Keeps its place', status: 'live' },
    { id: secondPath, path_id: secondPath, lane_id: secondPath, step_id: id, position: 0, content: 'Stays on the other path', status: 'live' },
  )
  tables.cell_dependencies.push({ id: laterStep, source_cell_id: id, target_cell_id: neighbour, kind: 'leads_to', name: null, note: null })
  return fixture
}
const deleteCellOp = {
  key: 'delete', operation: 'delete_cell', target: { table: 'cells', id },
  expected: { status: seed.status, content: seed.content, path_id: id, lane_id: id, step_id: id, position: 0 },
  value: { deleted: true }, evidence: ['Owner request'],
}
const removeStepOp = {
  key: 'membership', operation: 'remove_step', target: { table: 'path_steps', where: { path_id: id, step_id: id } },
  expected: { position: 0 }, value: { deleted: true }, evidence: ['Owner request'],
  input: { expected_path_steps: [{ path_id: id, position: 0 }, { path_id: secondPath, position: 2 }], cells_deleted_earlier: [id] },
}
const removeLaneOp = {
  key: 'lane', operation: 'remove_lane', target: { table: 'lanes', id: otherLane },
  expected: { name: 'Lead Tutor', path_id: id }, value: { deleted: true }, evidence: ['Owner request'],
}

test('a cell delete is guarded, archived to the trash with what it cascaded, and verified separately', async () => {
  const fixture = deleteFixture()
  const batch = { version: 1, issue: 800, operations: [deleteCellOp] }
  try {
    const dry = await runChangeset(batch, 'dry-run', fixture.database)
    expect(dry.failures).toEqual([])
    expect(fixture.requests.every(({ method }) => ['GET', 'HEAD'].includes(method))).toBe(true)
    expect(dry.diff[0].removes).toMatchObject({ dependencies: [laterStep], placements: [id], resources: [id], evidence_kept: [id] })
    expect((await runChangeset(batch, 'verify', fixture.database)).ok).toBe(false)
    const applied = await runChangeset(batch, 'apply', fixture.database)
    expect(applied.failures).toEqual([])
    const { tables } = fixture
    expect(tables.cells.map((row) => row.id)).toEqual([neighbour, secondPath])
    expect(tables.cell_dependencies).toEqual([])
    expect(tables.cell_touchpoints).toEqual([])
    expect(tables.resources).toEqual([])
    expect(tables.evidence).toHaveLength(1)
    expect(tables.authoring_changes).toHaveLength(1)
    expect(tables.authoring_changes[0]).toMatchObject({ fn: 'delete_cell', deleted_kind: 'cell', revert: null })
    expect(applied.applied[0].expectedChanges[0].recovery).toMatch(/trash/)
    expect((await runChangeset(batch, 'verify', fixture.database, { receipt: applied.applied })).failures).toEqual([])
    tables.cells[0].content = 'Unexpected rewrite'
    expect((await runChangeset(batch, 'verify', fixture.database, { receipt: applied.applied })).ok).toBe(false)
  } finally { fixture.database.close() }
})

test('a cell whose status moved since review is never deleted', async () => {
  const fixture = deleteFixture()
  fixture.tables.cells[0].status = 'planned'
  try {
    const result = await runChangeset({ version: 1, issue: 800, operations: [deleteCellOp] }, 'apply', fixture.database)
    expect(result.ok).toBe(false)
    expect(result.failures.join('\n')).toMatch(/delete.status/)
    expect(fixture.tables.cells).toHaveLength(3)
  } finally { fixture.database.close() }
})

test('a step leaves one path only once its column there is empty; the shared step and the other path stay', async () => {
  const fixture = deleteFixture()
  const batch = { version: 1, issue: 800, operations: [deleteCellOp, removeStepOp] }
  try {
    expect((await runChangeset(batch, 'dry-run', fixture.database)).failures).toEqual([])
    const applied = await runChangeset(batch, 'apply', fixture.database)
    expect(applied.failures).toEqual([])
    const { tables } = fixture
    expect(tables.steps.map((row) => row.id)).toContain(id)
    expect(tables.path_steps.filter((row) => row.step_id === id)).toEqual([{ path_id: secondPath, step_id: id, position: 2 }])
    expect(tables.path_steps.find((row) => row.step_id === laterStep)).toMatchObject({ path_id: id, position: 0, updated_at: '2026-11-01T17:00:00Z' })
    expect(tables.cells.find((row) => row.id === secondPath)).toMatchObject({ content: 'Stays on the other path' })
    expect(tables.authoring_changes.map((row) => row.fn)).toEqual(['delete_cell', 'remove_step'])
    expect((await runChangeset(batch, 'verify', fixture.database, { receipt: applied.applied })).failures).toEqual([])
  } finally { fixture.database.close() }
})

test('a step membership is refused while its column holds a cell this batch does not delete', async () => {
  const fixture = deleteFixture()
  try {
    const alone = { ...removeStepOp, input: { ...removeStepOp.input, cells_deleted_earlier: [] } }
    expect(() => validateChangeset({ version: 1, issue: 800, operations: [removeStepOp] })).toThrow(/preceding delete_cell/)
    const result = await runChangeset({ version: 1, issue: 800, operations: [alone] }, 'apply', fixture.database)
    expect(result.ok).toBe(false)
    expect(result.failures.join('\n')).toMatch(/column/)
    expect(fixture.tables.path_steps.filter((row) => row.step_id === id)).toHaveLength(2)
  } finally { fixture.database.close() }
})

test('an empty lane is removed by id; the same-named lane on another path keeps its cells', async () => {
  const fixture = deleteFixture()
  fixture.tables.cells.push({ id: otherLane, path_id: secondPath, lane_id: secondPath, step_id: laterStep, position: 0, content: 'Lead Tutor elsewhere', status: 'live' })
  const batch = { version: 1, issue: 800, operations: [removeLaneOp] }
  try {
    const dry = await runChangeset(batch, 'dry-run', fixture.database)
    expect(dry.failures).toEqual([])
    expect(dry.diff[0].removes.same_name_lanes_kept).toEqual([{ id: secondPath, path_id: secondPath, cells: 2 }])
    const applied = await runChangeset(batch, 'apply', fixture.database)
    expect(applied.failures).toEqual([])
    expect(fixture.tables.lanes.map((row) => row.id)).toEqual([id, secondPath])
    expect(fixture.requests.some(({ path }) => path.endsWith('/rpc/remove_lanes'))).toBe(true)
    expect((await runChangeset(batch, 'verify', fixture.database, { receipt: applied.applied })).failures).toEqual([])
  } finally { fixture.database.close() }
})

test('a lane that holds a cell is never removed', async () => {
  const fixture = deleteFixture()
  fixture.tables.cells.push({ id: otherLane, path_id: id, lane_id: otherLane, step_id: laterStep, position: 0, content: 'Occupies the lane', status: 'live' })
  try {
    const result = await runChangeset({ version: 1, issue: 800, operations: [removeLaneOp] }, 'apply', fixture.database)
    expect(result.ok).toBe(false)
    expect(result.failures.join('\n')).toMatch(/lane holds/)
    expect(fixture.tables.lanes).toHaveLength(3)
  } finally { fixture.database.close() }
})

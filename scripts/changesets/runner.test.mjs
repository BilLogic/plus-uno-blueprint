import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runChangeset } from '../content-changeset.mjs'

const cell = {
  id: '1a79e45e-0000-4000-8000-000000000001',
  content: 'Creates and edits sessions in Admin › Sessions.',
  summary: null,
  status: 'built',
}
const changeset = {
  version: 1,
  issue: 738,
  operations: [{
    key: 'tracer',
    operation: 'update_cell_content',
    target: { table: 'cells', id: '1a79e45e' },
    expected: { content: cell.content, summary: null, status: 'built' },
    value: { content: 'Creates sessions in Admin › Sessions.', summary: 'Card 2451 archived.', status: 'proposed' },
    evidence: ['Notion card 2451'],
  }],
}

// The database boundary is the seam: these reads stand in for PostgREST,
// while the runner's verifier is the same one used against the hosted board.
test('read-back reports the old content and status, then passes only on the complete post-state', async () => {
  let row = { ...cell }
  const database = { read: async () => [row] }
  const before = await runChangeset(changeset, 'verify', database)
  assert.equal(before.ok, false)
  assert.match(before.failures.join('\n'), /status/)
  assert.match(before.failures.join('\n'), /summary/)
  row = { ...row, ...changeset.operations[0].value }
  const after = await runChangeset(changeset, 'verify', database)
  assert.equal(after.ok, true)
  assert.deepEqual(after.failures, [])
})

test('dry-run returns the full before/after diff and performs no writes', async () => {
  const database = {
    read: async () => [{ ...cell }],
    write: async () => assert.fail('dry-run wrote to the database'),
  }
  const result = await runChangeset(changeset, 'dry-run', database)
  assert.equal(result.ok, true)
  assert.deepEqual(result.diff[0], {
    key: 'tracer', operation: 'update_cell_content',
    target: { table: 'cells', id: cell.id },
    before: changeset.operations[0].expected,
    after: changeset.operations[0].value,
    evidence: ['Notion card 2451'],
  })
})

test('a mismatch in the last operation aborts the whole batch before the first write', async () => {
  const batch = structuredClone(changeset)
  batch.operations.push({ ...batch.operations[0], key: 'stale', expected: { ...batch.operations[0].expected, content: 'An old assumption' } })
  const result = await runChangeset(batch, 'apply', {
    read: async () => [cell],
    write: async () => assert.fail('a mismatched batch wrote a row'),
  })
  assert.equal(result.ok, false)
  assert.match(result.failures.join('\n'), /stale.content/)
  assert.deepEqual(result.applied, [])
})

test('apply reads back both the new cell and its durable inverse; verify can check the receipt later', async () => {
  let row = { ...cell }
  const log = {
    id: 'change-1', fn: 'update_cell_content', args: { cell_id: cell.id },
    revert: { fn: 'update_cell_content', args: { cell_id: cell.id, update: { ...cell } } },
    author: 'human',
  }
  const database = {
    read: async (target) => target.table === 'authoring_changes' ? [log] : [row],
    write: async (_op, before) => {
      assert.equal(before.content, cell.content)
      row = { ...row, ...changeset.operations[0].value }
      return { changeIds: ['change-1'] }
    },
  }
  const result = await runChangeset(changeset, 'apply', database)
  assert.equal(result.ok, true)
  assert.deepEqual(result.applied.map(({ key, changeIds }) => ({ key, changeIds })), [{ key: 'tracer', changeIds: ['change-1'] }])
  const verified = await runChangeset(changeset, 'verify', database, { receipt: result.applied })
  assert.equal(verified.ok, true)
  log.revert = null
  const broken = await runChangeset(changeset, 'verify', database, { receipt: result.applied })
  assert.equal(broken.ok, false)
  assert.match(broken.failures.join('\n'), /inverse/)
})

test('receipt verification catches a durable inverse or author changed after apply', async () => {
  let row = { ...cell }
  const change = {
    id: 'change-1', fn: 'update_cell_content', args: { cell_id: cell.id }, author: 'human',
    revert: { fn: 'update_cell_content', args: { cell_id: cell.id, update: { content: cell.content } } },
  }
  const database = {
    read: async (target) => structuredClone(target.table === 'authoring_changes' ? [change] : [row]),
    write: async () => { row = { ...row, ...changeset.operations[0].value }; return { changeIds: ['change-1'] } },
  }
  const applied = await runChangeset(changeset, 'apply', database)
  change.revert.args.update.content = 'Not the captured prior content'
  change.author = 'agent'
  const result = await runChangeset(changeset, 'verify', database, { receipt: applied.applied })
  assert.equal(result.ok, false)
  assert.match(result.failures.join('\n'), /captured durable record/)
})

test('a zero-row write or failed durable append stops the remaining operations', async () => {
  for (const failure of ['zero rows', 'audit append refused']) {
    let calls = 0
    const result = await runChangeset(changeset, 'apply', {
      read: async () => [cell],
      write: async () => { calls++; throw new Error(failure) },
    })
    assert.equal(result.ok, false)
    assert.equal(calls, 1)
    assert.match(result.failures.join('\n'), new RegExp(failure))
  }
})

test('unsupported operations and unguarded changed columns abort before any database call', async () => {
  for (const modify of [
    (op) => { op.operation = 'set_cell_status' },
    (op) => { delete op.expected.summary },
    (op) => { op.value.path_id = 'another-path' },
    (op) => { op.evidence = [] },
  ]) {
    const batch = structuredClone(changeset)
    modify(batch.operations[0])
    await assert.rejects(runChangeset(batch, 'apply', {
      read: async () => assert.fail('invalid changeset reached the database'),
      write: async () => assert.fail('invalid changeset wrote'),
    }), /unsupported|expected|field|evidence/i)
  }
})

test('creation preflights absent children under a new parent, then verifies their parents and positions', async () => {
  const batch = {
    version: 1, issue: 738,
    operations: [{
      key: 'path', operation: 'create_path_at_status',
      target: { table: 'paths', where: { scenario_id: 'scenario-1', name: 'No tutors available' } },
      expected: null, value: { kind: 'exception', status: 'live' }, evidence: ['Training'],
    }, {
      key: 'cell', operation: 'upsert_cell_at_status',
      target: { table: 'cells', where: { path_id: { ref: 'path' }, lane_id: 'lane-1', step_id: 'step-1', position: 0 } },
      expected: null, value: { content: 'Requests tutors.', status: 'live' }, evidence: ['Training'],
    }, {
      key: 'citation', operation: 'add_evidence',
      target: { table: 'evidence', where: {
        service_id: 'service-1', cell_id: { ref: 'cell' },
        cell_key: { ref: 'cell', field: 'cell_key' }, title: 'Training',
      } },
      expected: null, value: { kind: 'doc', title: 'Training', note: 'Shipped procedure.' }, evidence: ['Training'],
    }],
    checks: [{ target: { table: 'paths', where: { scenario_id: 'scenario-1' } }, beforeCount: 0, afterCount: 1 }],
  }
  const stored = { paths: [], cells: [], evidence: [], authoring_changes: [] }
  const database = {
    read: async (target) => stored[target.table].filter((row) =>
      Object.entries(target.where ?? (target.id ? { id: target.id } : {})).every(([key, value]) => row[key] === value)),
    write: async (op) => {
      const id = `${op.key}-1`
      stored[op.target.table].push({ id, ...op.target.where, ...op.value, ...(op.target.table === 'cells' ? { cell_key: 'actual/cell-key' } : {}) })
      stored.authoring_changes.push({
        id: `log-${id}`, fn: op.operation, args: {}, author: 'human',
        revert: { fn: 'delete', args: { id } },
      })
      return { changeIds: [`log-${id}`] }
    },
  }
  const dry = await runChangeset(batch, 'dry-run', database)
  assert.equal(dry.ok, true)
  assert.equal(stored.paths.length, 0)
  const result = await runChangeset(batch, 'apply', database)
  assert.equal(result.ok, true, result.failures.join('\n'))
  assert.equal(stored.cells[0].path_id, 'path-1')
  assert.equal(stored.evidence[0].cell_key, 'actual/cell-key')
  const verified = await runChangeset(batch, 'verify', database)
  assert.equal(verified.ok, true, verified.failures.join('\n'))
  stored.cells[0].position = 2
  assert.equal((await runChangeset(batch, 'verify', database)).ok, false)
})

test('read-back checks ordered path columns, evidence, placements and edge type', async () => {
  const cases = [
    ['set_path_steps', 'paths', { step_ids: ['step-2', 'step-1'] }],
    ['add_evidence', 'evidence', { kind: 'doc', title: 'Module 9', note: 'Draft training' }],
    ['set_placement_touchpoint', 'cell_touchpoints', { touchpoint_id: 'touchpoint-1' }],
    ['set_cell_dependency', 'cell_dependencies', { kind: 'enables', note: 'Must be assigned first' }],
    ['update_path_spec', 'paths', { summary: 'When a tutor withdraws.', note: null }],
    ['create_scenario', 'scenarios', { name: 'Weekly Class Report', layout: 'stacked' }],
    ['add_step', 'steps', { name: 'Reads the report' }],
    ['add_lane', 'lanes', { name: 'Teacher', lane_role: 'customer' }],
    ['set_path_status', 'paths', { status: 'built' }],
  ]
  for (const [operation, table, value] of cases) {
    const creating = ['add_evidence', 'set_cell_dependency', 'create_scenario', 'add_step', 'add_lane'].includes(operation)
    const scopes = {
      add_evidence: { service_id: 'service-1', cell_id: 'cell-1', cell_key: 'fixture/cell', title: value.title },
      set_cell_dependency: { source_cell_id: 'cell-1', target_cell_id: 'cell-2', kind: value.kind },
      create_scenario: { phase_id: 'phase-1', name: value.name },
      add_step: { scenario_id: 'scenario-1', name: value.name },
      add_lane: { path_id: 'path-1', name: value.name },
    }
    const batch = { version: 1, issue: 738, operations: [{
      key: 'check', operation, target: { table, ...(creating ? { where: scopes[operation] } : { id: 'row-1' }), ...(operation === 'set_path_steps' ? { withSteps: true } : {}) },
      expected: creating ? null : value, value, evidence: ['Source'],
    }] }
    let row = { id: 'row-1', ...value }
    const database = { read: async () => [row] }
    assert.equal((await runChangeset(batch, 'verify', database)).ok, true)
    row = { ...row, [Object.keys(value)[0]]: 'wrong' }
    assert.equal((await runChangeset(batch, 'verify', database)).ok, false)
  }
})

test('all operation-specific guards run before the first write, and a concurrent edit is preserved', async () => {
  let reads = 0
  let writes = 0
  const guarded = await runChangeset(changeset, 'apply', {
    read: async () => [cell],
    prepare: async () => { throw new Error('Parent missing') },
    write: async () => { writes++ },
  })
  assert.equal(guarded.ok, false)
  assert.match(guarded.failures.join('\n'), /Parent missing/)
  const concurrent = await runChangeset(changeset, 'apply', {
    read: async () => [{ ...cell, content: ++reads === 1 ? cell.content : 'A newer human edit' }],
    write: async () => { writes++ },
  })
  assert.equal(concurrent.ok, false)
  assert.equal(writes, 0)
  assert.match(concurrent.failures.join('\n'), /changed since preflight/)
})

test('dry-run proves touched rows and the durable log count stayed unchanged by re-reading them', async () => {
  let reads = 0
  let counts = 0
  const result = await runChangeset(changeset, 'dry-run', {
    read: async () => [{ ...cell, summary: ++reads === 1 ? null : 'Changed during dry-run' }],
    auditCount: async () => 10 + counts++,
  })
  assert.equal(result.ok, false)
  assert.match(result.failures.join('\n'), /dry-run.*changed/)
  assert.deepEqual(result.auditCounts, { before: 10, after: 11 })
})

test('count checks also verify the parents and positions of rows created as structural side effects', async () => {
  const batch = structuredClone(changeset)
  batch.checks = [{
    target: { table: 'lanes', where: { path_id: 'path-1' } }, beforeCount: 1, afterCount: 1,
    afterRows: [{ path_id: 'path-1', name: 'Teacher', position: 0 }],
  }]
  const result = await runChangeset(batch, 'verify', {
    read: async (target) => target.table === 'cells'
      ? [{ ...cell, ...batch.operations[0].value }]
      : [{ id: 'lane-1', path_id: 'path-1', name: 'Teacher', position: 4 }],
  })
  assert.equal(result.ok, false)
  assert.match(result.failures.join('\n'), /afterRows/)
})

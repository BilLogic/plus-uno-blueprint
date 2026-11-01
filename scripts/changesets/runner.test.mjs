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
    ['update_cell_dependency', 'cell_dependencies', { kind: 'enables', note: 'Must be finished first' }],
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

test('a new path cell resolves its copied lane by scoped read in dry-run, apply and separate verify', async () => {
  const stored = { paths: [], lanes: [], cells: [], authoring_changes: [] }
  const batch = { version: 1, issue: 741, operations: [{
    key: 'path', operation: 'create_path_at_status',
    target: { table: 'paths', where: { scenario_id: 'goal-setting', name: 'Goal data looks wrong' } },
    expected: null, value: { kind: 'exception', status: 'live' }, evidence: ['Module 9'],
  }, {
    key: 'cell', operation: 'upsert_cell_at_status',
    target: { table: 'cells', where: {
      path_id: { ref: 'path' },
      lane_id: { lookup: { table: 'lanes', where: { path_id: { ref: 'path' }, name: 'Regular Tutor' } } },
      step_id: 'report-discrepancy', position: 0,
    } },
    expected: null, value: { content: 'Reports the discrepancy.', status: 'live' }, evidence: ['Module 9'],
  }], checks: [{ target: { table: 'cells', where: { path_id: { ref: 'path' } } }, beforeCount: 0, afterCount: 1,
    afterRows: [{ lane_id: { lookup: { table: 'lanes', where: { path_id: { ref: 'path' }, name: 'Regular Tutor' } } }, step_id: 'report-discrepancy', position: 0 }],
  }] }
  const database = {
    read: async (target) => stored[target.table].filter(row => Object.entries(target.where ?? (target.id ? { id: target.id } : {})).every(([key,value])=>row[key]===value)),
    write: async (op) => {
      if (op.key === 'cell') assert.equal(op.target.where.lane_id, 'copied-rt')
      const id = `${op.key}-1`
      stored[op.target.table].push({ id, ...op.target.where, ...op.value })
      if(op.key === 'path') stored.lanes.push({id:'copied-rt',path_id:id,name:'Regular Tutor'})
      stored.authoring_changes.push({ id: `log-${id}`, fn: op.operation, args: {}, author: 'human', revert: { fn: 'delete', args: { id } } })
      return {changeIds:[`log-${id}`]}
    },
  }
  assert.equal((await runChangeset(batch, 'dry-run', database)).ok, true)
  assert.equal(stored.paths.length, 0)
  const applied = await runChangeset(batch, 'apply', database)
  assert.equal(applied.ok, true, applied.failures.join('\n'))
  assert.equal((await runChangeset(batch, 'verify', database, { receipt: applied.applied })).ok, true)
  stored.lanes.push({id:'ambiguous-rt',path_id:'path-1',name:'Regular Tutor'})
  await assert.rejects(runChangeset(batch, 'verify', database, {receipt:applied.applied}), /lookup.*exactly one.*found 2/)
})

test('a missing or ambiguous lookup stops an existing-parent batch before writes', async () => {
  for (const rows of [[], [{ id: 'first' }, { id: 'second' }], [{ id: null }]]) {
    const batch = structuredClone(changeset)
    batch.operations[0].target = { table: 'cells', id: { lookup: { table: 'cells', where: { path_id: 'path-1', content: cell.content } } } }
    await assert.rejects(runChangeset(batch, 'apply', {
      read: async () => rows,
      write: async () => assert.fail('an unresolved lookup wrote'),
    }), /lookup.*(exactly one|missing id)/)
  }
})

test('only a generated step’s rename or summary is deferred; other edits on a pending row still fail preflight', async () => {
  const database = { read: async () => [] }
  const scenario = { key: 'scenario', operation: 'create_scenario', target: { table: 'scenarios', where: { phase_id: 'p', name: 'New' } },
    expected: null, value: { name: 'New', layout: 'stacked' }, evidence: ['Source'] }
  const placeholder = { lookup: { table: 'path_steps', where: { path_id: { lookup: { table: 'paths', where: { scenario_id: { ref: 'scenario' } } } }, position: 0 } }, field: 'step_id' }
  const rename = { key: 'rename', operation: 'rename_step', target: { table: 'steps', id: placeholder },
    input: { expected_path_steps: [{ path_id: 'x', position: 0 }] }, expected: { name: 'Step 1', scenario_id: { ref: 'scenario' } }, value: { name: 'Build' }, evidence: ['Source'] }
  const dry = await runChangeset({ version: 1, issue: 1, operations: [scenario, rename] }, 'dry-run', database)
  assert.deepEqual(dry.failures, [])
  assert.equal(dry.diff[1].before.name, 'Step 1')
  assert.ok(dry.diff[1].deferred)
  const status = { key: 'status', operation: 'update_cell_status', target: { table: 'cells', id: { ref: 'scenario' } }, expected: { status: 'built' }, value: { status: 'live' }, evidence: ['Source'] }
  const refused = await runChangeset({ version: 1, issue: 1, operations: [scenario, status] }, 'dry-run', database)
  assert.match(refused.failures.join('\n'), /status: expected exactly one row, found 0/)
})

test('a lookup field resolves exactly one membership’s step id', async () => {
  const step = { id: 's1', name: 'Build', scenario_id: 'c' }
  const database = { read: async (target) => target.table === 'path_steps' ? [{ path_id: 'p', step_id: 's1', position: 0 }] : target.id === 's1' ? [step] : [] }
  const op = { key: 'rename', operation: 'rename_step', target: { table: 'steps', id: { lookup: { table: 'path_steps', where: { path_id: 'p', position: 0 } }, field: 'step_id' } },
    input: { expected_path_steps: [{ path_id: 'p', position: 0 }] }, expected: { name: 'Step 1' }, value: { name: 'Build' }, evidence: ['Source'] }
  const verified = await runChangeset({ version: 1, issue: 1, operations: [op] }, 'verify', database)
  assert.deepEqual(verified.diff[0].target, { table: 'steps', id: 's1' })
  assert.equal(verified.failures.some((failure) => failure.includes('rename.name')), false)
})

// Deferral is for rows this batch creates, never a way past preflight.
const scenarioOp = { key: 'scenario', operation: 'create_scenario', target: { table: 'scenarios', where: { phase_id: 'p', name: 'New' } },
  expected: null, value: { name: 'New', layout: 'stacked' }, evidence: ['Source'] }
const placeholderRename = (expected) => ({ key: 'rename', operation: 'rename_step',
  target: { table: 'steps', id: { lookup: { table: 'path_steps', where: { path_id: { lookup: { table: 'paths', where: { scenario_id: { ref: 'scenario' } } } }, position: 0 } }, field: 'step_id' } },
  input: { expected_path_steps: [{ path_id: 'x', position: 0 }] }, expected, value: { name: 'Build' }, evidence: ['Source'] })
const noWrites = (stored = {}) => ({
  read: async (target) => (stored[target.table] ?? []).filter((row) =>
    Object.entries(target.where ?? (target.id ? { id: target.id } : {})).every(([key, value]) => row[key] === value)),
  write: async () => assert.fail('a refused deferral wrote'),
})

test('a deferred edit must name, in expected.scenario_id, a scenario created earlier in the batch', async () => {
  const reason = 'rename: a deferred edit requires expected.scenario_id to be the ref of a scenario created earlier in this batch'
  const path = { key: 'path', operation: 'create_path_at_status', target: { table: 'paths', where: { scenario_id: 'old', name: 'P' } },
    expected: null, value: { kind: 'variant', status: 'live' }, evidence: ['Source'] }
  for (const operations of [
    [scenarioOp, placeholderRename({ name: 'Step 1' })],
    [scenarioOp, path, placeholderRename({ name: 'Step 1', scenario_id: { ref: 'path' } })],
    [scenarioOp, placeholderRename({ name: 'Step 1', scenario_id: 'an-existing-scenario' })],
    [scenarioOp, placeholderRename({ name: 'Step 1', scenario_id: { ref: 'scenario', field: 'phase_id' } })],
  ]) {
    for (const mode of ['dry-run', 'apply']) {
      const result = await runChangeset({ version: 1, issue: 1, operations }, mode, noWrites())
      assert.deepEqual(result.failures, [reason])
      assert.deepEqual(result.applied, [])
    }
  }
  // A scenario created after the edit is a forward ref, refused outright.
  const later = { ...scenarioOp, key: 'later' }
  await assert.rejects(runChangeset({ version: 1, issue: 1, operations: [scenarioOp, placeholderRename({ name: 'Step 1', scenario_id: { ref: 'later' } }), later] }, 'dry-run', noWrites()),
    /Expected a preceding operation for ref later/)
})

test('an existing step reached through a row the batch inserts is refused at dry-run, before any write', async () => {
  const stored = {
    steps: [{ id: 'old-step', scenario_id: 'old', name: 'Old name' }],
    paths: [{ id: 'old-path', scenario_id: 'old' }],
  }
  const insert = { key: 'insert', operation: 'insert_cell_at_position',
    target: { table: 'cells', where: { path_id: 'old-path', lane_id: 'old-lane', step_id: 'old-step', position: 1 } },
    expected: null, value: { content: 'A new cell', status: 'live' }, evidence: ['Source'] }
  const rename = { key: 'rename', operation: 'rename_step',
    target: { table: 'steps', id: { lookup: { table: 'cells', where: { id: { ref: 'insert' } } }, field: 'step_id' } },
    input: { expected_path_steps: [{ path_id: 'old-path', position: 0 }] },
    expected: { name: 'A stale name', scenario_id: { ref: 'scenario' } }, value: { name: 'Renamed' }, evidence: ['Source'] }
  for (const mode of ['dry-run', 'apply']) {
    const result = await runChangeset({ version: 1, issue: 1, operations: [scenarioOp, insert, rename] }, mode, noWrites(stored))
    assert.equal(result.ok, false)
    assert.deepEqual(result.failures, ['rename: deferred target is reached through insert, not only through scenario scenario; an existing row cannot be deferred'])
    assert.equal(result.diff.some((entry) => entry.key === 'rename'), false)
    assert.deepEqual(result.applied, [])
  }
})

test('a deferred rename placed before an add_step on its scenario is refused at preflight', async () => {
  const add = { key: 'later-step', operation: 'add_step', target: { table: 'steps', where: { scenario_id: { ref: 'scenario' }, name: 'Later' } },
    expected: null, value: { name: 'Later' }, input: { path_id: 'x' }, evidence: ['Source'] }
  const rename = placeholderRename({ name: 'Step 1', scenario_id: { ref: 'scenario' } })
  const refused = await runChangeset({ version: 1, issue: 1, operations: [scenarioOp, rename, add] }, 'dry-run', noWrites())
  assert.deepEqual(refused.failures, ['rename: a deferred rename must follow every add_step on scenario scenario; later-step comes after it'])
  const ordered = await runChangeset({ version: 1, issue: 1, operations: [scenarioOp, add, rename] }, 'dry-run', noWrites())
  assert.deepEqual(ordered.failures, [])
})

test('a dependency edit addresses its edge by id and names a known kind', async () => {
  const edit = (target, value) => ({ version: 1, issue: 743, operations: [{
    key: 'retype', operation: 'update_cell_dependency', target, expected: { kind: 'leads_to' }, value, evidence: ['Source'],
  }] })
  const database = { read: async () => [] }
  await assert.rejects(runChangeset(edit({ table: 'cell_dependencies', where: { source_cell_id: 'cell-1' } }, { kind: 'enables' }), 'dry-run', database), /address the existing edge by id/)
  await assert.rejects(runChangeset(edit({ table: 'cell_dependencies', id: 'edge-1' }, { kind: 'triggers' }), 'dry-run', database), /leads_to or enables/)
})

// A path created at a status copies its source path's step memberships. The
// copied list is reviewed as expected.step_ids and trimmed by a deferred
// set_path_steps, read and guarded at apply once the path exists.
const newPath = { key: 'path', operation: 'create_path_at_status', target: { table: 'paths', where: { scenario_id: 'calloff', name: 'Recurring withdrawal' } },
  expected: null, value: { kind: 'variant', status: 'live' }, input: { lane_source_path_id: 'twelve' }, evidence: ['Source'] }
const trim = (expected = ['need', 'file', 'cover', 'review', 'late']) => ({ key: 'trim', operation: 'set_path_steps',
  target: { table: 'paths', id: { ref: 'path' }, withSteps: true },
  expected: { step_ids: expected, scenario_id: 'calloff' }, value: { step_ids: ['need', 'file', 'review', 'cover'] }, evidence: ['Source'] })
function pathBoard({ copied = ['need', 'file', 'cover', 'review', 'late'] } = {}) {
  const stored = { paths: [], path_steps: [], cells: [], steps: [], authoring_changes: [] }
  const writes = []
  const read = async (target) => {
    let rows = stored[target.table].filter((row) => Object.entries(target.where ?? (target.id ? { id: target.id } : {})).every(([key, value]) => row[key] === value))
    if (target.withSteps) rows = rows.map((row) => ({ ...row, step_ids: stored.path_steps.filter((link) => link.path_id === row.id).sort((a, b) => a.position - b.position).map((link) => link.step_id) }))
    return rows
  }
  const write = async (op) => {
    writes.push(op.key)
    const id = `${op.key}-1`
    if (op.operation === 'create_path_at_status') {
      stored.paths.push({ id, ...op.target.where, ...op.value })
      copied.forEach((step_id, position) => stored.path_steps.push({ path_id: id, step_id, position }))
    } else {
      stored.path_steps = stored.path_steps.filter((link) => link.path_id !== op.target.id)
      op.value.step_ids.forEach((step_id, position) => stored.path_steps.push({ path_id: op.target.id, step_id, position }))
    }
    stored.authoring_changes.push({ id: `log-${id}`, fn: op.operation, args: {}, author: 'human', revert: { fn: 'undo', args: { id } } })
    return { changeIds: [`log-${id}`] }
  }
  return { stored, writes, database: { read, write } }
}

test('a new path’s copied steps are trimmed by a deferred set_path_steps, guarded at apply and verified separately', async () => {
  const board = pathBoard()
  const batch = { version: 1, issue: 744, operations: [newPath, trim()] }
  const dry = await runChangeset(batch, 'dry-run', board.database)
  assert.deepEqual(dry.failures, [])
  assert.ok(dry.diff[1].deferred)
  assert.deepEqual(dry.diff[1].before.step_ids, ['need', 'file', 'cover', 'review', 'late'])
  assert.deepEqual(board.writes, [])
  const applied = await runChangeset(batch, 'apply', board.database)
  assert.equal(applied.ok, true, applied.failures.join('\n'))
  assert.deepEqual(board.writes, ['path', 'trim'])
  assert.deepEqual((await board.database.read({ table: 'paths', id: 'path-1', withSteps: true }))[0].step_ids, ['need', 'file', 'review', 'cover'])
  assert.equal((await runChangeset(batch, 'verify', board.database, { receipt: applied.applied })).ok, true)
})

test('copied memberships that differ from the reviewed list stop the batch before set_path_steps is sent', async () => {
  const board = pathBoard({ copied: ['need', 'file', 'cover', 'review'] })
  const applied = await runChangeset({ version: 1, issue: 744, operations: [newPath, trim()] }, 'apply', board.database)
  assert.equal(applied.ok, false)
  assert.deepEqual(board.writes, ['path'])
  assert.match(applied.failures.join('\n'), /trim\.step_ids: expected .*no write attempted/)
})

test('a deferred set_path_steps must address a path created earlier in this batch, before any add_step on it', async () => {
  const cell = { key: 'cell', operation: 'upsert_cell_at_status', target: { table: 'cells', where: { path_id: 'old', lane_id: 'l', step_id: 's', position: 0 } },
    expected: null, value: { content: 'A cell', status: 'live' }, evidence: ['Source'] }
  const throughCell = { ...trim(), target: { table: 'paths', id: { lookup: { table: 'cells', where: { id: { ref: 'cell' } } }, field: 'path_id' }, withSteps: true } }
  const reached = await runChangeset({ version: 1, issue: 744, operations: [cell, throughCell] }, 'dry-run', pathBoard().database)
  assert.deepEqual(reached.failures, ['trim: a deferred set_path_steps requires target.id to be the ref of a path created earlier in this batch'])
  const add = { key: 'later-step', operation: 'add_step', target: { table: 'steps', where: { scenario_id: 'calloff', name: 'Later' } },
    expected: null, value: { name: 'Later' }, input: { path_id: { ref: 'path' } }, evidence: ['Source'] }
  const late = await runChangeset({ version: 1, issue: 744, operations: [newPath, trim(), add] }, 'dry-run', pathBoard().database)
  assert.deepEqual(late.failures, ['trim: a deferred set_path_steps must follow every add_step on path path; later-step comes after it'])
})

test('a content edit advances a later capability’s preservation check without the stale search index', async () => {
  const { projectChecks, verifyChecks } = await import('./capabilities.mjs')
  const before = { id: 'edited', path_id: 'p', content: 'Takes tutor attendance.', search_tsv: "'attend':3 'take':1", updated_at: 't0' }
  const stored = { ...before, content: 'Claims host.', search_tsv: "'claim':1 'host':2", updated_at: 't1' }
  const checks = [{ target: { table: 'cells', where: { path_id: 'p' } }, rows: [structuredClone(before)] }]
  projectChecks(checks, 'cells', before, { ...before, content: stored.content })
  assert.deepEqual(await verifyChecks(async () => [stored], checks), [])
  assert.notDeepEqual(await verifyChecks(async () => [{ ...stored, summary: 'An unapproved change' }], [{ ...checks[0], rows: [{ ...checks[0].rows[0], summary: null }] }]), [])
})

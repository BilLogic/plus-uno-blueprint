import { test, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { modules } from '../../deployment/lib/contentChangesetModules.ts'
import { createDatabase } from '../changesets/database.mjs'
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

/** A disposable PostgREST boundary, never a mock of the mutation modules. */
function databaseFixture({ zeroRows = false, failAppend = false } = {}) {
  const tables = {
    cells: [{ ...seed }], authoring_changes: [], evidence: [], services: [{ id }],
    paths: [{ id, scenario_id: id }], lanes: [{ id, path_id: id }], steps: [{ id, scenario_id: id }],
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
    if (url.pathname.endsWith('/rpc/sync_cell_touchpoints')) return answer({ removed: [] })
    if (url.pathname.endsWith('/rpc/upsert_cell_at_status')) {
      const cellId = `40000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`
      const changeId = `50000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`
      tables.cells.push({ id: cellId, ...body, position: 0, summary: null, owner: null, perceived_owner: null })
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

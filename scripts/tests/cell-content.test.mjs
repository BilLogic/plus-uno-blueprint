#!/usr/bin/env node
/**
 * Phase 4 logic that is worth testing without a browser.
 *
 * Two things here can lose data silently, which is why they get tests rather
 * than a click-through:
 *
 * 1. `updateCellResources` rewrites the `links` array. That array also holds
 *    tech descriptions, pictures and Figma embeds keyed by `type` — writing it
 *    from what the resources editor knows about would delete the tech pills
 *    off the cell, and nothing on screen would say so.
 * 2. A resource URL that is not `https:` must be refused rather than coerced.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { validateResourceUrl } from '../../src/lib/resourceUrl.ts'
import {
  updateCellContent,
  updateCellResources,
} from '../../src/lib/cellContentMutations.ts'
import { updateCellSpec } from '../../src/lib/cellSpecMutations.ts'

test('bare host is upgraded to https', () => {
  const result = validateResourceUrl('figma.com/file/abc')
  assert.equal(result.ok, true)
  assert.equal(result.url, 'https://figma.com/file/abc')
})

test('http is refused, never silently upgraded', () => {
  const result = validateResourceUrl('http://example.com')
  assert.equal(result.ok, false)
  assert.match(result.problem, /not secure/)
})

test('non-http schemes are refused', () => {
  for (const raw of ['javascript:alert(1)', 'file:///etc/passwd', 'ftp://x.com']) {
    const result = validateResourceUrl(raw)
    assert.equal(result.ok, false, `${raw} should be refused`)
  }
})

test('empty and malformed are refused', () => {
  assert.equal(validateResourceUrl('').ok, false)
  assert.equal(validateResourceUrl('   ').ok, false)
  assert.equal(validateResourceUrl('https://').ok, false)
})

/**
 * Minimal stand-in for the PostgREST builder chain, capturing the payload.
 *
 * `rows` is what `.select()` resolves with — the whole point of the second
 * test group below. PostgREST answers a matched-nothing update with
 * `{ data: [], error: null }`, so an empty array here is a *successful*
 * response that wrote nothing.
 *
 * A content write also brings the cell's touchpoint placements into line with
 * the text, which means reading them first. That read is stubbed as empty:
 * these tests are about the content write and its matched-nothing detection,
 * and a cell with no placements and text naming none plans no work, so the
 * sync neither writes nor interferes. `touchpointSync.test.ts` is where the
 * planning itself is exercised.
 */
function fakeClient(rows = [{ id: 'cell-1' }]) {
  const captured = {}
  return {
    captured,
    from(table) {
      return {
        // The placement read, and the service lookup the sync makes only
        // when it has work to do. Both resolve empty here.
        select() {
          return {
            eq() {
              return Object.assign(
                Promise.resolve({ data: [], error: null }),
                { single: () => Promise.resolve({ data: null, error: null }) },
              )
            },
          }
        },
        update(values) {
          captured.values = values
          return {
            eq(column, value) {
              captured.eq = [column, value]
              return {
                select(columns) {
                  // Only the cells table's write is the subject; the sync's
                  // own updates must not overwrite what was captured.
                  if (table === 'cells') captured.select = columns
                  return Promise.resolve({ data: rows, error: null })
                },
              }
            },
          }
        },
      }
    },
  }
}

test('rewriting resources preserves every non-resource link', async () => {
  const existing = [
    { type: 'tech_description', label: 'Zoom', description: 'Video calls' },
    { type: 'url', label: 'Old', url: 'https://old.example.com' },
    { type: 'picture', label: 'Screenshot', picture: 'https://img.example.com/a.png' },
  ]
  const client = fakeClient()

  await updateCellResources(client, 'cell-1', existing, [
    { label: 'Spec', url: 'https://spec.example.com' },
  ])

  const written = client.captured.values.links
  const kinds = written.map((link) => link.type)

  assert.ok(kinds.includes('tech_description'), 'tech pill must survive')
  assert.ok(kinds.includes('picture'), 'picture must survive')
  assert.equal(
    written.filter((link) => link.type === 'url').length,
    1,
    'exactly the one new resource',
  )
  assert.equal(
    written.find((link) => link.type === 'url').url,
    'https://spec.example.com/',
  )
  assert.deepEqual(client.captured.eq, ['id', 'cell-1'])
})

test('a resource with no label falls back to its host', async () => {
  const client = fakeClient()
  await updateCellResources(client, 'cell-1', [], [
    { label: '  ', url: 'https://www.notion.so/page' },
  ])
  const link = client.captured.values.links.find((entry) => entry.type === 'url')
  assert.equal(link.label, 'notion.so')
})

test('one bad URL aborts the whole write', async () => {
  const client = fakeClient()
  await assert.rejects(
    () =>
      updateCellResources(client, 'cell-1', [], [
        { label: 'Good', url: 'https://ok.example.com' },
        { label: 'Bad', url: 'http://insecure.example.com' },
      ]),
    /not secure/,
  )
  // Nothing may reach the database when any entry is invalid — a partial
  // write would drop the good link's sibling without saying so.
  assert.equal(client.captured.values, undefined)
})

/*
 * Zero rows is a real answer.
 *
 * `.update(...).eq('id', …)` against a row that is gone returns 200 with an
 * empty array and `error: null`. Checking `error` alone reports it as a
 * success — which is how "edit cell C, then delete the path that cascades C,
 * then Revert all" told the user the edit had been taken back, dropped the
 * entry from the ledger, and left the new text waiting to reappear with the
 * restored path.
 */
test('a content write that matches no row throws instead of succeeding', async () => {
  const client = fakeClient([])
  await assert.rejects(
    () =>
      updateCellContent(
        client,
        'cell-gone',
        { content: 'New text', summary: '', owner: '', perceivedOwner: '' },
        undefined,
        { record: false },
      ),
    /no longer exists/,
  )
  assert.equal(client.captured.select, 'id', '.select() is what makes it visible')
})

test('a spec write that matches no row throws instead of succeeding', async () => {
  const client = fakeClient([])
  await assert.rejects(
    () =>
      updateCellSpec(
        client,
        'cell-gone',
        { function: 'Reassure', form: 'Card', valueProps: [] },
        undefined,
        { record: false },
      ),
    /no longer exists/,
  )
})

test('a resources write that matches no row throws instead of succeeding', async () => {
  const client = fakeClient([])
  await assert.rejects(
    () => updateCellResources(client, 'cell-gone', [], []),
    /no longer exists/,
  )
})

test('a content write that matches its row still resolves', async () => {
  const client = fakeClient()
  await updateCellContent(
    client,
    'cell-1',
    { content: 'New text', summary: '', owner: '', perceivedOwner: '' },
    undefined,
    { record: false },
  )
  assert.equal(client.captured.values.content, 'New text')
})

/**
 * A client that records every table it writes to, and answers the sync's
 * reads with a lane role the caller chooses.
 */
function syncSpyClient({ laneRole, placements = [] }) {
  const writes = []
  return {
    writes,
    from(table) {
      return {
        select() {
          return {
            eq() {
              const rows =
                table === 'cell_touchpoints'
                  ? placements
                  : [{ lanes: { lane_role: laneRole }, paths: { scenarios: { phases: { service_id: 'svc-1' } } } }]
              return Object.assign(Promise.resolve({ data: rows, error: null }), {
                eq: () => ({ single: () => Promise.resolve({ data: { id: 'tp-1' }, error: null }) }),
                single: () => Promise.resolve({ data: rows[0], error: null }),
              })
            },
          }
        },
        insert() {
          writes.push(`insert:${table}`)
          return { select: () => Promise.resolve({ data: [{ id: 'x' }], error: null }) }
        },
        upsert() {
          writes.push(`upsert:${table}`)
          return Promise.resolve({ data: null, error: null })
        },
        delete() {
          writes.push(`delete:${table}`)
          return { eq: () => Promise.resolve({ data: null, error: null }) }
        },
        update(values) {
          if (table !== 'cells') writes.push(`update:${table}`)
          return {
            eq: () => ({
              select: () => Promise.resolve({ data: [{ id: 'cell-1' }], error: null }),
            }),
          }
        },
      }
    },
  }
}

test('a cell on an ordinary lane never files its prose as a touchpoint', async () => {
  // The bug this guards against was written and caught here: `cells.content`
  // on an actor lane is a sentence about what somebody did, and syncing it
  // would have put that sentence in the catalog as a tool.
  const client = syncSpyClient({ laneRole: 'customer_actions' })
  await updateCellContent(
    client,
    'cell-1',
    {
      content: 'The tutor greets the student and checks the goal list',
      summary: '',
      owner: '',
      perceivedOwner: '',
      status: 'live',
    },
    undefined,
    { record: false },
  )
  assert.deepEqual(client.writes, [], 'no placement or catalog write may happen')
})

test('a cell on a touchpoint lane gains its first placement', async () => {
  const client = syncSpyClient({ laneRole: 'frontstage_touchpoints' })
  await updateCellContent(
    client,
    'cell-1',
    { content: 'Zoom', summary: '', owner: '', perceivedOwner: '', status: 'live' },
    undefined,
    { record: false },
  )
  assert.deepEqual(client.writes, ['upsert:touchpoints', 'insert:cell_touchpoints'])
})

test('a cell that already has placements is synced whatever its lane', async () => {
  // The four Support Actions cells the import migration found: they carry
  // touchpoints without sitting on a touchpoint lane, and an edit there must
  // still keep their placements true.
  const client = syncSpyClient({
    laneRole: 'support_actions',
    placements: [{ id: 'p1', position: 1, touchpoints: { name: 'Design System' } }],
  })
  await updateCellContent(
    client,
    'cell-1',
    { content: 'Branding Guidelines', summary: '', owner: '', perceivedOwner: '', status: 'live' },
    undefined,
    { record: false },
  )
  assert.deepEqual(client.writes, [
    'delete:cell_touchpoints',
    'upsert:touchpoints',
    'insert:cell_touchpoints',
  ])
})

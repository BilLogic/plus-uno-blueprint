/**
 * The claim extractor behind `check:contract:live`'s `doc schema claims` check.
 *
 * The check is GREEN against the docs, and that proves nothing by itself — an
 * extractor that found no claims at all would print the same line. What is
 * asserted here is that it finds the shapes that caused the 2026-09-01 audit,
 * and skips the four shapes that are not claims.
 *
 * Prose does not 400. Every defect this covers reached production, sat there
 * for between eleven days and six weeks, and surfaced as an empty answer in
 * Slack rather than as an error anywhere.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { schemaClaims } from '../check-blueprint-contract.mjs'

const tokens = (markdown) => schemaClaims(markdown, 'doc.md').map((c) => c.token)

test('a qualified pair is a claim', () => {
  assert.deepEqual(tokens('Read `cells.summary` before answering.'), ['cells.summary'])
})

test('`public.x` names a relation, not a column of a table called public', () => {
  const [claim] = schemaClaims('Grants on `public.lanes` are platform-issued.', 'doc.md')
  assert.equal(claim.table, 'lanes')
  assert.equal(claim.column, null)
})

test('a bare token is prose, not a claim', () => {
  // 111 bare tokens across the two swept docs are roles, policies, function
  // names, RPC parameters, column VALUES and ordinary English — `open`,
  // `content`, `live`, `main`. Probing them would need ~90 exceptions, which
  // is a blocklist wearing an allowlist's clothes.
  assert.deepEqual(tokens('The `summary` is the tl;dr and `live` is the default.'), [])
})

test('a SQL alias is not a claim', () => {
  assert.deepEqual(tokens('select `c.lane_id` from cells c'), [])
})

test('a filename is not a claim', () => {
  assert.deepEqual(tokens('See `slice_tools.py` and `blueprintContract.ts`.'), [])
})

test('a fenced code block is not prose', () => {
  const md = ['Read this:', '```sql', 'select c.links from cells c;', '```', 'Done.'].join('\n')
  assert.deepEqual(tokens(md), [])
})

test('a rename table is skipped, structurally', () => {
  // Detected by a header row whose first cell is `Was` — not by wording. Both
  // swept docs carry one and only one sits under a `## The rename map`
  // heading, so a heading-based rule would have missed the other.
  const md = [
    '| Was | Is | How the bot sees it |',
    '|---|---|---|',
    '| `findings.check_name` | `audit_findings.check_key` | read off the row |',
    '',
    'Elsewhere the bot reads `cells.links` every turn.',
  ].join('\n')
  assert.deepEqual(tokens(md), ['cells.links'])
})

test('a correction needs a verb AND the migration that did it', () => {
  const cited = 'It replaced `cells.links` (a JSONB array) in `20260830280000`.'
  assert.deepEqual(tokens(cited), [])

  // Verb alone is not enough. A first attempt accepted any other backticked
  // name as proof, which a sentence listing three retired spellings satisfies
  // without saying anything about any of them.
  const uncited = 'It replaced `cells.links` with the `resources` table.'
  assert.deepEqual(tokens(uncited), ['cells.links'])
})

test('an instruction is not excused by a correction beside it', () => {
  // The shape that cost the most on 2026-09-01: "NEVER assert the blueprint
  // has no future state until you have searched for a `Planned:` path" sat
  // beside a sentence explaining the convention was removed. An exemption has
  // to be no wider than the sentence that earns it.
  const md =
    '`cells.links` was dropped in `20260830280000`. Always read `cells.links` first.'
  assert.deepEqual(tokens(md), ['cells.links'])
})

test('a correction wrapped across lines is still one sentence', () => {
  // Scoping the exemption to a LINE looked right and was not: "It replaced"
  // ends one line and the token begins the next, so a line-scoped rule
  // reported the correction as the defect.
  const md = ['**Resources** — it replaced', '`cells.links` in `20260830280000`, which held three things.'].join('\n')
  assert.deepEqual(tokens(md), [])
})

test('the same name twice is reported once per site, and the sites are numbered', () => {
  const md = ['`cells.links` here.', '', 'And `cells.links` again.'].join('\n')
  const claims = schemaClaims(md, 'doc.md')
  assert.deepEqual(claims.map((c) => c.line), [1, 3])
})

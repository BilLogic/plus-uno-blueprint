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
 * Run: node --test scripts/tests/cell-content.test.mjs
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { validateResourceUrl } from '../../src/lib/resourceUrl.ts'
import { updateCellResources } from '../../src/lib/cellContentMutations.ts'

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

/** Minimal stand-in for the PostgREST builder chain, capturing the payload. */
function fakeClient() {
  const captured = {}
  return {
    captured,
    from() {
      return {
        update(values) {
          captured.values = values
          return {
            eq(column, value) {
              captured.eq = [column, value]
              return Promise.resolve({ error: null })
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

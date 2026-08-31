/**
 * A cell's resources, from either source, in one shape.
 *
 * The database has `resources` rows. The hand-written fallback blueprints in
 * `src/data` still carry the retired jsonb array, and its `url` entries are
 * their resources. Both must produce the same list for the same board, or a
 * bug becomes "works in the fallback, broken in the app" — which is the
 * failure mode `cellTouchpoints.test.ts` was written to catch for the sibling
 * seam, and this file is the same assertion for this one.
 *
 * The other thing under test is what does NOT come through: the array also
 * held touchpoint detail and provenance citations, and reading either as a
 * resource is how "Card 2452" would end up rendered as a link to nowhere.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { cellResourcesFromLinks, cellResourcesFromRows } from '@/lib/cellResources'

test('rows keep their name, kind and url, in the order the author chose', () => {
  const resources = cellResourcesFromRows([
    { position: 2, kind: 'link', name: 'Onboarding Module 8', url: 'https://notion.example/m8' },
    { position: 1, kind: 'link', name: 'AI Coach Dashboard (Figma)', url: 'https://figma.example/n1' },
  ])

  assert.deepEqual(
    resources.map((entry) => entry.name),
    ['AI Coach Dashboard (Figma)', 'Onboarding Module 8'],
  )
  assert.equal(resources[1]!.url, 'https://notion.example/m8')
  assert.equal(resources[0]!.kind, 'link')
})

test('a row with no kind reads as a link', () => {
  // The column defaults to `link` and the check admits `other`; a row that
  // somehow arrives without one should render, not disappear.
  const resources = cellResourcesFromRows([
    { position: 1, kind: null, name: 'Spec', url: 'https://example.com/spec' },
  ])

  assert.equal(resources[0]!.kind, 'link')
})

test('a nameless row is dropped rather than rendered blank', () => {
  const resources = cellResourcesFromRows([
    { position: 1, kind: 'link', name: '   ', url: 'https://example.com' },
    { position: 2, kind: 'link', name: 'Spec', url: 'https://example.com/spec' },
  ])

  assert.deepEqual(resources.map((entry) => entry.name), ['Spec'])
})

test('fallback links contribute only their url entries', () => {
  // The array held three things. A `tech_description` entry is a touchpoint's
  // detail and a `ref` entry is a provenance citation; reading either as a
  // resource puts "Card 2452" on screen as a link with nowhere to go.
  const resources = cellResourcesFromLinks([
    { type: 'url', label: 'Onboarding Module 8', url: 'https://notion.example/m8' },
    { type: 'tech_description', label: 'PLUS App', description: 'The tutor opens it.' },
    { type: 'ref', label: 'Card 2452' },
  ])

  assert.deepEqual(resources.map((entry) => entry.name), ['Onboarding Module 8'])
})

test('a fallback link with no url is dropped, because it renders as nothing', () => {
  const resources = cellResourcesFromLinks([
    { type: 'url', label: 'Nowhere', url: '   ' },
    { type: 'url', label: 'Somewhere', url: 'https://example.com' },
  ])

  assert.deepEqual(resources.map((entry) => entry.name), ['Somewhere'])
})

test('an unnamed fallback link takes its host, the way the editor does', () => {
  const resources = cellResourcesFromLinks([
    { type: 'url', label: '', url: 'https://www.tutors.plus/apply' },
  ])

  assert.equal(resources[0]!.name, 'tutors.plus')
})

test('no resources from an empty source', () => {
  assert.deepEqual(cellResourcesFromRows([]), [])
  assert.deepEqual(cellResourcesFromRows(null), [])
  assert.deepEqual(cellResourcesFromLinks([]), [])
  assert.deepEqual(cellResourcesFromLinks(undefined), [])
})

test('both sources produce the same list for the same cell', () => {
  // The load-bearing one. Unlike the touchpoint seam there is no field the
  // fallback cannot know — a resource is a name, a kind and a url, and the
  // fallback shape carries all three — so this asserts equality outright
  // rather than field by field.
  const fromRows = cellResourcesFromRows([
    { position: 1, kind: 'link', name: 'TutorReviewServlet.java', url: 'https://github.example/a.java' },
    { position: 2, kind: 'link', name: 'Figma — Admin specs', url: 'https://figma.example/n2' },
  ])
  const fromLinks = cellResourcesFromLinks([
    { type: 'url', label: 'TutorReviewServlet.java', url: 'https://github.example/a.java' },
    { type: 'url', label: 'Figma — Admin specs', url: 'https://figma.example/n2' },
    { type: 'tech_description', label: 'PLUS App', description: 'Not a resource.' },
  ])

  assert.deepEqual(fromRows, fromLinks)
})

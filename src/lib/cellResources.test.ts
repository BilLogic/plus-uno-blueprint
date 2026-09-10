/**
 * A cell's resources: `resources` rows, in the shape the panel renders.
 *
 * There used to be a second source. The hand-written fallback blueprints in
 * `src/data` carried the retired jsonb array, whose `url` entries were their
 * resources, and half this file held the two outputs to each other so a bug
 * could not become "works in the fallback, broken in the app". Those
 * blueprints are gone — their content is rows — and with one source there is
 * no pair left to compare.
 *
 * What survives is what a row must do on its own: keep its name, kind, url
 * and order, keep the id a later write names it by, and say which placement
 * it belongs to.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { cellResourcesFromRows } from '@/lib/cellResources'

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

test('no resources from an empty source', () => {
  assert.deepEqual(cellResourcesFromRows([]), [])
  assert.deepEqual(cellResourcesFromRows(null), [])
})

test('a row carries its id', () => {
  // The id is what lets a later write name the row it means (#270): a
  // reorder that came back with fresh ids would have deleted and re-created
  // every row, and anything hung off a row would have gone with it.
  const [row] = cellResourcesFromRows([
    { id: 'r-1', position: 0, kind: 'link', name: 'Spec', url: 'https://spec.example.com/' },
  ])
  assert.equal(row.id, 'r-1')
})

test('a placement\u2019s row says whose it is, and whether it leads', () => {
  // #271: a placement's resources are the cell's too, so they arrive in the
  // same embed. The tab needs to know which are its own to edit and which a
  // touchpoint's, and which one the placement leads with.
  const resources = cellResourcesFromRows([
    { position: 0, kind: 'link', name: 'Spec', url: 'https://example.com/spec' },
    {
      position: 1,
      kind: 'attachment',
      name: 'PLUS App',
      url: '/blueprint-images/x.png',
      cell_touchpoint_id: 'placement-1',
      featured: true,
    },
  ])
  assert.deepEqual(
    resources.map((entry) => [entry.placementId, entry.featured]),
    [
      [null, false],
      ['placement-1', true],
    ],
  )
})

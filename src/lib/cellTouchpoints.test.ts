/**
 * A cell's touchpoints, from either source, in one shape.
 *
 * The board is drawn from two places. The database now has `cell_touchpoints`
 * rows, each carrying the name, order and per-moment detail explicitly. The
 * hand-written fallback blueprints in `src/data` have neither table nor role
 * column: they carry a delimited string in `content` and a parallel array of
 * `tech_description` links keyed by label, which is the arrangement this
 * whole ticket exists to retire — 57 of the 117 authored details in
 * production resolve to nothing because that key stopped matching.
 *
 * The fallback data is not migrating. So the join it depends on has to live
 * somewhere, and the only honest place is the normalizer, which is already
 * the boundary between "how a source stored it" and "what the app renders".
 * Every reader downstream then sees placements and never a label lookup.
 *
 * The load-bearing assertion is the last one: for the same board, the two
 * sources must produce the same output in every field a reader renders. A
 * test that only checked each source separately would pass while the two
 * drifted, which is how a bug becomes "works in the fallback, broken in the
 * app". Writing it that way also forced out the one field where they
 * genuinely cannot agree, which that test now states rather than hides.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  cellTouchpointsFromLinks,
  cellTouchpointsFromRows,
  findCellPlacement,
  resolveTouchpointDetail,
} from '@/lib/cellTouchpoints'

test('a placement row keeps its name, order and per-moment detail', () => {
  const touchpoints = cellTouchpointsFromRows([
    {
      position: 2,
      summary: 'The tutor opens the session detail page.',
      screenshot: '/shots/step-01.png',
      url: 'https://figma.example/node-1687',
      role: 'core',
      touchpoints: { name: 'PLUS App', kind: 'app', url: 'https://plus.example' },
    },
    {
      position: 1,
      summary: null,
      screenshot: null,
      url: null,
      role: null,
      touchpoints: { name: 'Zoom', kind: 'app', url: null },
    },
  ])

  // Sorted by position, not by the order the database returned them.
  assert.deepEqual(
    touchpoints.map((entry) => entry.name),
    ['Zoom', 'PLUS App'],
  )
  assert.equal(touchpoints[1]!.summary, 'The tutor opens the session detail page.')
  assert.equal(touchpoints[1]!.screenshot, '/shots/step-01.png')
  assert.equal(touchpoints[1]!.url, 'https://figma.example/node-1687')
  assert.equal(touchpoints[1]!.role, 'core')
  assert.equal(touchpoints[0]!.summary, null)
})

test('fallback content and links produce the same placements', () => {
  const touchpoints = cellTouchpointsFromLinks('Zoom, PLUS App', [
    {
      type: 'tech_description',
      label: 'PLUS App',
      description: 'The tutor opens the session detail page.',
      picture: '/shots/step-01.png',
      url: 'https://figma.example/node-1687',
    },
  ])

  assert.deepEqual(
    touchpoints.map((entry) => entry.name),
    ['Zoom', 'PLUS App'],
  )
  assert.equal(touchpoints[1]!.summary, 'The tutor opens the session detail page.')
  assert.equal(touchpoints[1]!.screenshot, '/shots/step-01.png')
  assert.equal(touchpoints[1]!.url, 'https://figma.example/node-1687')
  assert.equal(touchpoints[0]!.summary, null)
})

test('a fallback link naming nothing in the content is dropped, not guessed', () => {
  // This is the production defect in miniature: a link labelled for a
  // touchpoint the cell does not show. 57 rows are in this state. Attaching
  // it to whatever the cell DOES show would be the guess that caused them.
  const touchpoints = cellTouchpointsFromLinks('Zoom', [
    { type: 'tech_description', label: 'PLUS App', description: 'Wrong cell.' },
  ])

  assert.deepEqual(touchpoints.map((entry) => entry.name), ['Zoom'])
  assert.equal(touchpoints[0]!.summary, null)
})

test('non-touchpoint links are ignored', () => {
  // `links` also holds resources and provenance citations. Reading a `url`
  // entry as a touchpoint would put a filename on the board as a touchpoint.
  const touchpoints = cellTouchpointsFromLinks('Zoom', [
    { type: 'url', label: 'Zoom', url: 'https://example.com/doc' },
    { type: 'ref', label: 'Zoom' },
  ])

  assert.equal(touchpoints.length, 1)
  assert.equal(touchpoints[0]!.summary, null)
  assert.equal(touchpoints[0]!.url, null)
})

test('blank content yields no placements', () => {
  assert.deepEqual(cellTouchpointsFromLinks('', []), [])
  assert.deepEqual(cellTouchpointsFromLinks('  ,  ', []), [])
})

test('both sources agree on everything but the one field fallback cannot know', () => {
  // The assertion that matters, and the asymmetry it forced into the open.
  //
  // Same board, two storage shapes. Every field a reader renders must match,
  // or a bug becomes "works in the fallback, broken in the app". But `kind`
  // is genuinely unknowable from fallback data: there is no column, no link
  // field, and no honest way to derive "document" from a label. So it is
  // excluded here and pinned separately below, rather than papered over by
  // giving the database fixture a null it would not really have.
  const fromRows = cellTouchpointsFromRows([
    {
      position: 1,
      summary: 'Opens the dashboard.',
      screenshot: '/a.png',
      url: 'https://figma.example/a',
      role: null,
      touchpoints: { name: 'PLUS App', kind: 'other', url: null },
    },
    {
      position: 2,
      summary: null,
      screenshot: null,
      url: null,
      role: null,
      touchpoints: { name: 'Email', kind: 'other', url: null },
    },
  ])

  const fromLinks = cellTouchpointsFromLinks('PLUS App\nEmail', [
    {
      type: 'tech_description',
      label: 'PLUS App',
      description: 'Opens the dashboard.',
      picture: '/a.png',
      url: 'https://figma.example/a',
    },
  ])

  const withoutKind = (entries: ReturnType<typeof cellTouchpointsFromRows>) =>
    entries.map(({ kind: _kind, ...rest }) => rest)

  assert.deepEqual(withoutKind(fromLinks), withoutKind(fromRows))

  // And the excluded field, stated rather than assumed: the catalog knows,
  // the fallback cannot, and no reader may depend on fallback supplying it.
  assert.deepEqual(fromRows.map((entry) => entry.kind), ['other', 'other'])
  assert.deepEqual(fromLinks.map((entry) => entry.kind), [null, null])
})

/**
 * Resolving one placement's detail for the panel.
 *
 * The functions this replaces read `cells.links` by label and had grown two
 * hardcoded tool names as fallbacks — `techItem === 'Zoom'` and
 * `content === 'PLUS App'` — because the label lookup kept coming back empty
 * and someone patched the two cases they noticed. A placement carries its own
 * summary, so the general rule below covers what those special cases were
 * reaching for, and covers the other 90 touchpoints too.
 */
test('a named placement supplies its own detail', () => {
  const cell = {
    summary: 'The cell as a whole.',
    touchpoints: cellTouchpointsFromLinks('Zoom, PLUS App', [
      {
        type: 'tech_description',
        label: 'PLUS App',
        description: 'Opens the session detail page.',
        picture: '/a.png',
        url: 'https://figma.example/a',
      },
    ]),
  }

  const detail = resolveTouchpointDetail(cell, 'PLUS App')
  assert.equal(detail!.name, 'PLUS App')
  assert.equal(detail!.text, 'Opens the session detail page.')
  assert.equal(detail!.url, 'https://figma.example/a')
  assert.equal(detail!.screenshot, '/a.png')
})

test('a placement with no summary of its own falls back to the cell', () => {
  // What the two hardcoded tool names were doing, generalised. A touchpoint
  // nobody has described yet still shows the cell's sentence rather than
  // echoing its own name back at the reader.
  const cell = {
    summary: 'The tutor joins the session.',
    touchpoints: cellTouchpointsFromLinks('Zoom', []),
  }

  assert.equal(resolveTouchpointDetail(cell, 'Zoom')!.text, 'The tutor joins the session.')
})

test('with nothing to say it says the name, not an empty panel', () => {
  const cell = { summary: null, touchpoints: cellTouchpointsFromLinks('Zoom', []) }
  assert.equal(resolveTouchpointDetail(cell, 'Zoom')!.text, 'Zoom')
})

test('a single-touchpoint cell needs no name to resolve', () => {
  const cell = {
    summary: null,
    touchpoints: cellTouchpointsFromLinks('Zoom', [
      { type: 'tech_description', label: 'Zoom', description: 'Joins the room.' },
    ]),
  }
  assert.equal(resolveTouchpointDetail(cell)!.text, 'Joins the room.')
})

test('a multi-touchpoint cell with no name resolves nothing', () => {
  // Picking the first would put one touchpoint's screenshot under another
  // touchpoint's heading, which is the confusion this ticket is unwinding.
  const cell = { summary: null, touchpoints: cellTouchpointsFromLinks('Zoom, Email', []) }
  assert.equal(resolveTouchpointDetail(cell), null)
})

test('a name the cell does not place resolves nothing', () => {
  const cell = { summary: 'x', touchpoints: cellTouchpointsFromLinks('Zoom', []) }
  assert.equal(resolveTouchpointDetail(cell, 'PLUS App'), null)
})

test('a placement carries the row id an editor writes through', () => {
  // The handle the placement editor uses. Identity-keyed, so a rename in the
  // catalog or a reorder inside the cell cannot move the write onto a
  // different row that happens to spell the same.
  const [placement] = cellTouchpointsFromRows([
    {
      id: 'ct-1',
      position: 1,
      summary: null,
      screenshot: null,
      url: null,
      role: null,
      touchpoints: { name: 'Zoom' },
    },
  ])
  assert.equal(placement!.id, 'ct-1')
  assert.equal(resolveTouchpointDetail({ summary: null, touchpoints: [placement!] })!.id, 'ct-1')
})

test('a fallback placement has no id, so it has no editor', () => {
  // There is no row on a hand-written fixture board, so there is nowhere to
  // save into. Offering the form there would be offering a Save that writes
  // nothing — the failure `requireRowsWritten` exists to make loud.
  const [placement] = cellTouchpointsFromLinks('Zoom', [])
  assert.equal(placement!.id, null)
})

test('findCellPlacement returns the placement itself, unresolved', () => {
  // The editor needs the row's OWN summary, empty included. Seeding a form
  // from resolveTouchpointDetail would seed it with the CELL's sentence,
  // which the first Save would then write onto the placement — two things
  // saying the same words without anyone having decided they should.
  const cell = {
    summary: 'The tutor joins the session.',
    touchpoints: cellTouchpointsFromLinks('Zoom', []),
  }
  assert.equal(findCellPlacement(cell, 'Zoom')!.summary, null)
  assert.equal(resolveTouchpointDetail(cell, 'Zoom')!.text, 'The tutor joins the session.')
})

test('findCellPlacement and resolveTouchpointDetail agree on WHICH placement', () => {
  // One selection rule, two readings of the row it picks. If these ever
  // disagreed the panel would edit one placement while displaying another.
  const single = { summary: null, touchpoints: cellTouchpointsFromLinks('Zoom', []) }
  const several = { summary: null, touchpoints: cellTouchpointsFromLinks('Zoom, Email', []) }

  assert.equal(findCellPlacement(single)!.name, resolveTouchpointDetail(single)!.name)
  assert.equal(findCellPlacement(several), null)
  assert.equal(resolveTouchpointDetail(several), null)
  assert.equal(findCellPlacement(several, 'Email')!.name, 'Email')
  assert.equal(findCellPlacement(several, 'PLUS App'), null)
})

test('a role outside the vocabulary reads as unmarked', () => {
  // The state that asserts the least. A value the CHECK constraint does not
  // admit can still arrive through a seed, and rendering it as a badge would
  // put a word on screen that nothing defines.
  const [placement] = cellTouchpointsFromRows([
    {
      id: 'ct-9',
      position: 1,
      summary: null,
      screenshot: null,
      url: null,
      role: 'important',
      touchpoints: { name: 'Zoom' },
    },
  ])
  assert.equal(placement!.role, null)
})

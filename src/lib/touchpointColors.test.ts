import { afterEach, expect, test } from 'vitest'
import { TOUCHPOINT_TONES } from '@/lib/blueprintCellStyle'
import {
  clearTouchpointRegistry,
  getTouchpointTone,
  normalizeTouchpointLabel,
  setTouchpointRegistry,
  TOUCHPOINT_COLORS,
} from '@/lib/touchpointColors'
import { TOUCHPOINT_REGISTRY_FALLBACK } from '@/data/touchpointRegistryFallback'

afterEach(() => {
  clearTouchpointRegistry()
})

test('with no registry loaded, the generic seed still answers', () => {
  expect(getTouchpointTone('Zoom')).toBe('indigo')
  expect(getTouchpointTone('zoom')).toBe('indigo')
})

test('a stored tone beats the seed, which is the whole point of the column', () => {
  setTouchpointRegistry([{ name: 'Zoom', tone: 'gold', aliases: null }])
  expect(getTouchpointTone('Zoom')).toBe('gold')
})

test('an alias resolves to its row, and to that row’s tone', () => {
  setTouchpointRegistry([
    { name: 'Workday', tone: 'indigo', aliases: ['Workday (Employee View)'] },
  ])
  expect(normalizeTouchpointLabel('workday (employee view)')).toBe('Workday')
  expect(getTouchpointTone('Workday (Employee View)')).toBe('indigo')
})

/*
  `20260905120000` left uniqueness to the resolver rather than constraining it,
  so this is the rule it deferred. A name is an identity (ADR 0014) and an
  alias is a memory of one, so the identity wins — and it resolves silently,
  because a board must draw rather than throw when two rows disagree.
*/
test('a name beats another row’s alias for the same spelling', () => {
  setTouchpointRegistry([
    { name: 'Pencil', tone: 'red', aliases: null },
    { name: 'Zoom', tone: 'indigo', aliases: ['Pencil'] },
  ])
  expect(getTouchpointTone('Pencil')).toBe('red')
})

/*
  The column carries no CHECK constraint on purpose, so the reader is the only
  thing standing between a typo and a `data-blueprint-tone` no stylesheet
  answers.
*/
test('a tone outside the seven families is read as no preference', () => {
  const unchosen = getTouchpointTone('Kokomo')
  setTouchpointRegistry([{ name: 'Kokomo', tone: 'chartreuse', aliases: null }])
  expect(getTouchpointTone('Kokomo')).toBe(unchosen)
})

test('a name nobody has chosen for hashes, deterministically and the same each time', () => {
  const first = getTouchpointTone('Some Tool Nobody Named')
  setTouchpointRegistry([{ name: 'Something Else', tone: 'gold', aliases: null }])
  expect(getTouchpointTone('Some Tool Nobody Named')).toBe(first)
  expect(TOUCHPOINT_TONES).toContain(first)
})

/*
  The fixture is what a board with no database draws with, and nothing in the
  schema or the type system checks it — `tone` is plain text in the column and
  a plain string here. These are the two ways it can be wrong without anybody
  noticing until a board renders grey.
*/
test('the offline fixture only names tones the renderer can draw', () => {
  for (const entry of TOUCHPOINT_REGISTRY_FALLBACK) {
    expect(TOUCHPOINT_TONES, `${entry.name} carries an unknown tone`).toContain(
      entry.tone,
    )
  }
})

test('no fixture alias is another fixture entry’s name', () => {
  const names = new Set(
    TOUCHPOINT_REGISTRY_FALLBACK.map((entry) => entry.name.toLowerCase()),
  )
  for (const entry of TOUCHPOINT_REGISTRY_FALLBACK) {
    for (const alias of entry.aliases ?? []) {
      if (alias.toLowerCase() === entry.name.toLowerCase()) continue
      expect(
        names.has(alias.toLowerCase()),
        `${alias} is both an alias of ${entry.name} and a touchpoint of its own`,
      ).toBe(false)
    }
  }
})

/*
  The literal this file used to carry held twenty-odd PLUS tool names. #326's
  acceptance criterion is that none of them is left in code that every
  deployment shares, and #396 Q48 is the decision behind it: the machinery is
  generic, the vocabulary is the deployment's. A name creeping back into the
  seed map is exactly how that would be undone, one entry at a time.
*/
test('the seed map names no PLUS tool', () => {
  const seeded = new Set(Object.keys(TOUCHPOINT_COLORS))
  for (const name of ['PLUS App', 'Handshake', 'Workday', 'Zoom Recording']) {
    expect(
      seeded.has(name),
      `${name} is this deployment's vocabulary, not machinery every deployment shares`,
    ).toBe(false)
  }
  // Notion, Slack, Zoom and the rest of the seed ARE tools any service might
  // use, which is why the template ships them and this does not strip them.
  // The line is vocabulary a reader could only recognise as one deployment's.
  expect(seeded.has('Notion')).toBe(true)
  expect(seeded.has('Zoom')).toBe(true)
})

/**
 * The rename map's word lists come from the names the map records, and every
 * exemption still says why.
 *
 * There used to be a fourth test here, holding `CONTEXT.md`'s prose table
 * against `scripts/retired-vocabulary.mjs`. Two lists were the point: a prose
 * document should not be load-bearing for CI, and a documented map that had
 * drifted from the enforced one was a lie in the file people trust. #365
 * removed the prose half — the glossary defines terms and stops — so the pair
 * is a single list and the parity test has nothing left to compare. What that
 * test was protecting is now protected by there being one map.
 *
 * The exemption rules live here because they are the same argument. An
 * exemption that cannot expire is how the `Layer` breadcrumb survived six
 * months, and a permanent one that explains itself nowhere is the same thing
 * wearing a reason.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RENAME_MAP } from '../retired-vocabulary.mjs'
import {
  RETIRED_IDENTIFIER_EXEMPTIONS,
  staticFindings,
} from '../check-retired-identifiers.mjs'
import { DATABASE_NAME_EXEMPTIONS } from '../check-database-names.mjs'
import { replayMigrations } from '../migration-replay.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const SWEEP = resolve(ROOT, 'scripts/check-retired-identifiers.mjs')

/**
 * The leading `/** … *\/` of a script — the header a reader lands in.
 *
 * Read rather than imported, because the subject IS the prose: a rule about
 * what the header says cannot be satisfied by an exported constant.
 */
export function headerComment(source) {
  const end = source.indexOf('*' + '/')
  assert.ok(source.startsWith('#!') || source.startsWith('/**'), 'no header comment to read')
  assert.ok(end > 0, 'no header comment to read')
  return source.slice(0, end)
}

test('every enforced fragment comes from a name the map documents', () => {
  const stray = RENAME_MAP.flatMap((row) =>
    row.retired
      .filter((fragment) => !row.was.some((name) => name.toLowerCase().includes(fragment)))
      .map((fragment) => `${fragment} (row: ${row.was.join(', ')})`),
  )
  assert.deepEqual(
    stray,
    [],
    `Enforced as retired but not a substring of anything the row retired: ${stray.join(', ')}. ` +
      'The checks match substrings because a word buried in an identifier has no word ' +
      'boundary — but the substring still has to come from the documented map.',
  )
})

test('every retired prose spelling comes from a retired identifier', () => {
  const stray = RENAME_MAP.flatMap((row) => {
    const spoken = row.was.map((name) => name.replace(/[_*]/g, ' ').replace(/\s+/g, ' ').trim())
    return row.copy
      .filter((word) => !spoken.some((name) => name.includes(word.replace(/s$/, ''))))
      .map((word) => `${word} (row: ${row.was.join(', ')})`)
  })
  assert.deepEqual(
    stray,
    [],
    `A copy spelling with no identifier behind it: ${stray.join(', ')}. The copy guard's ` +
      'word list is the rename map read aloud, not a second list that can drift.',
  )
})

/* ---------------------------------------------------------- exemptions */

const ALL_EXEMPTIONS = [
  ...RETIRED_IDENTIFIER_EXEMPTIONS.map((entry) => ({ ...entry, list: 'identifier' })),
  ...DATABASE_NAME_EXEMPTIONS.map((entry) => ({ ...entry, list: 'database name' })),
]

test('every exemption states a reason, and an expiry or nothing', () => {
  for (const entry of ALL_EXEMPTIONS) {
    assert.ok(
      entry.because && entry.because.length > 20,
      `${entry.identifier} is exempt with no reason a stranger can evaluate`,
    )
    if (entry.until !== undefined) {
      assert.match(
        entry.until,
        /^#\d+$/,
        `${entry.identifier} expires on "${entry.until}" — an expiry is an issue number`,
      )
    }
  }
})

/**
 * Rule 1. A permanent exemption is a claim that the word means something here,
 * and a check that deliberately skips a word has to say so where it skips it.
 * Without this, "permanent" quietly means "nobody got round to it", which is
 * exactly how the `Layer` exemption aged.
 *
 * The subject was `CONTEXT.md` until #365. The glossary was where the reason
 * lived and the check was where it applied, so an exemption and its reason were
 * two files and two edits; the glossary is now a glossary and the reasoning
 * moved into the sweep's own header, which is what this reads.
 */
test("every permanent exemption rests on a word the sweep's header defines", () => {
  const schema = replayMigrations(resolve(ROOT, 'supabase/migrations'))
  const unfiltered = staticFindings(schema, { applyExemptions: false })
  const prose = headerComment(readFileSync(SWEEP, 'utf8')).toLowerCase()

  const undefined_ = []
  for (const entry of RETIRED_IDENTIFIER_EXEMPTIONS) {
    if (entry.until) continue
    const finding = unfiltered.find((one) => one.identifier === entry.identifier)
    for (const word of finding?.words ?? []) {
      if (!prose.includes(word)) undefined_.push(`${entry.identifier} → "${word}"`)
    }
  }
  assert.deepEqual(
    undefined_,
    [],
    'A permanent exemption rests on a word the header of ' +
      `scripts/check-retired-identifiers.mjs never explains: ${undefined_.join(', ')}. ` +
      'Say in that header what the word means here and why it survives, or give the ' +
      'exemption an `until`.',
  )
})

test('the header rule goes red on a header that stopped explaining itself', () => {
  const stripped = '/**\n * A sweep with nothing to say for itself.\n */\n'
  assert.equal(headerComment(stripped).includes('proposition'), false)
})

/**
 * Rule 2. Directly modelled on `src/lib/tokenDiscipline.test.ts`'s "every
 * vendored font-size exemption is still a file that needs one". The day #144's
 * re-embed lands, the `search_blueprint` entry starts failing until someone
 * removes it. An exemption that cannot expire is how this one survived six
 * months.
 */
test('every exemption is still a finding that needs one', () => {
  const schema = replayMigrations(resolve(ROOT, 'supabase/migrations'))
  const unfiltered = staticFindings(schema, { applyExemptions: false }).map((one) => one.identifier)
  const stale = RETIRED_IDENTIFIER_EXEMPTIONS.filter(
    (entry) => !unfiltered.includes(entry.identifier),
  ).map((entry) => entry.identifier)
  assert.deepEqual(
    stale,
    [],
    `Exempt from the identifier check but no longer flagged by it: ${stale.join(', ')}. ` +
      'The thing it excused is gone — delete the exemption. If it moved, move the ' +
      'exemption with it.',
  )
})

/**
 * The documented rename map and the enforced one still say the same thing.
 *
 * `CONTEXT.md`'s table is what a person reads to learn the vocabulary.
 * `scripts/retired-vocabulary.mjs` is what three checks read to enforce it.
 * Neither derives from the other, deliberately: a prose document should not be
 * load-bearing for CI, and reformatting a markdown table should not break a
 * build. But a documented map that has drifted from the enforced one is a lie
 * in the file people trust, so divergence is itself a failure — which is the
 * shape that would have caught this whole class.
 *
 * The exemption rules live here too, because they are the same argument. An
 * exemption that cannot expire is how the `Layer` breadcrumb survived six
 * months.
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
const CONTEXT = readFileSync(resolve(ROOT, 'CONTEXT.md'), 'utf8')

/* --------------------------------------------------------- CONTEXT.md */

/** The `| … | … | … |` rows under the rename-map heading, as raw cells. */
function documentedRows() {
  const section = /##\s+The rename map[^\n]*\n([\s\S]*?)\n##\s/.exec(CONTEXT)
  assert.ok(section, 'CONTEXT.md has no "## The rename map" section any more')
  return section[1]
    .split('\n')
    .filter((line) => line.trim().startsWith('|'))
    .map((line) => line.trim().slice(1, -1).split('|').map((cell) => cell.trim()))
    .filter((cells) => cells.length === 3 && !/^-+$/.test(cells[0].replace(/[\s:]/g, '')))
    .filter((cells) => cells[0].toLowerCase() !== 'was')
}

/** The `code spans` in a table cell, in order — the part that is data. */
const codeSpans = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1])

/** The rename-map table removed, so the rest of the file is definitions. */
function contextWithoutRenameTable() {
  return CONTEXT.split('\n')
    .filter((line) => !line.trim().startsWith('|'))
    .join('\n')
}

test('the enforced rename map still matches the one CONTEXT.md documents', () => {
  const documented = documentedRows().map((cells) => ({
    was: codeSpans(cells[0]),
    is: codeSpans(cells[1]),
    migrations: codeSpans(cells[2]),
  }))
  const enforced = RENAME_MAP.map((row) => ({
    was: [...row.was],
    is: [...row.is],
    migrations: [...row.migrations],
  }))
  assert.deepEqual(
    enforced,
    documented,
    'CONTEXT.md\'s rename map and scripts/retired-vocabulary.mjs disagree. Whichever ' +
      'moved, move the other: the documented map is what a person reads and the ' +
      'enforced map is what CI acts on, and a difference between them is the defect ' +
      'this whole batch of checks exists to end.',
  )
})

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
 * and a claim about what a word means belongs in the file that defines words.
 * Without this, "permanent" quietly means "nobody got round to it", which is
 * exactly how the `Layer` exemption aged.
 */
test('every permanent exemption rests on a word CONTEXT.md defines', () => {
  const schema = replayMigrations(resolve(ROOT, 'supabase/migrations'))
  const unfiltered = staticFindings(schema, { applyExemptions: false })
  const prose = contextWithoutRenameTable().toLowerCase()

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
    'A permanent exemption rests on a word CONTEXT.md does not define outside the ' +
      `rename map: ${undefined_.join(', ')}. Give the word a glossary entry saying what ` +
      'it means here and why it survives, or give the exemption an `until`.',
  )
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

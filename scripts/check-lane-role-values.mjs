#!/usr/bin/env node
/**
 * #395 — retired lane-role VALUES, anywhere in the tracked tree.
 *
 * `check-database-names.mjs` sweeps string literals that name a database
 * OBJECT: a table, a column, a function. This one sweeps a different axis —
 * the VALUES a constrained column accepts — and nothing was watching it.
 * `20260830150000` renamed the two touchpoint lane roles and `20260830270000`
 * settled the vocabulary in a CHECK constraint, and a fortnight later
 * `docs/reference/erd.mmd` was still teaching the retired spellings and
 * `src/lib/agent/tools/specs.ts` was still offering them to the model as the
 * value set of its `lane_role` filter.
 *
 * The tool spec is the sharp half. A name a compiler can reach fails a build;
 * a VALUE fails nothing. An agent handed a filter value the constraint no
 * longer admits writes a call that is rejected at save time, or — worse —
 * reads with a filter that matches no lane and gets an empty result that
 * looks exactly like an honest answer. Nothing raises, nothing logs, and the
 * blueprint appears not to cover something it covers.
 *
 * ── THE VOCABULARY IS DERIVED, ON BOTH SIDES ──────────────────────────────
 *
 * A check that carried its own copy of the value set would rot the same way
 * the two documents did, so neither list is written here.
 *
 *   LIVE     `rolesInConstraint()` in `scripts/lane-roles.mjs` — the
 *            `lane_role in (…)` list of the CHECK constraint that is on the
 *            table today.
 *   EVER     every value the migration series binds to `lane_role` or its
 *            pre-rename name `layer_role`: the constraint lists, the
 *            comparisons and assignments, and the "Canonical values:"
 *            sentence of the column comment. `laneRoleValuesInSeries` below.
 *   RETIRED  EVER minus LIVE. Nothing else.
 *
 * The derivation is only sound while `CONSTRAINT_MIGRATION` really is the
 * last migration to define the constraint, so `latestConstraintMigration`
 * recomputes that from the series and `staleConstraintPointer` reports the
 * disagreement rather than letting a later redefinition be read as history.
 *
 * ── WHAT IS SWEPT, AND THE ONE VALUE THAT IS NOT ──────────────────────────
 *
 * SUBJECT: a retired value written as a whole word, in any tracked text file.
 * Whole word matters twice over. It is what makes the sweep safe — a longer
 * identifier that merely contains a retired value (`add_step_visual_layer`,
 * a migration filename recorded in the replay baseline) is a different name
 * and not a use of the value. And it is why the sweep can be this wide at
 * all: these are snake_case tokens, and a snake_case token in prose is
 * somebody quoting the database.
 *
 * A retired value with NO underscore is declined, because it is an ordinary
 * English word rather than a token — `visual` retired as a lane role in
 * `20260830270000`, and sweeping it would flag every sentence in the
 * repository that uses the adjective. Declining it is safe only because
 * something else holds it: `unheldDeclinedValues` reports a finding unless the
 * rename map already carries every declined value in its `retired` list,
 * where `check:identifiers`, `check:copy` and the swept-prose guard reach it.
 * A value that fell out of both would fail this check rather than quietly
 * become unguarded.
 *
 * ── WHAT IS EXEMPT ────────────────────────────────────────────────────────
 *
 * DATED RECORDS keep the spelling they were written with. A plan, a piece of
 * ideation, a brainstorm, an ADR, an archived export, a migration and a
 * changelog entry are all records OF A DAY, and rewriting one to agree with
 * today's schema falsifies it. Same list, same reasoning as
 * `scripts/swept-docs.mjs`.
 *
 * TEST FILES, for the two reasons `check-database-names.mjs` gives for the
 * same exclusion. A test that names a dead value fails the moment it runs,
 * which is what a test is for — the whole reason this check exists is that a
 * document carrying the same word fails nothing. And a guard's own fixtures
 * have to be able to name dead values: `scripts/tests/lane-role-values.test.mjs`
 * proves this sweep fires by writing one, and `presentation-keys.test.mjs`
 * explains a fill rename by naming the roles it came from.
 *
 * THREE NAMED SITES, in `LANE_ROLE_VALUE_EXEMPTIONS`, all permanent — so, by
 * the rule in `scripts/tests/retired-vocabulary.test.mjs`, each word behind
 * one is explained here:
 *
 *   The two `*_tech` role spellings are what `scripts/retired-vocabulary.mjs`
 *   RECORDS. It is the repository's rename map: the one place a retired name
 *   is written down beside the name that replaced it, and the source three
 *   other guards read their word lists from. A map of what retired has to be
 *   able to spell what retired.
 *
 *   `support_systems` and `step_visual` are named by `scripts/lane-roles.mjs`
 *   and `src/lib/laneRoles.ts`, in one sentence each, and the sentence is the
 *   history: both were listed as canonical roles for months while no lane
 *   ever held either, which is why the vocabulary is now a constraint instead
 *   of three lists that disagreed. Neither was renamed, so neither has a
 *   replacement to point at, and a comment that said "two roles nothing used"
 *   without naming them would be explaining nothing. `src/lib/laneRoles.ts`
 *   is additionally the one file where a resurrected value could not hide:
 *   `scripts/tests/lane-roles.test.mjs` holds its `CANONICAL_LANE_ROLES` to
 *   the CHECK constraint, value for value.
 *
 * AND THIS FILE, for the values it exempts and no others. The house rule is
 * that a permanent exemption is explained where it is applied, which means
 * the paragraphs above have to write the words down. That self-exemption is
 * DERIVED from `LANE_ROLE_VALUE_EXEMPTIONS` rather than listed — see
 * `effectiveExemptions` — so it can never cover a value this file has stopped
 * excusing, and a retired value that reaches this header for any other reason
 * is a finding like any other.
 *
 * Static, needs no database, runs in `gates`.
 *
 * Run: node scripts/check-lane-role-values.mjs  (also: npm run check:lane-role-values)
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  CONSTRAINT_MIGRATION,
  MIGRATIONS_DIR,
  rolesInConstraint,
} from './lane-roles.mjs'
import {
  RENAME_MAP,
  RETIRED_IDENTIFIER_FRAGMENTS,
  replacementFor,
} from './retired-vocabulary.mjs'

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname)

/** This file, as the sweep names it. See the header's last exemption. */
const SELF = 'scripts/check-lane-role-values.mjs'

/**
 * Trees and files that keep the spelling of the day they were written.
 *
 * Prefix-matched against the repo-relative path. `swept-docs.mjs` states the
 * same rule for the markdown sweeps and gives the same reason; the two lists
 * are not shared because this one also covers the migrations, the changelog
 * and the archived exports, none of which is a document that sweep reads.
 */
export const DATED_RECORDS = [
  'docs/plans/',
  'docs/ideation/',
  'docs/brainstorms/',
  'docs/adr/',
  'docs/archive/',
  'supabase/migrations/',
  '.changeset/',
  'CHANGELOG.md',
]

/** Test files, excluded for the two reasons the header gives. */
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/

/**
 * Files allowed to write a retired lane-role value, one value at a time.
 *
 * The identifier is `<repo-relative path> <value>` rather than the
 * `file:line value` the sibling checks use. A line number is right for a
 * finding in code, which moves when the code around it changes; these three
 * are PROSE about the vocabulary, and pinning a paragraph of commentary to a
 * line number would make every edit above it a false failure.
 *
 * Every entry is permanent, so every word behind one is explained in this
 * file's header — see `scripts/tests/retired-vocabulary.test.mjs`.
 *
 * @type {ReadonlyArray<import('./retired-vocabulary.mjs').Exemption>}
 */
export const LANE_ROLE_VALUE_EXEMPTIONS = [
  {
    identifier: 'scripts/retired-vocabulary.mjs frontstage_tech',
    because:
      'the rename map is where a retired name is written down beside the name ' +
      'that replaced it, and three other guards read their word lists from it',
  },
  {
    identifier: 'scripts/retired-vocabulary.mjs backstage_tech',
    because:
      'the rename map is where a retired name is written down beside the name ' +
      'that replaced it, and three other guards read their word lists from it',
  },
  {
    identifier: 'scripts/lane-roles.mjs support_systems',
    because:
      'the reader of the vocabulary explains, in one sentence, that this role ' +
      'was listed as canonical for months while no lane ever held it',
  },
  {
    identifier: 'scripts/lane-roles.mjs step_visual',
    because:
      'the reader of the vocabulary explains, in one sentence, that this role ' +
      'was listed as canonical for months while no lane ever held it',
  },
  {
    identifier: 'src/lib/laneRoles.ts support_systems',
    because:
      'CANONICAL_LANE_ROLES says why it no longer lists this role, and the ' +
      'list itself is held to the CHECK constraint by lane-roles.test.mjs',
  },
  {
    identifier: 'src/lib/laneRoles.ts step_visual',
    because:
      'CANONICAL_LANE_ROLES says why it no longer lists this role, and the ' +
      'list itself is held to the CHECK constraint by lane-roles.test.mjs',
  },
]

/* ------------------------------------------------------------ vocabulary */

/** Migration filenames in series order. */
function migrationsInOrder(root) {
  return readdirSync(resolve(root, MIGRATIONS_DIR))
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

/**
 * Every value the migration series binds to `lane_role` (or to `layer_role`,
 * the name the column carried before `20260820120000`).
 *
 * Three shapes, and all three are needed. The constraint lists carry the
 * whole vocabulary of their day; the comparisons and assignments carry the
 * values a data migration actually moved rows between; and the column
 * comment's "Canonical values:" sentence carries the two roles that were only
 * ever documented, never constrained and never held by a row — which is
 * precisely how they went unnoticed.
 *
 * Deliberately NOT a general sweep for quoted tokens near the column name. A
 * 400-character window around `lane_role` picks up `'app'`, `'cell'` and the
 * alias of whatever join it sits in, and a vocabulary reader that returns
 * junk makes the subtraction below return junk too.
 */
export function laneRoleValuesInSeries(root = REPO_ROOT) {
  const found = new Set()
  const column = String.raw`(?:lane_role|layer_role)`
  for (const name of migrationsInOrder(root)) {
    const sql = readFileSync(resolve(root, MIGRATIONS_DIR, name), 'utf8')
    for (const list of sql.matchAll(new RegExp(`\\b${column}\\s+in\\s*\\(([^)]*)\\)`, 'gis'))) {
      for (const value of list[1].matchAll(/'([a-z][a-z_]*)'/g)) found.add(value[1])
    }
    for (const bound of sql.matchAll(new RegExp(`\\b${column}\\s*=\\s*'([a-z][a-z_]*)'`, 'gi'))) {
      found.add(bound[1])
    }
    const pattern = `comment\\s+on\\s+column\\s+[\\w.]+\\.${column}\\s+is([\\s\\S]*?);`
    for (const comment of sql.matchAll(new RegExp(pattern, 'gi'))) {
      // The comment is written as adjacent string literals, so the seams
      // between them are removed before the sentence is read.
      const listed = /Canonical values:([^.]*)\./i.exec(comment[1].replace(/'\s*'/g, ''))
      if (!listed) continue
      for (const value of listed[1].split(',').map((entry) => entry.trim())) {
        if (/^[a-z][a-z_]*$/.test(value)) found.add(value)
      }
    }
  }
  if (found.size === 0) {
    throw new Error(
      `no lane-role value is named anywhere in ${MIGRATIONS_DIR}. The reader ` +
        `in scripts/check-lane-role-values.mjs can no longer see the ` +
        `vocabulary, so nothing is being compared. Fix the reader.`,
    )
  }
  return [...found].sort()
}

/** The last migration that DEFINES the lane-role CHECK constraint. */
export function latestConstraintMigration(root = REPO_ROOT) {
  const defines = /add\s+constraint\s+lanes_lane_role_check/i
  const found = migrationsInOrder(root).filter((name) =>
    defines.test(readFileSync(resolve(root, MIGRATIONS_DIR, name), 'utf8')),
  )
  if (found.length === 0) {
    throw new Error(
      `no migration in ${MIGRATIONS_DIR} adds lanes_lane_role_check. The ` +
        `constraint this check reads the live vocabulary out of is gone.`,
    )
  }
  return found.at(-1)
}

/**
 * A sentence when `scripts/lane-roles.mjs` points at a migration that a later
 * one has redefined past, and null when it does not.
 *
 * This is the soundness condition of everything below. If a migration after
 * `CONSTRAINT_MIGRATION` redefines the constraint, then `rolesInConstraint()`
 * returns a HISTORICAL vocabulary — and every value the current constraint
 * added since would be subtracted into the retired set and swept out of the
 * tree. `lane-roles.test.mjs` asserts only that the pointed-at file exists,
 * which a redefinition leaves true.
 */
export function staleConstraintPointer(root = REPO_ROOT) {
  const latest = latestConstraintMigration(root)
  if (latest === CONSTRAINT_MIGRATION) return null
  return (
    `scripts/lane-roles.mjs reads the lane-role vocabulary out of ` +
    `${CONSTRAINT_MIGRATION}, but ${latest} redefines lanes_lane_role_check ` +
    `after it. Point CONSTRAINT_MIGRATION at the later file — until then the ` +
    `live vocabulary is being read from history.`
  )
}

/**
 * The retired values, split into the ones this check sweeps and the ones it
 * declines. See the header for why a value with no underscore is declined.
 */
export function retiredLaneRoleValues(root = REPO_ROOT) {
  const live = new Set(rolesInConstraint(root))
  const retired = laneRoleValuesInSeries(root).filter((value) => !live.has(value))
  return {
    swept: retired.filter((value) => value.includes('_')),
    declined: retired.filter((value) => !value.includes('_')),
  }
}

/**
 * A sentence for every declined value the rename map does not carry, and an
 * empty list when it carries them all.
 *
 * Declining a value is only safe while another guard holds it. This is what
 * stops the narrowing above from silently becoming a hole the day somebody
 * retires a second one-word role.
 */
export function unheldDeclinedValues(declined, fragments = RETIRED_IDENTIFIER_FRAGMENTS) {
  return declined
    .filter((value) => !fragments.includes(value))
    .map(
      (value) =>
        `the lane role '${value}' is retired, is a single English word so this ` +
        `check declines to sweep it, and is not in the rename map's \`retired\` ` +
        `list either — so nothing holds it. Add it to scripts/retired-vocabulary.mjs.`,
    )
}

/**
 * The exemptions actually applied: the declared list, plus this file's own
 * right to spell the words it exempts. Derived, for the reason the header
 * gives — a hand-written self-exemption could outlive the entry it explains.
 */
export function effectiveExemptions(declared = LANE_ROLE_VALUE_EXEMPTIONS) {
  const self = [...new Set(declared.map((entry) => entry.identifier.split(' ').at(-1)))]
  return new Set([
    ...declared.map((entry) => entry.identifier),
    ...self.map((value) => `${SELF} ${value}`),
  ])
}

/* ------------------------------------------------------------------ sweep */

/**
 * The name that replaced one retired VALUE, not the row it came from.
 *
 * `replacementFor` answers for the row — "frontstage_touchpoints /
 * backstage_touchpoints" — which is right for an identifier fragment that
 * could have come from either name. A value is one specific name, and the
 * message that tells somebody what to write instead should say one thing, so
 * the `is` at the same index is preferred where the row has one.
 */
export function replacementForValue(value, map = RENAME_MAP) {
  for (const row of map) {
    const index = row.was.indexOf(value)
    if (index !== -1 && row.is[index]) return row.is[index]
  }
  return replacementFor(value)
}

/** Repo-relative paths of every tracked file, in git's order. */
export function trackedFiles(root = REPO_ROOT) {
  const listing = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return listing.split('\0').filter(Boolean)
}

/** Whether a repo-relative path is out of subject entirely. */
export function isExemptPath(path) {
  if (TEST_FILE.test(path)) return true
  return DATED_RECORDS.some((entry) =>
    entry.endsWith('/') ? path.startsWith(entry) : path === entry,
  )
}

/** `{ line, value }` for every whole-word occurrence, in file order. */
export function occurrences(text, values) {
  const found = []
  text.split('\n').forEach((line, index) => {
    for (const value of values) {
      if (new RegExp(`\\b${value}\\b`).test(line)) found.push({ line: index + 1, value })
    }
  })
  return found
}

/** The text of a tracked file, or null when it is not text at all. */
function readText(root, path) {
  let buffer
  try {
    buffer = readFileSync(resolve(root, path))
  } catch {
    // A path git tracks but the working tree does not have — a submodule
    // gitlink, or a file removed but not yet staged. Neither is a document.
    return null
  }
  if (buffer.includes(0)) return null
  return buffer.toString('utf8')
}

/**
 * Every finding, in file order.
 *
 * `applyExemptions: false` returns the unfiltered set, which is what
 * `scripts/tests/lane-role-values.test.mjs` needs to assert that every
 * exemption is still excusing something real.
 */
export function findings(root = REPO_ROOT, { applyExemptions = true, files } = {}) {
  const { swept } = retiredLaneRoleValues(root)
  const exempt = effectiveExemptions()
  const out = []
  for (const path of files ?? trackedFiles(root)) {
    if (isExemptPath(path)) continue
    const text = readText(root, path)
    if (text === null) continue
    for (const { line, value } of occurrences(text, swept)) {
      const identifier = `${path} ${value}`
      if (applyExemptions && exempt.has(identifier)) continue
      out.push({ file: path, line, value, identifier, replacement: replacementForValue(value) })
    }
  }
  return out
}

function main() {
  const stale = staleConstraintPointer()
  if (stale) {
    console.error(`::error file=scripts/lane-roles.mjs::${stale}`)
    process.exit(1)
  }

  const { swept, declined } = retiredLaneRoleValues()
  const unheld = unheldDeclinedValues(declined)
  for (const problem of unheld) console.error(`::error file=${'scripts/retired-vocabulary.mjs'}::${problem}`)

  const problems = findings()
  for (const problem of problems) {
    const instead = problem.replacement
      ? `the schema calls it ${problem.replacement}`
      : 'the constraint retired it with no replacement, so the mention goes'
    console.error(
      `::error file=${problem.file},line=${problem.line}::\`${problem.value}\` is not a ` +
        `lane_role the CHECK constraint accepts — ${instead}. Nothing typechecks a value.`,
    )
  }

  if (problems.length + unheld.length > 0) {
    console.error(
      `\n${problems.length} retired lane-role value(s) in the tracked tree. A value the ` +
        `constraint refuses is a write that fails at save time and a read that comes back ` +
        `empty while reporting success.`,
    )
    process.exit(1)
  }
  console.log(
    `ok — no tracked file outside the dated records spells one of the ` +
      `${swept.length} retired lane roles (${swept.join(', ')})`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) main()

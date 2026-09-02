/**
 * #177 — one spelling each, for the renames a substring cannot express.
 *
 * The rename map is this repository's one seam for vocabulary, and three
 * checks read it. Two of the eight renames in this ticket cannot be enforced
 * through it, and the reason is structural rather than an oversight:
 * `scripts/check-retired-identifiers.mjs` matches SUBSTRINGS, and a rename
 * that adds a prefix or a plural leaves the retired name inside the current
 * one. `findings` is a substring of `audit_findings`; `business_model` is a
 * substring of `business_models`. Any fragment that catches the old name
 * catches the new one, so the map carries those rows with an empty `retired`
 * list and this file carries the assertion instead.
 *
 * Three more are blocked for the other reason: the retired word is still a
 * live, correct name somewhere else. `label` stays on `deleted_structure`,
 * `note` stays on `paths` because a path's note genuinely is an aside, and
 * `origin` stays on the six core tables — `services` gains one here. A bare
 * fragment would flag all of them.
 *
 * SUBJECT: TABLE AND COLUMN NAMES ONLY, table-qualified. That is the whole
 * reason this check can say `description` at all. The word survives in the
 * file series as an argument of `create_phase`, which production does not
 * carry — `20260820160000` swept the body and its `replace()` target was
 * written for a signature the function no longer had, so the repository's
 * replay and the database disagree about that one argument. Naming columns
 * rather than identifiers-at-large means this check is about the schema's
 * vocabulary and not about that stale argument, which is #145's subject and
 * somebody else's repair.
 *
 * Both directions are asserted. Absence alone passes against a schema that
 * dropped the tables entirely, so every retirement names the column that
 * replaced it and both halves have to hold.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { replayMigrations } from '../migration-replay.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)

/**
 * Each retirement this ticket makes, as `retired` → `current`.
 *
 * A bare table name means the table itself; `table.column` means the column.
 * `why` is the reason the rename map cannot carry this one, so that the next
 * person adding a rename knows which of the two lists their entry belongs in.
 */
export const ONE_SPELLING = Object.freeze([
  {
    retired: 'findings',
    current: 'audit_findings',
    why: 'a prefix rename — every substring of `findings` is also a substring of `audit_findings`',
  },
  {
    retired: 'business_model',
    current: 'business_models',
    why: 'a pluralisation — `business_model` is a substring of `business_models`',
  },
  {
    retired: 'findings.check_name',
    current: 'audit_findings.check_key',
    why: 'enforced as a fragment too; asserted here so the table rename and the column rename are read as one change',
  },
  {
    retired: 'findings.note',
    current: 'audit_findings.summary',
    why: '`note` stays a live column on `paths`, where an aside genuinely is an aside',
  },
  {
    retired: 'slices.description',
    current: 'slices.summary',
    why: '`description` survives in the file series as a `create_phase` argument production does not have',
  },
  {
    retired: 'cells.description',
    current: 'cells.summary',
    why: 'renamed by 20260820090000; asserted here so the roster and `a-form-key-is-a-column` name the same pair, which is what let the form key drift for twelve days (#261)',
  },
  {
    retired: 'slices.slice_type',
    current: 'slices.kind',
    why: 'enforced as a fragment too; asserted here so the four classifier renames read as one set',
  },
  {
    retired: 'slices.origin',
    current: 'slices.authorship',
    why: '`origin` stays on six core tables, and `services` gains one in this same migration',
  },
  {
    retired: 'cell_dependencies.label',
    current: 'cell_dependencies.name',
    why: '`label` stays a live column on `deleted_structure`',
  },
  {
    retired: 'paths.path_type',
    current: 'paths.kind',
    why: 'enforced as a fragment too; asserted here so the four classifier renames read as one set',
  },
  {
    retired: 'scenarios.view_type',
    current: 'scenarios.layout',
    why: 'enforced as a fragment too; asserted here so the four classifier renames read as one set',
  },
  {
    retired: 'cell_touchpoints.url',
    current: 'resources.url',
    why: 'a placement\'s link is a featured resource since 20260902130000; 20260902160000 dropped the column (#276). `url` stays live on `resources` and `touchpoints`',
  },
  {
    retired: 'cell_touchpoints.screenshot',
    current: 'resources.kind',
    why: 'a placement\'s screenshot is a featured attachment — a resource whose kind says so — since 20260902130000; the column went with #276. `screenshot` stays on the unplaced queue until #277',
  },
])

/** The two columns this ticket drops outright, with nothing taking their place. */
export const DROPPED = Object.freeze(['cell_dependencies.note', 'evidence.note'])

/** The column that keeps a word of its own, and the reason it is allowed to. */
export const DOCUMENTED_EXCEPTION = 'cells.content'

const has = (schema, path) => {
  const [table, column] = path.split('.')
  const row = schema.tables.get(table)
  if (!row) return false
  return column === undefined ? true : row.columns.has(column)
}

/** Every place the schema still spells a retired name, or has lost a current one. */
export function residue(schema) {
  const out = []
  for (const entry of ONE_SPELLING) {
    if (has(schema, entry.retired)) {
      out.push(`${entry.retired} still exists — it is ${entry.current} now (${entry.why})`)
    }
    if (!has(schema, entry.current)) {
      out.push(`${entry.current} does not exist, so ${entry.retired} was not renamed to it`)
    }
  }
  for (const path of DROPPED) {
    if (has(schema, path)) out.push(`${path} still exists — it was empty on every row and is dropped`)
  }
  return out
}

const SCHEMA = replayMigrations(resolve(ROOT, 'supabase/migrations'))

test('the schema spells each of these ideas exactly one way', () => {
  assert.deepEqual(
    residue(SCHEMA),
    [],
    'A retired spelling is still in the schema, or the name that replaced it is not. ' +
      'These are the renames scripts/retired-vocabulary.mjs cannot enforce as ' +
      'substrings — see the `why` on each entry — so this is the only thing holding them.',
  )
})

test('the check goes red on a schema that never did the rename', () => {
  // A check that is green against the tree could equally be a check that
  // examines nothing. `scripts/tests/rls-posture.test.mjs` makes the argument;
  // this is the same shape. Each half is failed on its own, because the two
  // directions catch different mistakes: a rename never written, and a rename
  // written as a drop.
  const before = {
    tables: new Map([
      ['findings', { name: 'findings', columns: new Map([['note', {}], ['check_name', {}]]) }],
      ['business_model', { name: 'business_model', columns: new Map() }],
      ['slices', { name: 'slices', columns: new Map([['description', {}], ['slice_type', {}], ['origin', {}]]) }],
      ['cells', { name: 'cells', columns: new Map([['description', {}]]) }],
      ['cell_dependencies', { name: 'cell_dependencies', columns: new Map([['label', {}], ['note', {}]]) }],
      ['paths', { name: 'paths', columns: new Map([['path_type', {}]]) }],
      ['scenarios', { name: 'scenarios', columns: new Map([['view_type', {}]]) }],
      ['evidence', { name: 'evidence', columns: new Map([['note', {}]]) }],
      ['cell_touchpoints', { name: 'cell_touchpoints', columns: new Map([['screenshot', {}], ['url', {}]]) }],
    ]),
  }
  const found = residue(before)
  // Every retirement failing both halves, plus the dropped columns.
  assert.equal(found.length, ONE_SPELLING.length * 2 + DROPPED.length)
  assert.ok(found.some((one) => /^findings still exists/.test(one)))
  assert.ok(found.some((one) => /^audit_findings does not exist/.test(one)))
  assert.ok(found.some((one) => /^cell_dependencies\.note still exists/.test(one)))

  // And red the other way: the rename read as a drop, with nothing arriving.
  const dropped = { tables: new Map() }
  assert.equal(residue(dropped).length, ONE_SPELLING.length)
  assert.ok(residue(dropped).every((one) => /does not exist/.test(one)))
})

/**
 * `cells.content` is the one column in the board that carries neither `name`
 * nor `title` nor `summary`, and it keeps its own word on purpose: a cell's
 * text is a sentence somebody wrote, not a label for the cell. An exception
 * that is only a decision in somebody's head is indistinguishable from an
 * oversight three months later, so it is written where the schema keeps its
 * prose and asserted here.
 */
test('the one exception says out loud that it is one', () => {
  assert.ok(
    has(SCHEMA, DOCUMENTED_EXCEPTION),
    `${DOCUMENTED_EXCEPTION} is gone — if it was renamed, this ticket's exception went with it`,
  )
  const comment = SCHEMA.comments.get(`column:${DOCUMENTED_EXCEPTION}`)
  assert.ok(comment, `${DOCUMENTED_EXCEPTION} carries no comment saying why it keeps its own word`)
  assert.match(
    comment.text,
    /sentence/i,
    `the comment on ${DOCUMENTED_EXCEPTION} does not say what makes it an exception: ` +
      `a cell's text is a sentence, not a name. Got: ${comment.text}`,
  )
})

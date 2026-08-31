/**
 * #174 — the three integrity guards, and the proof that this file can fail.
 *
 * The guards themselves are PERFORMED in
 * `supabase/migrations/20260830180000_the_two_gaps_that_were_actually_open.sql`:
 * it builds a fixture, moves a lane out from under its cells, updates
 * `stakeholders` as an unprivileged `authenticated` session, adds a second
 * permissive policy beside the gate, and raises if any of those succeeds. That
 * is the assertion the ticket asks for and it is not in this file, because it
 * needs a database and this repository has none to give a pull request.
 *
 * What is here is the declaration side, and — the part worth reading — every
 * assertion is shown going RED first. Each reader is pointed at a tree with
 * the declaration cut out of it, because a comparison of two lists a reader
 * failed to find passes exactly as loudly as a comparison of two lists that
 * agree. That is the argument `scripts/tests/rls-posture.test.mjs` makes, and
 * the reason it is made again here is that all three of these guards are
 * invisible in the place a person would look for them: the status constraint
 * hangs off a DOMAIN and does not appear against the table, and the policy
 * statements live inside a `do` block that the static migration model treats
 * as opaque text.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import {
  GUARD_MIGRATION,
  MIGRATIONS_DIR,
  STATUS_DOMAIN_MIGRATION,
  STATUS_PATH,
  columnsOnStatusDomain,
  laneIdentityKey,
  migrationFilenames,
  pathMatchesLaneKey,
  policyPairGaps,
  stakeholderPolicies,
  statusesInCode,
  statusesInDomain,
} from '../integrity-guards.mjs'

const REPO_ROOT = resolve(new URL('../..', import.meta.url).pathname)

const source = (relative) => readFileSync(resolve(REPO_ROOT, relative), 'utf8')
const guardSource = () => source(`${MIGRATIONS_DIR}/${GUARD_MIGRATION}`)
const domainSource = () => source(`${MIGRATIONS_DIR}/${STATUS_DOMAIN_MIGRATION}`)

/** A throwaway repository containing only the files a reader needs. */
function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'integrity-guards-'))
  for (const [relative, contents] of Object.entries(files)) {
    const full = join(root, relative)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, contents)
  }
  return root
}

/* ------------------------------------------------------------ the pinning */

test('the migrations these readers name still exist', () => {
  const present = migrationFilenames()
  for (const pinned of [GUARD_MIGRATION, STATUS_DOMAIN_MIGRATION]) {
    assert.ok(
      present.includes(pinned),
      `scripts/integrity-guards.mjs points at ${pinned}, which is not in ` +
        `${MIGRATIONS_DIR}. If a later migration redefined what it declares, ` +
        `point the constant at that file rather than deleting the check.`,
    )
  }
})

/* ------------------------------------------------------------- the status */

test('the status vocabulary is one list, in the schema and in the panel', () => {
  // #174 asked for a CHECK on `cells.status` and `paths.status` on the
  // grounds that they "accept any string". They do not: both are on the
  // `entity_status` domain, whose constraint hangs off the TYPE and therefore
  // never shows up against the table. Nothing was added; this is the
  // comparison that would have answered the question.
  assert.deepEqual(
    [...statusesInDomain()].sort(),
    [...statusesInCode()].sort(),
    'the entity_status domain and ENTITY_STATUS disagree. A value the panel ' +
      'offers and the domain refuses is a save that fails on a legal choice; ' +
      'a value the domain admits and the panel never offers is a status no ' +
      'reader has a label for.',
  )
})

test('both status columns are on the domain, not merely named for it', () => {
  // The column keeps its name, its underlying text type and every row it held
  // if it is ever moved off the domain, and starts accepting anything. That
  // is the state #174 described, and asserting the domain's vocabulary alone
  // would not notice it.
  assert.deepEqual(columnsOnStatusDomain(), ['cells.status', 'paths.status'])
})

test('the status readers go red when the declaration is gone', () => {
  const withoutDomain = tree({
    [`${MIGRATIONS_DIR}/${STATUS_DOMAIN_MIGRATION}`]: domainSource().replace(
      /check \(value in \([^)]*\)\)/i,
      '',
    ),
    [STATUS_PATH]: source(STATUS_PATH),
  })
  assert.throws(() => statusesInDomain(withoutDomain), /no longer creates/)

  const withoutColumns = tree({
    [`${MIGRATIONS_DIR}/${STATUS_DOMAIN_MIGRATION}`]: domainSource().replaceAll(
      'public.entity_status',
      'text',
    ),
  })
  assert.throws(() => columnsOnStatusDomain(withoutColumns), /puts no column/)

  const withoutList = tree({
    [STATUS_PATH]: source(STATUS_PATH).replace('export const ENTITY_STATUS = [', 'const X = ['),
  })
  assert.throws(() => statusesInCode(withoutList), /no longer declares/)
})

/* ------------------------------------------------------- the composite key */

test('a cell references its lane and its path together', () => {
  const key = pathMatchesLaneKey()
  // Order, not membership. (path_id, lane_id) -> (path_id, id) is a different
  // rule that holds over the same rows today and would keep holding after
  // this one stopped.
  assert.deepEqual(key.referencing, ['lane_id', 'path_id'])
  assert.equal(key.referencedTable, 'lanes')
  assert.deepEqual(key.referenced, ['id', 'path_id'])
})

test('the unique key the foreign key references is declared beside it', () => {
  // Not belt and braces: a foreign key must reference a DECLARED unique or
  // primary key, and Postgres will not infer that the primary key on `id`
  // already makes (id, path_id) unique. Without this the statement above does
  // not apply at all — the migration fails rather than under-enforcing.
  assert.deepEqual(laneIdentityKey(), ['id', 'path_id'])
})

test('the lane move is refused rather than cascaded', () => {
  const key = pathMatchesLaneKey()
  // ON DELETE matches `cells_lane_id_fkey`, which already cascades from the
  // same parent row; anything else would make this the constraint that starts
  // refusing an ordinary lane delete.
  assert.equal(key.onDelete, 'cascade')
  // ON UPDATE stays NO ACTION, which is the default and therefore unwritten.
  // A cascade would rewrite each cell's path behind the author, and each
  // rewritten cell would then have to satisfy cells_validate_path_match's
  // other half — so it would succeed or fail on data nobody was thinking
  // about. Refusing says the true thing: a lane full of cells does not move
  // between paths by editing one column.
  assert.equal(key.onUpdate, null)
})

test('the composite-key readers go red when the declaration is gone', () => {
  const withoutKey = tree({
    [`${MIGRATIONS_DIR}/${GUARD_MIGRATION}`]: guardSource().replace(
      /add constraint cells_path_matches_lane_fkey[\s\S]*?;/i,
      '',
    ),
  })
  assert.throws(() => pathMatchesLaneKey(withoutKey), /no longer adds/)

  const withoutUnique = tree({
    [`${MIGRATIONS_DIR}/${GUARD_MIGRATION}`]: guardSource().replace(
      /add constraint lanes_id_path_unique unique \([^)]*\)/i,
      'add constraint lanes_id_path_unique primary key (id)',
    ),
  })
  assert.throws(() => laneIdentityKey(withoutUnique), /no longer declares/)
})

/* ---------------------------------------------------- stakeholder policies */

test('every stakeholder write has a permissive policy and a restrictive gate', () => {
  assert.deepEqual(policyPairGaps(stakeholderPolicies()), [])
})

test('every stakeholder policy names authenticated, and only authenticated', () => {
  // `to public` would be every role, `anon` included, and
  // `scripts/check-rls-posture.mjs` reports that as its own finding — but only
  // against a live database, which a pull request does not have.
  for (const policy of stakeholderPolicies()) {
    assert.equal(policy.role, 'authenticated', policy.name)
  }
})

test('the pair rule goes red on both shapes it exists to refuse', () => {
  const declared = stakeholderPolicies()

  // Shape one: the schema as it stood before this migration — one permissive
  // policy per command with the service call inline and no companion. Equally
  // closed today, and open the moment a second permissive policy joins it.
  const oldShape = declared
    .filter((policy) => !policy.restrictive)
    .map((policy) => ({ ...policy, predicate: 'using (public.is_service_account())' }))
  const oldGaps = policyPairGaps(oldShape)
  assert.ok(oldGaps.length > 0, 'the pre-#174 shape produced no finding')
  assert.equal(
    oldGaps.filter((gap) => /old shape/.test(gap)).length,
    3,
    'expected one finding per write command for the inline service call',
  )

  // Shape two: the companion in place and a second permissive policy added
  // beside the first, which is the accident the ticket describes. The gate
  // still holds — restrictive policies AND — but the rule reports it, because
  // the next edit is as likely to drop the companion as to keep it.
  const doubled = [
    ...declared,
    {
      name: 'stakeholders_update_anyone',
      restrictive: false,
      command: 'update',
      role: 'authenticated',
      predicate: 'using (true) with check (true)',
    },
  ]
  assert.equal(
    policyPairGaps(doubled).filter((gap) => /2 permissive update/.test(gap)).length,
    1,
  )

  // And the empty list is not a pass: a schema declaring nothing at all fails
  // on every command, which is what makes the green run above mean something.
  assert.equal(policyPairGaps([]).length, 6)
})

test('the policy reader goes red when the statements are gone', () => {
  // Two ways to lose them, and the reader has to name both. The block still
  // there with nothing in it is the one a partial edit produces.
  const emptyBlock = tree({
    [`${MIGRATIONS_DIR}/${GUARD_MIGRATION}`]: guardSource().replace(
      /do \$policies\$[\s\S]*?\$policies\$;/,
      'do $policies$ begin return; end $policies$;',
    ),
  })
  assert.throws(() => stakeholderPolicies(emptyBlock), /creates no policies/)

  const noBlock = tree({
    [`${MIGRATIONS_DIR}/${GUARD_MIGRATION}`]: guardSource().replace(
      /do \$policies\$[\s\S]*?\$policies\$;/,
      '',
    ),
  })
  assert.throws(() => stakeholderPolicies(noBlock), /no longer carries/)
})

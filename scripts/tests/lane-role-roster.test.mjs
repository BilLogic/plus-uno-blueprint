/**
 * The lane-role ROSTER check — its two readers, and both directions of the
 * equality it asserts.
 *
 * The claim this check makes is that two documents state the same set as the
 * CHECK constraint, so the tests that matter are the ones that plant a
 * disagreement and watch it get reported. A reader that quietly found nothing
 * would compare an empty set to the constraint and report a disagreement it
 * had not observed — or, worse, find one value and report seven missing — so
 * each reader is tested on what it does when the thing it reads is gone,
 * exactly as `lane-role-values.test.mjs` and `lane-roles.test.mjs` do for
 * theirs.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { rolesInConstraint } from '../lane-roles.mjs'
import {
  ERD_PATH,
  SPECS_PATH,
  rolesInErdRoster,
  rolesInToolSpec,
  rosterClaims,
  rosterFindings,
} from '../check-lane-role-roster.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)

/** An ERD comment header, a wrapped roster, and the topic that follows it. */
const ERD_FIXTURE = [
  '%% Enums (CHECK constraints, live 2026-08-26):',
  '%%   paths.kind ∈ (happy | variant | exception)',
  '%%',
  '%% Roles: lanes.lane_role is a semantic key kept separate from the name.',
  '%%        Canonical: kept_role, listed_role,',
  '%%        third_role. Constrained by lanes_lane_role_check, NOT extensible.',
  '%%',
  '%% Soft references: Canonical: not_a_role. This topic is a different one.',
  'erDiagram',
].join('\n')

/* ------------------------------------------------------------ the ERD reader */

test('the roster reader joins a wrapped list and stops at the next topic', () => {
  const roster = rolesInErdRoster(ERD_FIXTURE)
  assert.deepEqual(roster.values, ['kept_role', 'listed_role', 'third_role'])
  // Line 4 of the fixture, one-based: the block's header, which is the anchor
  // a failure annotation points at.
  assert.equal(roster.line, 4)
})

test('the roster block is not ended by its own Canonical: line', () => {
  // The shape a topic-header rule gets wrong. `%%        Canonical:` satisfies
  // "a capitalised word then a colon", so a reader that ended the block there
  // would stop one line before the sentence it exists to read — and read the
  // NEXT topic's `Canonical:` instead, which is the second half of the fixture.
  const withoutContinuations = ERD_FIXTURE.split('\n')
    .filter((line) => !/^%%\s{2,}(Canonical|third_role)/.test(line))
    .join('\n')
  assert.throws(() => rolesInErdRoster(withoutContinuations), /no longer carries a/)
})

test('the roster reader throws rather than reporting an empty vocabulary', () => {
  assert.throws(() => rolesInErdRoster('erDiagram\n'), /no longer opens a/)
  assert.throws(
    () => rolesInErdRoster('%% Roles: lanes.lane_role is a semantic key.\n'),
    /no longer carries a/,
  )
})

/* ----------------------------------------------------- the tool-spec reader */

test('the tool-spec reader reads the pipe list, wrapped or on one line', () => {
  const wrapped = [
    'const SERVICE_SCOPE_PARAM = str(',
    "  'Optional. Which service to search.',",
    ')',
    '',
    'const LANE_ROLE_FILTER_PARAM = str(',
    "  'kept_role | listed_role | third_role',",
    ')',
  ].join('\n')
  assert.deepEqual(rolesInToolSpec(wrapped), {
    line: 5,
    values: ['kept_role', 'listed_role', 'third_role'],
  })

  const inline = "const LANE_ROLE_FILTER_PARAM = str('kept_role | listed_role')\n"
  assert.deepEqual(rolesInToolSpec(inline), { line: 1, values: ['kept_role', 'listed_role'] })
})

test('the tool-spec reader throws rather than reporting an empty vocabulary', () => {
  assert.throws(() => rolesInToolSpec('const OTHER = str(\'a | b\')\n'), /no longer declares/)
  assert.throws(() => rolesInToolSpec("const LANE_ROLE_FILTER_PARAM = str('')\n"), /names no lane role/)
})

/* ------------------------------------------------------- equality, both ways */

const CLAIM = {
  file: 'somewhere/else.md',
  line: 7,
  what: 'the roster',
  consequence: 'a reader would be taught the wrong schema',
}

test('a role the constraint added and the document did not list is MISSING', () => {
  // #399 itself: the constraint grows, the document does not, and until this
  // check existed nothing anywhere compared the two.
  const found = rosterFindings(
    ['kept_role', 'listed_role', 'added_role'],
    [{ ...CLAIM, values: ['kept_role', 'listed_role'] }],
  )
  assert.equal(found.length, 1)
  assert.match(found[0].message, /accepts \{added_role\}, which it does not list/)
  assert.equal(found[0].line, 7)
})

test('a role the document kept and the constraint refuses is UNKNOWN', () => {
  // #395 from inside the two documents it had to repair by hand.
  const found = rosterFindings(
    ['kept_role'],
    [{ ...CLAIM, values: ['kept_role', 'retired_role'] }],
  )
  assert.equal(found.length, 1)
  assert.match(found[0].message, /lists \{retired_role\}, which lanes_lane_role_check refuses/)
})

test('both directions at once are reported in one message, not one of them', () => {
  // Containment either way is what the two prior bugs were. A finding that
  // named only the half it noticed first would send somebody to fix one and
  // leave the other, which is how this pair got here.
  const found = rosterFindings(
    ['kept_role', 'added_role'],
    [{ ...CLAIM, values: ['kept_role', 'retired_role'] }],
  )
  assert.equal(found.length, 1)
  assert.match(found[0].message, /accepts \{added_role\}/)
  assert.match(found[0].message, /lists \{retired_role\}/)
})

test('order is membership only, so the two documents may disagree about it', () => {
  // The ERD lists the constraint's order and the tool spec pairs each
  // touchpoint role with its actions role. Both are right, and a check on
  // sequences would have to call one of them wrong.
  assert.deepEqual(
    rosterFindings(
      ['kept_role', 'listed_role', 'third_role'],
      [{ ...CLAIM, values: ['third_role', 'kept_role', 'listed_role'] }],
    ),
    [],
  )
})

/* --------------------------------------------------------- the tree today */

test('both documents state exactly the vocabulary the constraint accepts', () => {
  const live = rolesInConstraint()
  const problems = rosterFindings(live, rosterClaims(ROOT)).map((one) => one.message)
  assert.deepEqual(
    problems,
    [],
    `A document that states the whole lane-role vocabulary disagrees with ` +
      `lanes_lane_role_check: ${problems.join(' ')}`,
  )
})

test('the two documents this check reads are the two it names', () => {
  // A path that has moved would make both readers throw, which is loud. A
  // path that still exists but no longer holds the claim is the quiet one, so
  // the claims are read from the real tree here rather than from a fixture.
  const claims = rosterClaims(ROOT)
  assert.deepEqual(
    claims.map((claim) => claim.file),
    [ERD_PATH, SPECS_PATH],
  )
  for (const claim of claims) {
    const source = readFileSync(resolve(ROOT, claim.file), 'utf8').split('\n')
    assert.ok(claim.line >= 1 && claim.line <= source.length, `${claim.file}:${claim.line}`)
  }
})

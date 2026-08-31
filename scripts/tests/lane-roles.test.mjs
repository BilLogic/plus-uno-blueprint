/**
 * The lane-role vocabulary says the same thing in the schema and in the app.
 *
 * Two properties, and the second is the one that matters. The vocabularies
 * must match — but a comparison of two lists a reader failed to find passes
 * just as loudly as a comparison of two lists that agree, so the readers are
 * exercised against planted sources first. That is the same argument
 * `rls-posture` makes: a check that is green against a clean tree could
 * equally be a check that examined nothing.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  CONSTRAINT_MIGRATION,
  MIGRATIONS_DIR,
  ROLES_PATH,
  constraintPermitsNull,
  migrationFilenames,
  rolesInCode,
  rolesInColumnComment,
  rolesInConstraint,
} from '../lane-roles.mjs'

const REPO_ROOT = resolve(new URL('../..', import.meta.url).pathname)

test('the constraint migration this check reads still exists', () => {
  assert.ok(
    migrationFilenames().includes(CONSTRAINT_MIGRATION),
    `scripts/lane-roles.mjs points at ${CONSTRAINT_MIGRATION}, which is not ` +
      `in ${MIGRATIONS_DIR}. If a later migration redefined the constraint, ` +
      `point the constant at that file.`,
  )
})

test('the app and the schema admit the same lane roles', () => {
  const code = [...rolesInCode()].sort()
  const schema = [...rolesInConstraint()].sort()
  assert.deepEqual(
    code,
    schema,
    'CANONICAL_LAYER_ROLES and the lane_role CHECK constraint disagree. A ' +
      'role the app renders and the database rejects is a write that fails ' +
      'at save time; a role the database admits and the app does not know is ' +
      'a lane that renders as a generic swimlane for no stated reason.',
  )
})

test('the comment a person reads in psql names the same roles', () => {
  // The list nobody was checking. `check-retired-identifiers.mjs` treats
  // pg_description as a trusted prose surface, so a stale column comment is a
  // doc that lies where a reader is most likely to believe it — and this one
  // named two roles that had never existed and omitted one that did.
  assert.deepEqual([...rolesInColumnComment()].sort(), [...rolesInConstraint()].sort())
})

test('the constraint still permits a lane with no role', () => {
  // 40 actor lanes carry a null role on purpose. A NOT NULL here would not
  // fail a test somewhere else: it would fail the migration, in production,
  // against rows that are correct.
  assert.equal(constraintPermitsNull(), true)
})

test('every canonical role has a description and a style', () => {
  const roles = rolesInCode()
  const descriptions = readFileSync(resolve(REPO_ROOT, ROLES_PATH), 'utf8')
  const styles = readFileSync(
    resolve(REPO_ROOT, 'src/lib/blueprintTheme.ts'),
    'utf8',
  )

  const undescribed = roles.filter(
    (role) => !new RegExp(`\\[${roleConstant(role)}\\]:`).test(descriptions),
  )
  assert.deepEqual(
    undescribed,
    [],
    'a canonical role with no entry in LANE_ROLE_DESCRIPTIONS shows as the ' +
      'generic "Lane" chip, which is what a lane with no role shows',
  )

  const unstyled = roles.filter(
    (role) => !new RegExp(`^\\s*${role}:`, 'm').test(styles),
  )
  assert.deepEqual(
    unstyled,
    [],
    'a canonical role with no entry in ROLE_STYLES falls through to the ' +
      'zone fallback, so giving a lane its correct role would change its colour',
  )
})

/** `support_actions` -> `SUPPORT_ACTIONS_ROLE`, as the descriptions are keyed. */
function roleConstant(role) {
  return `${role.toUpperCase()}_ROLE`
}

test('the readers read, and say so when they cannot', () => {
  // Both readers are pointed at a tree that has neither declaration. A reader
  // that returned [] here would make every assertion above vacuous.
  assert.throws(() => rolesInCode('/nonexistent-tree'))
  assert.throws(() => rolesInConstraint('/nonexistent-tree'))
  assert.throws(() => rolesInColumnComment('/nonexistent-tree'))
})

/**
 * The lane-role vocabulary, read from the two places that declare it.
 *
 * Three lists disagreed before this existed. `CANONICAL_LAYER_ROLES` named
 * eight roles, two of which (`support_systems`, `step_visual`) no row has
 * ever used, and omitted `partner_actions`, which three rows do use.
 * `LANE_ROLE_DESCRIPTIONS` named nine. `ROLE_STYLES` named eleven, including
 * `journey_stage` and `physical_evidence`, which appear nowhere else at all.
 * The database named none of them: `lane_role` was the only classifier column
 * in the schema with no CHECK constraint, which is why nobody was told.
 *
 * A FIFTH list is the column comment itself, and it was the one nobody
 * checked: `check-retired-identifiers.mjs` treats `pg_description` as a
 * trusted prose surface, so a stale comment is the same defect as a stale
 * doc, written where people are most likely to believe it. It is compared
 * here too.
 *
 * None of the three derives from the others, deliberately. The migration is
 * the enforcement, the TypeScript constant is what the app renders from, and
 * the comment is what a person reads in psql. A generated constant would make
 * a schema change silently reshape the UI, and a generated constraint would
 * put TypeScript in the deploy path. So each is written by hand and their
 * divergence is itself the failure, which is the shape `retired-vocabulary`
 * already uses for the rename map.
 *
 * Both readers throw rather than returning an empty set. A reader that
 * quietly finds nothing makes every comparison below pass.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname)

export const ROLES_PATH = 'src/lib/laneRoles.ts'
export const MIGRATIONS_DIR = 'supabase/migrations'

/** The CHECK constraint that owns the vocabulary, by filename. */
export const CONSTRAINT_MIGRATION =
  '20260830120000_a_lane_role_is_a_role_not_a_name.sql'

/**
 * The roles `CANONICAL_LAYER_ROLES` lists, resolved through the `*_ROLE`
 * constants it is built from.
 *
 * The array holds identifiers, not literals, so reading it means reading the
 * constants too. Anything the array names and the file does not define is an
 * error here rather than an `undefined` that silently drops out of the set.
 */
export function rolesInCode(root = REPO_ROOT) {
  const source = readFileSync(resolve(root, ROLES_PATH), 'utf8')

  const literals = new Map()
  for (const match of source.matchAll(
    /^export const ([A-Z_0-9]+_ROLE) = '([a-z_]+)'$/gm,
  )) {
    literals.set(match[1], match[2])
  }
  if (literals.size === 0) {
    throw new Error(
      `${ROLES_PATH} declares no \`export const X_ROLE = '...'\` lines. The ` +
        `reader in scripts/lane-roles.mjs can no longer see the vocabulary, ` +
        `so nothing is being compared. Fix the reader, not the declarations.`,
    )
  }

  const block = /export const CANONICAL_LAYER_ROLES = \[([^\]]*)\]/.exec(source)
  if (!block) {
    throw new Error(
      `${ROLES_PATH} no longer declares CANONICAL_LAYER_ROLES as an array ` +
        `literal. See scripts/lane-roles.mjs.`,
    )
  }

  const names = block[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '' && !entry.startsWith('//'))

  return names.map((name) => {
    const value = literals.get(name)
    if (value === undefined) {
      throw new Error(
        `CANONICAL_LAYER_ROLES names ${name}, which ${ROLES_PATH} does not ` +
          `define as a role constant.`,
      )
    }
    return value
  })
}

/**
 * The roles the CHECK constraint admits, excluding NULL.
 *
 * NULL is deliberately permitted and is not a role: an actor lane carries no
 * blueprint role and renders as a generic swimlane, which 40 lanes rely on.
 * It is asserted separately rather than folded into this list, because a
 * vocabulary comparison that silently absorbed it would stop noticing if the
 * constraint were tightened to NOT NULL.
 */
/** The constraint migration's text, read once for the three readers below. */
function constraintMigration(root) {
  return readFileSync(resolve(root, MIGRATIONS_DIR, CONSTRAINT_MIGRATION), 'utf8')
}

export function rolesInConstraint(root = REPO_ROOT) {
  const source = constraintMigration(root)

  const block = /lane_role in \(([^)]*)\)/i.exec(source)
  if (!block) {
    throw new Error(
      `${CONSTRAINT_MIGRATION} no longer contains a \`lane_role in (...)\` ` +
        `list. See scripts/lane-roles.mjs.`,
    )
  }

  return [...block[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1])
}

/** Whether the constraint still admits a lane with no role. */
export function constraintPermitsNull(root = REPO_ROOT) {
  return /lane_role is null/i.test(constraintMigration(root))
}

/**
 * The roles the column comment claims are canonical.
 *
 * Read out of the same migration that sets it, not out of the live database:
 * this must fail a pull request, and CI has no credentials. The migration is
 * the last writer of that comment, so the file and the column agree by
 * construction unless a later migration rewrites it — which is what
 * `CONSTRAINT_MIGRATION` being wrong would mean, and what the first test in
 * the suite is for.
 */
export function rolesInColumnComment(root = REPO_ROOT) {
  const source = constraintMigration(root)

  // Terminated on a statement-final semicolon, not the first one: the
  // comment's own text contains "divider-line anchoring);", and a lazy match
  // to any `;` stops there — before the sentence this reads.
  const block =
    /comment on column public\.lanes\.lane_role is([\s\S]*?);\s*$/im.exec(source)
  if (!block) {
    throw new Error(
      `${CONSTRAINT_MIGRATION} no longer sets a comment on ` +
        `public.lanes.lane_role. See scripts/lane-roles.mjs.`,
    )
  }

  const listed = /Canonical values:([^.]*)\./i.exec(block[1].replace(/'\s*'/g, ''))
  if (!listed) {
    throw new Error(
      `the lanes.lane_role comment in ${CONSTRAINT_MIGRATION} no longer ` +
        `carries a "Canonical values: ..." sentence, so the vocabulary a ` +
        `person reads in psql is no longer being compared to anything.`,
    )
  }

  return listed[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => /^[a-z_]+$/.test(entry))
}

/** Migration filenames, so a stale `CONSTRAINT_MIGRATION` is visible. */
export function migrationFilenames(root = REPO_ROOT) {
  return readdirSync(resolve(root, MIGRATIONS_DIR)).filter((name) =>
    name.endsWith('.sql'),
  )
}

#!/usr/bin/env node
/**
 * #399 — the two documents that state the WHOLE lane-role vocabulary.
 *
 * `check-lane-role-values.mjs` (#395) closed the negative half of this: a
 * lane role the CHECK constraint has RETIRED fails the build wherever a
 * tracked file still spells it. This is the positive half. Two files do not
 * merely mention a lane role in passing — each states the vocabulary as a
 * SET, and until this check existed neither statement was compared to
 * anything at all:
 *
 *   docs/reference/erd.mmd        the `%% Roles:` comment's `Canonical:`
 *                                 roster, which is where a person reading
 *                                 the ERD learns what the column holds
 *   src/lib/agent/tools/specs.ts  `LANE_ROLE_FILTER_PARAM`, a pipe-separated
 *                                 string that is the same set in a different
 *                                 notation, and the only description of the
 *                                 value set the model ever sees
 *
 * Add a ninth role to `lanes_lane_role_check` today and both go quietly
 * incomplete. The ERD then misdescribes the schema, which is a documentation
 * defect and reads like one. The tool spec is the half that costs something:
 * the agent is never told the role exists, so it cannot filter on it, and a
 * blueprint appears not to cover lanes it covers. That is precisely the
 * failure #395 fixed — a read that comes back empty while reporting success —
 * arrived at from the other side.
 *
 * A THIRD list states the same set and is already held: `CANONICAL_LANE_ROLES`
 * in `src/lib/laneRoles.ts`, which `scripts/tests/lane-roles.test.mjs`
 * compares to the constraint value for value. It is not re-checked here.
 *
 * ── EQUALITY, IN BOTH DIRECTIONS ──────────────────────────────────────────
 *
 * The assertion is set EQUALITY. The two directions fail for different
 * reasons and are worth different sentences, so both are named:
 *
 *   MISSING   the constraint accepts a role the document does not list. This
 *             is #399 itself — a role added to the constraint and nowhere
 *             else, which nothing could have caught.
 *   UNKNOWN   the document lists a role the constraint refuses. This is #395
 *             seen from inside the two documents it had to repair by hand.
 *
 * Containment one way is what let #395 happen; containment the other way is
 * what this file is about. Neither half is sufficient, so neither half is
 * what is checked.
 *
 * ORDER IS NOT ASSERTED, only membership. The ERD lists the roster in the
 * constraint's own order; the tool spec deliberately does not, putting each
 * touchpoint role beside the actions role it pairs with, because that is the
 * order the reading is useful in. A check comparing sequences would have to
 * declare one of those two orders wrong, and neither is.
 *
 * ── THE LIVE SET IS REUSED, NOT REPARSED ──────────────────────────────────
 *
 * `rolesInConstraint()` in `scripts/lane-roles.mjs` already reads the
 * `lane_role in (…)` list out of the constraint migration, and
 * `scripts/tests/lane-roles.test.mjs` holds that reader to the file. A second
 * parse of the same SQL here would be a second thing to keep right, and the
 * two parses could disagree — which is the exact failure mode this family of
 * checks exists to prevent, so committing it inside one of them would be
 * remarkable.
 *
 * `staleConstraintPointer()` is imported from `check-lane-role-values.mjs`
 * for the same reason, and it is the soundness condition of everything
 * below. If a migration later than `CONSTRAINT_MIGRATION` redefines the
 * constraint, then the "live" set is a historical one, and every role added
 * since would be reported here as UNKNOWN in both documents at once — a
 * failure that points at two innocent files and away from the stale pointer
 * that caused it.
 *
 * ── WHY THIS IS NOT AN EXTENSION OF `scripts/erd-value-sets.mjs` ──────────
 *
 * That file is the natural home for the ERD half: it is the ERD's own
 * value-set parser, and it already compares set for set rather than by
 * containment. It is also enrolled in the byte-identity drift gate
 * (`scripts/reconciled-files.mjs`), which means it is the pinned template's
 * file and this deployment holds it byte-identical; editing it here would
 * redden `check:reconciled`, and the change belongs upstream in
 * `agentic-service-blueprinting` — which is what #399 means by calling this
 * part of the #304 convergence.
 *
 * Two things would keep the fit imperfect even upstream, and they are the
 * reason this is a check of its own rather than a line waiting on a pin bump.
 * `erd-value-sets.mjs` is compared against a CATALOG read from the live
 * database, and its only caller is `check:contract:live` — so a roster
 * checked there would be checked only where credentials are, and never on a
 * pull request. And its subject is the ERD alone, while half of this ticket
 * is a TypeScript constant that no ERD parser should learn to read.
 *
 * Static, needs no database, runs in `gates`.
 *
 * Run: node scripts/check-lane-role-roster.mjs  (also: npm run check:lane-role-roster)
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { rolesInConstraint } from './lane-roles.mjs'
import { staleConstraintPointer } from './check-lane-role-values.mjs'

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname)

export const ERD_PATH = 'docs/reference/erd.mmd'
export const SPECS_PATH = 'src/lib/agent/tools/specs.ts'

/**
 * The values of a `Canonical: a, b, c.` sentence, unfiltered.
 *
 * Unfiltered on purpose. An entry that is not a token — a stray word, a
 * value somebody typed with a space in it — is left in the set so the
 * comparison below reports it as a role the constraint refuses, which names
 * the thing that is wrong. Dropping it would make the roster merely look
 * short, and the reader would be blamed for the document's mistake.
 */
function rosterSentence(text) {
  const listed = /\bCanonical(?:\s+values)?:([^.]*)\./i.exec(text)
  if (!listed) return null
  return listed[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
}

/**
 * The `%% Roles:` roster the ERD states, with the line the block opens on.
 *
 * The block is its header line plus the `%%` lines indented under it. That
 * indent is what separates a continuation from the next topic, and it has to
 * be: the roster's own `Canonical:` line would satisfy any "a capitalised
 * word then a colon starts a new topic" rule, and the block would end one
 * line before the sentence this reads.
 */
export function rolesInErdRoster(mmd, source = ERD_PATH) {
  const lines = mmd.split('\n')
  const start = lines.findIndex((line) => /^%%\s+Roles:/.test(line))
  if (start === -1) {
    throw new Error(
      `${source} no longer opens a \`%% Roles:\` comment block. The reader in ` +
        `scripts/check-lane-role-roster.mjs can no longer see the roster, so ` +
        `nothing is being compared. Fix the reader.`,
    )
  }

  const block = [lines[start]]
  for (let i = start + 1; i < lines.length; i += 1) {
    if (!/^%%\s{2,}\S/.test(lines[i])) break
    block.push(lines[i])
  }

  const values = rosterSentence(block.map((line) => line.replace(/^%%\s*/, '')).join(' '))
  if (values === null || values.length === 0) {
    throw new Error(
      `the \`%% Roles:\` block in ${source} no longer carries a ` +
        `"Canonical: ..." sentence naming the lane roles, so the vocabulary a ` +
        `reader of the ERD is taught is no longer being compared to anything.`,
    )
  }
  return { line: start + 1, values }
}

/**
 * The roles `LANE_ROLE_FILTER_PARAM` offers the model, with its line.
 *
 * A pipe-separated string rather than a list, because that is the notation a
 * tool spec's `description` is read in — the same set written the way the
 * model sees it, which is exactly why it is worth checking separately.
 */
export function rolesInToolSpec(source, path = SPECS_PATH) {
  const lines = source.split('\n')
  const start = lines.findIndex((line) => /^const LANE_ROLE_FILTER_PARAM\b/.test(line))
  // Whitespace-tolerant: the declaration is written over two lines today
  // because the string is long, and a formatter that joins them back up is
  // not a change to what the model is told.
  const declaration = /const LANE_ROLE_FILTER_PARAM\s*=\s*str\(\s*'([^']*)'/.exec(source)
  if (start === -1 || !declaration) {
    throw new Error(
      `${path} no longer declares \`const LANE_ROLE_FILTER_PARAM = str('...')\` ` +
        `at the start of a line. The reader in ` +
        `scripts/check-lane-role-roster.mjs can no longer see the value set the ` +
        `agent is offered, so nothing is being compared. Fix the reader.`,
    )
  }

  const values = declaration[1]
    .split('|')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
  if (values.length === 0) {
    throw new Error(
      `LANE_ROLE_FILTER_PARAM in ${path} names no lane role at all. The filter ` +
        `it describes would admit nothing, and this check would have compared ` +
        `an empty set to the constraint and passed.`,
    )
  }
  return { line: start + 1, values }
}

/** Both roster claims, read from the tree. */
export function rosterClaims(root = REPO_ROOT) {
  const erd = rolesInErdRoster(readFileSync(resolve(root, ERD_PATH), 'utf8'))
  const spec = rolesInToolSpec(readFileSync(resolve(root, SPECS_PATH), 'utf8'))
  return [
    {
      file: ERD_PATH,
      line: erd.line,
      what: 'the `%% Roles:` roster',
      consequence:
        'the ERD is what a person reads the column out of, and it would be ' +
        'describing a schema this repository does not have',
      values: erd.values,
    },
    {
      file: SPECS_PATH,
      line: spec.line,
      what: 'LANE_ROLE_FILTER_PARAM',
      consequence:
        'a spec is the only description of the value set the model ever sees, ' +
        'so a role missing from it is a role the agent cannot filter on',
      values: spec.values,
    },
  ]
}

/**
 * A message for every claim that is not the live set, and nothing for the
 * ones that are. Both directions, each named for what it means.
 */
export function rosterFindings(live, claims) {
  const show = (values) => `{${[...values].join(', ')}}`
  const out = []
  for (const claim of claims) {
    const stated = new Set(claim.values)
    const missing = live.filter((role) => !stated.has(role))
    const unknown = claim.values.filter((role) => !live.includes(role))
    if (missing.length === 0 && unknown.length === 0) continue

    const halves = []
    if (missing.length > 0) {
      halves.push(
        `the constraint accepts ${show(missing)}, which it does not list — ` +
          claim.consequence,
      )
    }
    if (unknown.length > 0) {
      halves.push(
        `it lists ${show(unknown)}, which lanes_lane_role_check refuses — a ` +
          'filter built from one of those matches no lane at all',
      )
    }
    out.push({
      file: claim.file,
      line: claim.line,
      message:
        `${claim.what} states the lane-role vocabulary as ${show(claim.values)} ` +
        `and the constraint's is ${show(live)}: ${halves.join('; and ')}.`,
    })
  }
  return out
}

function main() {
  const stale = staleConstraintPointer()
  if (stale) {
    console.error(`::error file=scripts/lane-roles.mjs::${stale}`)
    process.exit(1)
  }

  const live = rolesInConstraint()
  const claims = rosterClaims()
  const problems = rosterFindings(live, claims)
  for (const problem of problems) {
    console.error(`::error file=${problem.file},line=${problem.line}::${problem.message}`)
  }

  if (problems.length > 0) {
    console.error(
      `\n${problems.length} of the ${claims.length} document(s) that state the whole ` +
        `lane-role vocabulary disagree with lanes_lane_role_check. Set equality is the ` +
        `assertion: a role the constraint added and a document did not is as much a ` +
        `defect as a role a document kept and the constraint retired.`,
    )
    process.exit(1)
  }
  console.log(
    `ok — the ERD roster and LANE_ROLE_FILTER_PARAM each state exactly the ` +
      `${live.length} lane roles lanes_lane_role_check accepts (${live.join(', ')})`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) main()

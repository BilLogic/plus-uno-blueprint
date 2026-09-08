#!/usr/bin/env node
/**
 * The template version that is INSTALLED, against the one that is PINNED.
 *
 * Four scripts here read `node_modules/agentic-service-blueprinting` and
 * measure this repository against what they find. None of them used to ask
 * whether what they found is the version `package.json` pins, so a pin bump
 * that landed without a matching install had every one of them comparing
 * against the wrong tree — quietly, in three of the four.
 *
 * `check:reconciled` is where it stopped being quiet. Twice in one day it
 * accused files nobody had touched of drifting from the template, and its
 * message — reconcile them, or drop the entry — named two fixes that were
 * both wrong: the enrolments were correct, and an install put the count back
 * to zero with no source change. On a repository whose `main` is production,
 * that reads as a regression and sends someone looking for a defect that does
 * not exist.
 *
 * So a stale install is answered as its own failure, with its own message:
 * which version is installed, which is pinned, and the one command that
 * resolves it. It is raised BEFORE any file is compared, so a run that cannot
 * trust its subject never prints a verdict about it.
 *
 * ── WHAT COUNTS AS THE PIN ──────────────────────────────────────────────────
 *
 * The version tag in the dependency spec, against the `version` field of the
 * installed package.json — the two numbers a person can see, in the two files
 * they would look in. A spec that names no version is not a pin, and this
 * ABSTAINS on one rather than refusing: somebody pointing the dependency at a
 * sibling checkout or a branch is doing that on purpose, and it is not the
 * failure this exists to name.
 *
 * `node_modules/.package-lock.json` records the commit sha npm actually
 * resolved, which would compare exactly and would owe nothing to the
 * convention that tag `v1.2.3` ships version `1.2.3`. It is passed over here
 * because it is an npm-internal file, and because a sha is not a thing a
 * person reads off a failure and recognises. The convention is load-bearing
 * either way — a template tag whose package version disagrees with it is a
 * defect worth a red build, not a false alarm to design around.
 *
 * Nothing in this module is a check of its own; it has no `main` and no npm
 * script. It is the one comparison the four callers share.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** The dependency, by the name it has in package.json. */
export const TEMPLATE_PACKAGE = 'agentic-service-blueprinting'

/** Where `npm ci` puts it. The copy every one of the four callers reads. */
export const PACKAGE = `node_modules/${TEMPLATE_PACKAGE}`

/**
 * The dependency spec package.json pins the template at, or null when this
 * repository does not depend on it at all.
 *
 * @param {string} manifestText  the text of a package.json
 */
export function pinnedSpec(manifestText) {
  const manifest = JSON.parse(manifestText)
  return (
    manifest.dependencies?.[TEMPLATE_PACKAGE] ??
    manifest.devDependencies?.[TEMPLATE_PACKAGE] ??
    null
  )
}

/**
 * The version a dependency spec names, or null when it names none.
 *
 * `github:BilLogic/agentic-service-blueprinting#v1.12.9` is a pin and yields
 * `1.12.9`; `#main`, a `file:` link and a bare semver range are not pins and
 * yield null. The `v` is optional because the tag prefix is a convention of
 * the tags and not of the version.
 */
export function versionInSpec(spec) {
  if (typeof spec !== 'string') return null
  const found = /#v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/.exec(spec)
  return found ? found[1] : null
}

/**
 * What is wrong with the install, or null when there is nothing to say.
 *
 * Pure over three strings so the mismatch can be planted in a test instead of
 * waited for, and so nothing has to write to `node_modules` to exercise it.
 * The invariant is that the two versions AGREE — which pair of numbers they
 * are is the message's business and not the check's.
 *
 * Abstains when either version is unknown. A missing install is somebody
 * else's failure: each caller already says what it cannot do without the
 * package, in the terms of the thing it was about to check.
 *
 * @param {object} state
 * @param {string|null} state.pinned     version package.json's spec names
 * @param {string|null} state.installed  version node_modules holds
 * @param {string|null} state.spec       that spec, for the fix command
 */
export function staleInstallProblem({ pinned, installed, spec }) {
  if (pinned === null || installed === null) return null
  if (pinned === installed) return null
  return (
    `${TEMPLATE_PACKAGE} ${installed} is installed, but package.json pins ${pinned}.\n` +
    'This script measures this repository against the installed copy, so it would be ' +
    'comparing against\nthe wrong version of the template and reporting files nobody ' +
    'has touched. Install the pinned\nversion and run it again:\n\n' +
    `  npm install "${spec}"\n\n` +
    'This is a stale install, not drift: no file here has to change.'
  )
}

/**
 * The two versions and the spec, read off disk.
 *
 * @param {string} repoRoot  a directory holding package.json and node_modules
 */
export function templatePinState(repoRoot) {
  const spec = pinnedSpec(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
  const manifest = join(repoRoot, PACKAGE, 'package.json')
  const installed = existsSync(manifest)
    ? (JSON.parse(readFileSync(manifest, 'utf8')).version ?? null)
    : null
  return { spec, pinned: versionInSpec(spec), installed }
}

/**
 * Exit 1 with the stale-install message, or return and let the caller compare.
 *
 * Call this after whatever the caller says about a MISSING package and before
 * it reads a single file out of the installed one.
 */
export function refuseOnStaleInstall(repoRoot) {
  const problem = staleInstallProblem(templatePinState(repoRoot))
  if (problem === null) return
  console.error(problem)
  process.exit(1)
}

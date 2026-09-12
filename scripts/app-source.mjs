#!/usr/bin/env node
/**
 * Where the application's source is, now that this repository does not hold it.
 *
 * This deployment reads the application out of `agentic-service-blueprinting`.
 * Every check here that used to walk `src/` was walking the application; the
 * path moved, the checks did not stop being worth running, and several of them
 * are worth MORE than they were — a check that compares the application's
 * `laneRoles.ts` against this repository's migrations used to compare a file
 * against its own neighbour, and now compares the application this deployment
 * actually runs against the database it actually has.
 *
 * ── WHY EVERY READER HERE ASSERTS A NON-EMPTY SUBJECT ─────────────────────
 *
 * This is the whole reason this module exists rather than each script spelling
 * the new path itself.
 *
 * A check shaped `for (const file of walk(root)) { assert(...) }` passes on an
 * empty root. It does not pass because the thing it guards is true; it passes
 * because it examined nothing. Before the flip that could not happen — `src/`
 * was six hundred files and a typo in the path threw. Now the root is inside
 * `node_modules`, where it is absent on a tree nobody has installed, renamed by
 * a package release, or emptied by a failed install — and every one of those
 * turns a guard into a green light.
 *
 * So a walk goes through `appSourceFiles`, which refuses an empty result, and a
 * single file goes through `appSource`, which says which file and where rather
 * than surfacing a bare ENOENT. A check that cannot fail is worse than no
 * check, because the first is believed.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative as relativeTo, resolve } from 'node:path'

/**
 * The two roots an application can be at, in the order the build resolves
 * them — this repository's own `src`, then the package's.
 *
 * The template states the same pair in `vite.config.ts` and the two tsconfigs,
 * and its `scripts/tests/the-build-and-a-walk-find-one-root.test.mjs` holds
 * all four equal. This deployment holds no `src`, so the second always wins
 * here; the pair is still written as a pair, because the suites this
 * repository holds byte-identical with the template ask this module for it.
 */
export const APP_SOURCE_ROOTS = [
  'src',
  'node_modules/agentic-service-blueprinting/src',
]

/**
 * The first of `APP_SOURCE_ROOTS` that exists under `repoRoot`, absolute.
 *
 * Throws when neither does, naming both — a tree with no application is not a
 * tree with an empty application, and a walk pointed at a root that is not
 * there sweeps nothing and reports it in green.
 */
export function appSourceRoot(repoRoot) {
  const roots = APP_SOURCE_ROOTS.map((root) => resolve(repoRoot, root))
  const found = roots.find((root) => existsSync(root))
  if (!found) {
    throw new Error(
      `no application source under ${repoRoot}: neither ${roots.join(' nor ')} exists`,
    )
  }
  return found
}

/**
 * The directory the application's root sits in, absolute.
 *
 * Here that is always `<repo>/node_modules/agentic-service-blueprinting`, and
 * in a repository that keeps its own `src` it is the repository root. It is
 * what a pointer INTO the application is resolved against, so `src/lib/…`
 * reads the same on either side and a check's expected paths are one list
 * rather than one per deployment. `check-pointers.mjs` is held byte-identical
 * with the template and asks for it by that name.
 */
export function appPackageRoot(repoRoot) {
  return dirname(appSourceRoot(repoRoot))
}

/**
 * The application's source root as a repo-relative path — what a finding in
 * this repository's own checks is printed against.
 *
 * Derived from the pair above rather than spelled again, so there is one
 * statement of where the application is and not two that can disagree.
 */
export const APP_SOURCE_ROOT = relativeTo(
  process.cwd(),
  appSourceRoot(process.cwd()),
)

/** This deployment's own source root, the other side of the `~/…` alias. */
export const DEPLOYMENT_SOURCE_ROOT = 'deployment'

function repoRoot() {
  return process.cwd()
}

/** Absolute path to one file inside the application's source. */
export function appSourcePath(relative) {
  return resolve(repoRoot(), APP_SOURCE_ROOT, relative)
}

/**
 * Read one file out of the application's source.
 *
 * The error names the package, because that is the actionable half: a missing
 * path here is almost always an install that has not run or a release that has
 * moved the file, and neither is obvious from `ENOENT: no such file`.
 */
export function appSource(relative) {
  const path = appSourcePath(relative)
  if (!existsSync(path))
    throw new Error(
      `The application's ${relative} is not on disk at ${APP_SOURCE_ROOT}/${relative}. ` +
        `This deployment reads the application out of agentic-service-blueprinting — ` +
        `run npm ci, or check whether the pinned release still ships that file.`,
    )
  return readFileSync(path, 'utf8')
}

/** Whether the application ships a given file at all. */
export function hasAppSource(relative) {
  return existsSync(appSourcePath(relative))
}

/**
 * Every file under the application's source matching `predicate`, as
 * repo-relative paths — and NEVER an empty list.
 *
 * The emptiness check is the point of the function. See the module header.
 */
export function appSourceFiles(predicate = () => true, subdirectory = '') {
  const root = resolve(repoRoot(), APP_SOURCE_ROOT, subdirectory)
  const found = []
  const visit = (directory) => {
    if (!existsSync(directory)) return
    for (const entry of readdirSync(directory)) {
      const child = join(directory, entry)
      if (statSync(child).isDirectory()) visit(child)
      else {
        const relative = child.slice(resolve(repoRoot()).length + 1)
        if (predicate(relative)) found.push(relative)
      }
    }
  }
  visit(root)
  if (found.length === 0)
    throw new Error(
      `Walked the application's source at ${APP_SOURCE_ROOT}` +
        `${subdirectory ? `/${subdirectory}` : ''} and found no matching file. ` +
        `An empty walk is not a passing check — it is a check with no subject. ` +
        `Run npm ci, or fix the predicate if the application's layout has moved.`,
    )
  return found
}

/**
 * Every file under this deployment's OWN source root, and never an empty list.
 *
 * Same argument as above, for the checks whose subject is this repository's
 * code rather than the application's.
 */
export function deploymentSourceFiles(predicate = () => true) {
  const root = resolve(repoRoot(), DEPLOYMENT_SOURCE_ROOT)
  const found = []
  const visit = (directory) => {
    if (!existsSync(directory)) return
    for (const entry of readdirSync(directory)) {
      const child = join(directory, entry)
      if (statSync(child).isDirectory()) visit(child)
      else {
        const relative = child.slice(resolve(repoRoot()).length + 1)
        if (predicate(relative)) found.push(relative)
      }
    }
  }
  visit(root)
  if (found.length === 0)
    throw new Error(
      `Walked this deployment's source at ${DEPLOYMENT_SOURCE_ROOT} and found ` +
        `no matching file. An empty walk is not a passing check.`,
    )
  return found
}

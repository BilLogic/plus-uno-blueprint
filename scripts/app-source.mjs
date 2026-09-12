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
import { join, resolve } from 'node:path'

/** The installed package's own source root — the application, as imported. */
export const APP_SOURCE_ROOT = 'node_modules/agentic-service-blueprinting/src'

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

#!/usr/bin/env node
/**
 * THE SCRIPTS THE TEMPLATE PUBLISHES FOR A DEPLOYMENT TO HOLD, HELD.
 *
 * `scripts/check-reconciled-files.mjs` beside this one asks: has any file we
 * DECLARED byte-identical drifted? That is one direction, and it is the
 * direction a deployment can already see. This asks the other, which it
 * cannot: has the template started publishing a shared script we do not hold?
 *
 * The two questions fail on different events and neither implies the other.
 * Drift is an edit on one side of a path both sides have. A MISSING ENROLMENT
 * is a release adding a file to its own shared list — nothing here changes, no
 * byte moves, and every gate stays green while this deployment runs an older
 * mechanism than the one the release ships. That is how this repository came to
 * be running the generation of router checks that resolved a root from their
 * own location, a release after the template stopped doing that.
 *
 * THE LIST IS THE TEMPLATE'S, NOT A COPY OF IT. The template's own guard —
 * `scripts/tests/a-shared-script-cites-no-local-path.test.mjs`, shipped inside
 * the package — declares `SHARED_SCRIPTS`, one entry per script published for a
 * deployment to hold byte-identical, each with the reason it is shared, and
 * `REPO_LOCAL_IMPORTS`, the modules a shared script may import that are
 * deliberately NOT shared. Both are read out of the installed package here. A
 * second list written down on this side would be a list to forget to update,
 * which is the failure this check exists to catch.
 *
 * It is read as TEXT rather than imported, and that is not a shortcut: the
 * module is a vitest suite that imports the application through a path alias,
 * so importing it from a plain Node script cannot work. If the declaration
 * moves or is renamed, this REFUSES THE RUN with the fix named — it does not
 * fall back to an empty list, because an empty list agrees with every tree.
 *
 * Four things are asserted per published path:
 *
 *   1. this deployment HAS it. A script the release publishes and this tree
 *      lacks is the missing-enrolment failure above.
 *   2. it is BYTE-IDENTICAL to the installed package's copy. Redundant with
 *      `check:reconciled` for a path that is enrolled, and not redundant at
 *      all for one that is not — a file taken by hand and never enrolled would
 *      otherwise be held by nothing.
 *   3. it is ENROLLED in `scripts/reconciled-files.mjs`. Holding the bytes
 *      today is not the promise; the promise is that the next edit on either
 *      side fails a gate, and the enrolment is what makes that true.
 *   4. and for a repo-local import — `repo-config.mjs`, the seam — the
 *      opposite: this tree has one, and it is NOT enrolled. Every field in it
 *      is a fact about the running repository, so a copy of the template's
 *      would describe the template's files. A budget set against a different
 *      router passes while measuring nothing.
 *
 * "What the installed package publishes" is only a fact while the installed
 * package is the pinned one, so the run refuses first on a stale install.
 *
 * Static, needs no database, runs in `gates` after `npm ci`.
 *
 *   node scripts/check-shared-scripts.mjs   (also: npm run check:shared-scripts)
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { RECONCILED_FILES } from './reconciled-files.mjs'
import { PACKAGE, TEMPLATE_PACKAGE, refuseOnStaleInstall } from './template-pin.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Where the template declares what it publishes for a deployment to hold. */
export const GUARD = 'scripts/tests/a-shared-script-cites-no-local-path.test.mjs'

/**
 * The paths a `new Map([...])` named `declaration` holds, in order.
 *
 * Only the keys: the reason beside each is for a person reading the template's
 * own guard, and quoting it here would be a second copy of prose that is
 * already one click away. The match is anchored on the export so a Map
 * declared for some other purpose in the same file cannot be mistaken for it.
 */
export function declaredPaths(source, declaration) {
  const block = new RegExp(
    `export const ${declaration} = new Map\\(\\[([\\s\\S]*?)^\\]\\)`,
    'm',
  ).exec(source)
  if (!block) {
    throw new Error(
      `${PACKAGE}/${GUARD} no longer declares ${declaration} as a Map. The reader here can ` +
        'no longer see which scripts the template publishes, so nothing is being compared — ' +
        'an empty list agrees with every tree. Fix the reader.',
    )
  }
  const paths = [...block[1].matchAll(/'(scripts\/[^']+)'/g)].map(([, path]) => path)
  if (paths.length === 0) {
    throw new Error(
      `${PACKAGE}/${GUARD} declares ${declaration} with no scripts/ path in it. Either the ` +
        'template publishes nothing, which it does not, or the entries are spelled some way ' +
        'this reader does not see. Fix the reader.',
    )
  }
  return paths
}

/**
 * `{ path, problem }` for every published script this tree does not hold the
 * way the release asks, and for the seam if it has stopped being one.
 *
 * @param read Reads a path in THIS repository, or returns null if it is absent.
 * @param readPackage The same, inside the installed package.
 * @param enrolled The reconciled set, as paths.
 */
export function faults({ shared, repoLocal, read, readPackage, enrolled }) {
  const held = new Set(enrolled)
  const problems = []

  for (const path of shared) {
    const ours = read(path)
    const theirs = readPackage(path)
    if (theirs === null) {
      // The template names a path it does not ship. Its own guard fails on
      // this too, so it is upstream's to fix — said here because a reader
      // standing in this tree would otherwise read the next line as their
      // problem.
      problems.push({
        path,
        problem: `${TEMPLATE_PACKAGE} lists it as published and ships no file at that path`,
      })
      continue
    }
    if (ours === null) {
      problems.push({
        path,
        problem:
          'the pinned release publishes it for a deployment to hold byte-identical and this ' +
          'tree does not have it. Copy it out of the installed package and enrol it in ' +
          'scripts/reconciled-files.mjs',
      })
      continue
    }
    if (ours !== theirs) {
      problems.push({
        path,
        problem: "it has drifted from the installed package's copy — take the release's bytes",
      })
    }
    if (!held.has(path)) {
      problems.push({
        path,
        problem:
          'it is byte-identical and not enrolled in scripts/reconciled-files.mjs. Holding the ' +
          'bytes today is not the promise; the promise is that the next edit on either side ' +
          'fails a gate',
      })
    }
  }

  for (const path of repoLocal) {
    if (read(path) === null) {
      problems.push({
        path,
        problem:
          'a shared script imports it and this tree does not have it, so every script that ' +
          'reaches for it fails at load',
      })
      continue
    }
    if (held.has(path)) {
      problems.push({
        path,
        problem:
          'it is enrolled as byte-identical to the template and it is the one module that is ' +
          "never shared — every field in it is a fact about THIS repository. Drop the entry",
      })
    }
  }

  return problems
}

function main() {
  refuseOnStaleInstall(REPO_ROOT)

  const packageRoot = join(REPO_ROOT, PACKAGE)
  const readIn = (root) => (path) => {
    const full = join(root, path)
    return existsSync(full) ? readFileSync(full, 'utf8') : null
  }
  const guard = readIn(packageRoot)(GUARD)
  if (guard === null) {
    console.error(
      `${PACKAGE}/${GUARD} is not there, so which scripts the template publishes cannot be ` +
        'read.\nRun `npm ci`, then re-run this check.',
    )
    process.exit(1)
  }

  const shared = declaredPaths(guard, 'SHARED_SCRIPTS')
  const repoLocal = declaredPaths(guard, 'REPO_LOCAL_IMPORTS')
  const problems = faults({
    shared,
    repoLocal,
    read: readIn(REPO_ROOT),
    readPackage: readIn(packageRoot),
    enrolled: RECONCILED_FILES,
  })

  if (problems.length === 0) {
    console.log(
      `[shared-scripts] ${shared.length} scripts the pinned release publishes are all held ` +
        `here, byte-identical and enrolled; ${repoLocal.length} repo-local import(s) are ` +
        'this repository\'s own and enrolled nowhere',
    )
    return
  }

  for (const { path, problem } of problems) console.error(`${path}: ${problem}`)
  console.error(
    `\n${problems.length} problem(s) against the pinned release's shared-script list. That ` +
      'list is the template\'s, read out of the installed package — a release that adds to it ' +
      'moves no byte here and turns no other gate red, which is why this check exists.',
  )
  process.exit(1)
}

// Comparing against a hand-built `file://` URL silently no-ops whenever the
// path needs escaping, so the two are resolved instead.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()

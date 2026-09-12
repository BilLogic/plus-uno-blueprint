/**
 * Every file a commit would carry: tracked, plus untracked files git would not
 * ignore.
 *
 * Tracked alone is a trap — a document written and checked locally before
 * `git add` is invisible to a sweep, then fails in CI the moment it is
 * committed. The two subjects are one function, and that function sees what a
 * commit would.
 *
 * This lived inside `scripts/tests/a-rename-leaves-no-mangled-english.test.mjs`
 * while that sweep was the only whole-tree reader here, and its header said so.
 * `a-lane-is-not-a-layer.test.mjs` is the second, and a test file may not
 * import another test file to get this: vitest collects the imported module's
 * `test()` calls into the importing file as well, so the residue sweep would
 * run twice and report every finding twice. Hence a module of its own — two
 * sweeps, one listing, one tree. The template solves the same problem the same
 * way in `scripts/check-standalone.mjs`, whose exclusions are that
 * repository's and not ours.
 *
 * Since this deployment stopped holding the application, "one tree" is two:
 * the commit's files and the installed package's source. `sweptFiles` is the
 * union, and it is what a sweep claiming to read this codebase's prose must
 * use — see its own header for why the git listing alone stopped being that.
 */
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { APP_SOURCE_ROOT, appSourceFiles } from './app-source.mjs'

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname)

/** Binary payloads git happens to track. Nothing to read a line out of. */
export const BINARY = /\.(?:png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|pdf|zip|mp4|avif)$/i

/** The paths of that commit, deduplicated, with the binaries dropped. */
export function scannedFiles(root = REPO_ROOT) {
  const listed = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  )
  const seen = new Set()
  return listed.split('\0').filter((path) => {
    if (path === '' || seen.has(path) || BINARY.test(path)) return false
    seen.add(path)
    return true
  })
}

/**
 * The commit's files PLUS the application's, which is what a prose sweep of
 * "this codebase" now has to mean.
 *
 * `git ls-files` can never reach `node_modules`, and since this deployment
 * stopped holding the application that is where two thirds of the prose went.
 * The listing above did not start reporting an error when that happened; it
 * went on returning eleven hundred files and every sweep over it went on
 * passing, having stopped reading a single component, hook or stylesheet. That
 * is the exact failure `scripts/app-source.mjs` exists to refuse, and a guard
 * that cannot see the code it is about is worse than no guard, because the
 * first is believed.
 *
 * A finding inside the package is NOT fixable here — it is a pin to hold or an
 * upstream ticket, the same position `scripts/check-database-names.mjs` takes
 * about the same tree — and it is still worth knowing, because the sentences
 * in there are the ones this deployment ships to a reader.
 *
 * The package walk resolves from the working directory, which is the
 * repository root under vitest; `root` addresses the git listing only.
 */
export function sweptFiles(root = REPO_ROOT) {
  return [...scannedFiles(root), ...appSourceFiles((path) => !BINARY.test(path))]
}

/** The roots a whole-tree sweep must have read something from. @see sweptFiles */
export const SWEPT_ROOTS = Object.freeze([
  'deployment/',
  'scripts/',
  'docs/',
  'supabase/',
  `${APP_SOURCE_ROOT}/`,
])

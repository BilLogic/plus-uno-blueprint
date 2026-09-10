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
 */
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

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

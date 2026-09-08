import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Is the installed template the one this repository pins? (#510)
 *
 * Every script that compares against the template resolves it through
 * `node_modules/agentic-service-blueprinting`, and none of them asks whether
 * that copy is the version `package.json` names. A pin bump landed without a
 * matching install therefore reads as DRIFT: the drift gate lists files nobody
 * touched and tells the reader to reconcile them or drop the enrolment, and
 * both of those are wrong. It happened twice in one day — pin `v1.12.8` over an
 * installed 1.12.7, four files accused; pin `v1.12.9` over 1.12.8, five.
 *
 * The failure is cheap to diagnose once and expensive every other time, which
 * is the shape of a check rather than a note in a header.
 *
 * WHAT COUNTS AS A PIN. The dependency is a git URL with a tag —
 * `github:owner/repo#v1.12.9` — so the pinned version is written in the spec
 * itself and needs no network to read. A spec that names no version tag (a
 * branch, a commit, a `file:` link during local work) has nothing to compare,
 * and this says so rather than guessing: an unpinned spec is a deliberate
 * state, not a mismatch.
 */

/** The version a git-tag dependency spec pins, or null when it names none. */
export function pinnedVersion(spec) {
  if (typeof spec !== 'string') return null
  const match = /#v(\d+\.\d+\.\d+)$/.exec(spec.trim())
  return match ? match[1] : null
}

/**
 * The mismatch between the pin and what is installed, as the sentence a
 * reader needs, or null when there is nothing to say — they agree, or the
 * spec pins no version.
 *
 * The message names BOTH versions and the one command that fixes it. Naming
 * only "stale" would leave the reader to work out which direction they are
 * stale in, and the fix differs: an install behind the pin needs the install,
 * an install AHEAD of it means someone bumped `node_modules` by hand.
 */
export function pinMismatch({ spec, installedVersion, name = 'agentic-service-blueprinting' }) {
  const pinned = pinnedVersion(spec)
  if (pinned === null) return null
  if (installedVersion === null || installedVersion === undefined)
    return (
      `${name} is pinned at ${pinned} but the installed copy declares no version. ` +
      `Run \`npm install "${spec}" --prefer-online\` and re-run this check.`
    )
  if (pinned === installedVersion) return null
  return (
    `${name} is pinned at ${pinned} and the installed copy is ${installedVersion}. ` +
    'Nothing has drifted — the comparison is against the wrong tree. ' +
    `Run \`npm install "${spec}" --prefer-online\` and re-run this check.`
  )
}

/**
 * The same question against two installed trees on disk: this repository's
 * `package.json` and the template's. Returns the sentence, or null.
 *
 * Kept beside the pure pair rather than in one checker because FOUR scripts
 * resolve the template through `node_modules` — the drift gate, the write
 * surface, the divergence reporter and the duplicate-meaning sweep — and all
 * four are wrong in the same way against a stale install. The gate is merely
 * the one that says so loudest; the reporter is the one that says nothing at
 * all, which is worse.
 */
export function installMismatch(repoRoot, packageRoot, readJson) {
  const read = readJson ?? ((path) => JSON.parse(readFileSync(path, 'utf8')))
  let installedVersion = null
  try {
    installedVersion = read(join(packageRoot, 'package.json')).version ?? null
  } catch {
    installedVersion = null
  }
  const spec = read(join(repoRoot, 'package.json')).dependencies?.[
    'agentic-service-blueprinting'
  ]
  return pinMismatch({ spec, installedVersion })
}

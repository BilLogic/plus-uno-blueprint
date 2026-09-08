#!/usr/bin/env node
/**
 * The byte-identity drift gate over the reconciled set (#319, parent #304).
 *
 * `scripts/measure-template-divergence.mjs` REPORTS how far this deployment
 * has drifted from the template; it fails on nothing, because divergence is
 * expected and moving. This is its opposite over a named subset: the files in
 * `scripts/reconciled-files.mjs` are DECLARED reconciled, and for those the
 * only acceptable divergence is zero. A reconciled file that stops being
 * byte-identical to asb's copy — either side moving — fails CI.
 *
 * It lands EMPTY: the allowlist has no entries, so there is nothing to compare
 * and the gate exits 0 without even needing asb present. Every later
 * reconciliation ticket enrols its file(s) with a one-line append to that
 * allowlist.
 *
 * asb is the pinned git dependency `agentic-service-blueprinting` (see
 * package.json / the lockfile), installed to
 * `node_modules/agentic-service-blueprinting` by `npm ci` — the same copy
 * `scripts/check-write-surface.mjs` reads, and the reason both run in the
 * `gates` job AFTER `npm ci`. Byte-identity is measured against that pinned
 * version, so "reconciled" means "identical to asb at the pinned tag"; a pin
 * bump that moves asb's copy is exactly the drift this is meant to catch. The
 * local `template` git remote the divergence reporter uses is a sibling
 * checkout that is never present in CI, so it is the wrong source for a gate.
 *
 * When the allowlist is non-empty but the package is not installed, it fails
 * the way the divergence reporter fails on an asb tree it cannot read: loudly,
 * with the command to fix it, never a green pass it cannot stand behind. An
 * empty allowlist needs no package and passes anyway.
 *
 * An install that is present but BEHIND the pin is the same condition wearing
 * a disguise, and `scripts/template-pin.mjs` unmasks it before any comparison
 * happens. Drift is a claim about two edited copies; a version gap is a claim
 * about npm, and telling the two apart is the difference between a one-command
 * fix and an afternoon spent looking for a defect that is not there.
 *
 *   node scripts/check-reconciled-files.mjs   (also: npm run check:reconciled)
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RECONCILED_FILES } from './reconciled-files.mjs'
import { repoLocalCitations, describeCitation } from './repo-local-citations.mjs'
import { PACKAGE, refuseOnStaleInstall } from './template-pin.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/**
 * A reader that returns a file's bytes as a Buffer, or null when it is absent.
 * Byte-identity, not text: no encoding, no newline normalisation — a
 * reconciled file is identical or it is not.
 */
const byteReader = (root) => (path) => {
  const full = join(root, path)
  return existsSync(full) ? readFileSync(full) : null
}

/**
 * The problems with the reconciled set. Two kinds, both fatal:
 *
 * 1. an enrolled path that is not byte-identical to asb's copy;
 * 2. an enrolled file that cites a repo-local identity — an issue number, an
 *    ADR number, a migration filename, a `docs/` path, a plan or todo number.
 *
 * The second is here rather than in a check of its own because the enrolled
 * set is exactly the set the rule applies to, and this is the script that
 * already reads it. A file is shared or it is not; the citation rule follows
 * from that one fact and needs no second list to fall out of step with.
 *
 * Byte-identity is checked first and short-circuits: a drifted file already
 * needs a decision, and listing its citations underneath would bury the
 * drift. A file that fails only the citation rule is byte-identical, which
 * means the same citations are wrong upstream too — so the fix goes there
 * first and arrives here on the next pin bump.
 *
 * @param {object} io
 * @param {string[]} io.files                  enrolled repo-relative paths
 * @param {(p: string) => Buffer|null} io.readInstance  this repo's bytes at a path
 * @param {(p: string) => Buffer|null} io.readAsb       asb's bytes at the same path
 */
export function auditReconciled({ files, readInstance, readAsb }) {
  const problems = []
  for (const path of files) {
    const ours = readInstance(path)
    const theirs = readAsb(path)
    if (ours === null) {
      problems.push(`${path} is enrolled as reconciled but does not exist in this repo`)
      continue
    }
    if (theirs === null) {
      problems.push(
        `${path} is enrolled as reconciled but asb has no copy at that path — ` +
          'it is not a shared file at the pinned version',
      )
      continue
    }
    if (!ours.equals(theirs)) {
      problems.push(
        `${path} has drifted from asb's copy. It is on the reconciled allowlist, ` +
          'so the two must be byte-identical: reconcile them, or drop the entry ' +
          'from scripts/reconciled-files.mjs',
      )
      continue
    }
    for (const finding of repoLocalCitations(path, ours.toString('utf8'))) {
      problems.push(describeCitation(path, finding))
    }
  }
  return problems
}

function main() {
  // Empty allowlist ⇒ nothing to compare ⇒ pass, without needing asb present.
  if (RECONCILED_FILES.length === 0) {
    console.log('reconciled set is empty; nothing to compare.')
    return
  }

  const packageRoot = join(REPO_ROOT, PACKAGE)
  if (!existsSync(packageRoot)) {
    console.error(
      `${RECONCILED_FILES.length} file(s) are enrolled as reconciled but ` +
        `${PACKAGE} is not installed, so their byte-identity cannot be checked.\n` +
        'Run `npm ci` to install the pinned template, then re-run this check.',
    )
    process.exit(1)
  }

  // And an install that is PRESENT but behind the pin is compared against just
  // as blindly, which is how this gate twice accused files nobody had touched
  // (#510). It is answered before a single file is read, so no drift list ever
  // prints underneath a diagnosis that already explains the whole run.
  refuseOnStaleInstall(REPO_ROOT)

  const problems = auditReconciled({
    files: RECONCILED_FILES,
    readInstance: byteReader(REPO_ROOT),
    readAsb: byteReader(packageRoot),
  })

  if (problems.length === 0) {
    console.log(
      `${RECONCILED_FILES.length} reconciled file(s) are byte-identical to ` +
        'agentic-service-blueprinting.',
    )
    return
  }

  for (const problem of problems) console.error(problem)
  console.error(
    `\n${problems.length} problem(s) in the reconciled set. A file on ` +
      'scripts/reconciled-files.mjs is a promise of two things: that it stays ' +
      "byte-identical to asb's copy, and that it cites no identity that means " +
      'something different on the other side. Make both true, or drop the entry.',
  )
  process.exit(1)
}

// Same guard shape as check-write-surface: a hand-built `file://` comparison
// silently no-ops whenever the path needs escaping.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) main()

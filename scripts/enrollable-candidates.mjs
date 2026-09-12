#!/usr/bin/env node
/**
 * Which shared file could join the reconciled set next, and what is stopping
 * each one.
 *
 * `scripts/check-reconciled-files.mjs` holds the files this deployment has
 * DECLARED byte-identical to the pinned template. This finds the ones that are
 * nearly there: a shared path whose CODE already matches and whose COMMENTS do
 * not. Reporting, not a guard — it fails on nothing, because a file differing
 * from the template is the ordinary case and not a defect.
 *
 *   node scripts/enrollable-candidates.mjs     (also: npm run template:enrollable)
 *
 * ── WHAT THIS REPLACED, AND WHY THE OTHER HALF WENT ───────────────────────
 *
 * This file was `measure-template-divergence.mjs`, and its main mode tallied
 * this repository's git tree against the template's, area by area, over a
 * `template` remote that was a local path to a sibling checkout. That question
 * belonged to the world where this deployment kept a copy of the application:
 * six hundred shared files, a percentage that meant something, and a merge to
 * plan against it. The copy is gone. What the tally could still have measured
 * after the flip was `deployment/`, where the answer is "the template has
 * nothing here" by construction, and `docs/`, where it has been "no doc path
 * is shared" for a year.
 *
 * Two other things made it the wrong shape to keep. It needed a remote no
 * fresh clone and no CI run has ever had, so the number was only available to
 * whoever happened to have a sibling checkout — and it compared git trees,
 * which is the wrong source now: the template this deployment actually runs is
 * the release in the lockfile, not whatever is on someone's `main`.
 *
 * The mode below never had either problem. It reads the INSTALLED package, the
 * same copy `check:reconciled` compares against, so a candidate it proposes is
 * a candidate that gate will accept.
 *
 * ── WHY THE LIST IS HONEST IN BOTH DIRECTIONS ─────────────────────────────
 *
 * A file that differs in code must never appear, or someone enrols it and
 * reddens the gate. A file that differs only in a comment must appear, or the
 * candidates stay invisible.
 *
 * It used to call every candidate one agreed comment away from enrolment,
 * which was an inference rather than the measurement, and was wrong about all
 * three of its candidates (#579). It now measures the half of that claim it
 * can — a file citing a repo-local identity is not enrollable at any wording,
 * because `check:reconciled` refuses one — and reports the rest as what was
 * seen.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RECONCILED_FILES } from './reconciled-files.mjs'
import { describeCitation, repoLocalCitations } from './repo-local-citations.mjs'
import { PACKAGE, refuseOnStaleInstall } from './template-pin.mjs'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).trim()

/**
 * The trees a candidate may come from: everything this repository tracks,
 * minus the ones where a shared path is a coincidence rather than a shared
 * file.
 *
 * `supabase/` is this deployment's own database — ~800 migrations, its seeds
 * and its project settings — against a package that ships a dummy backend. Two
 * files there have matching names and nothing else, and a candidate list is a
 * list a person acts on, so a coincidence on it costs a reader more than it
 * saves. `dist/` and `.claude/` are build and tool output. `node_modules/` is
 * the template itself; offering its files as candidates would be proposing to
 * reconcile the package with itself.
 */
export const OUT_OF_SCOPE = ['supabase/', 'node_modules/', 'dist/', '.claude/', '.playwright-mcp/']

export const inScope = (path) => !OUT_OF_SCOPE.some((prefix) => path.startsWith(prefix))

/**
 * A file's code, with its prose taken out: block comments, line comments,
 * blank lines and indentation gone.
 *
 * Deliberately crude. A `//` inside a string literal — a URL, most often —
 * is treated as a comment, so two files that differ only inside such a
 * string can be reported as prose-only candidates. That is the right way for
 * this to be wrong: the output is a list for a person to check before
 * enrolling, and `check:reconciled` is the thing that actually refuses. A
 * real parser here would buy precision nobody is relying on.
 */
export function stripProse(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter(Boolean)
    .join('\n')
}

/**
 * Shared paths that differ only in prose: the enrolments available for the
 * cost of agreeing on a comment. Already-enrolled paths are left out — they
 * are byte-identical by definition, and `check:reconciled` owns them.
 *
 * @param {object} io
 * @param {string[]} io.paths                          candidate repo-relative paths
 * @param {(p: string) => string|null} io.readInstance this repo's text
 * @param {(p: string) => string|null} io.readAsb      the template's text
 */
export function enrollableCandidates({ paths, readInstance, readAsb }) {
  const enrolled = new Set(RECONCILED_FILES)
  const candidates = []
  for (const path of paths) {
    if (enrolled.has(path)) continue
    const ours = readInstance(path)
    const theirs = readAsb(path)
    if (ours === null || theirs === null) continue
    if (ours === theirs) continue
    if (stripProse(ours) === stripProse(theirs)) candidates.push(path)
  }
  return candidates
}

/**
 * The candidates a citation already rules out, apart from the rest.
 *
 * A prose-only difference reads like the cheapest thing there is to settle:
 * two people wrote the same comment differently, take one of them. That step
 * — from "the code is identical" to "one agreed comment from enrollable" — is
 * an inference, and this splits off the part of it that can be measured.
 * `check:reconciled` refuses an enrolled file that cites a repo-local
 * identity, so a candidate carrying one on EITHER side is not one agreement
 * away from anything: the citation has to come out of both copies before
 * enrolment is available at all. `linkedText.ts` is the shape of it, citing a
 * different migration in each repository, where agreeing on either number
 * leaves the file exactly as unenrollable as it was.
 *
 * The scan is `repoLocalCitations`, the same one the gate refuses on. A
 * second matcher of the same subject would drift from it, and this report
 * would start promising enrolments the gate then rejects — the failure both
 * rules exist to catch.
 *
 * What is left over is reported as measured and no further. Whether two
 * differing comments state the same fact is not a thing a scan can answer.
 *
 * @param {object} io
 * @param {string[]} io.candidates                    prose-only candidate paths
 * @param {(p: string) => string|null} io.readInstance this repo's text
 * @param {(p: string) => string|null} io.readAsb      the template's text
 */
export function splitOnCitations({ candidates, readInstance, readAsb }) {
  const blocked = []
  const proseOnly = []
  for (const path of candidates) {
    const findings = [
      ['this repo', readInstance(path)],
      ['template', readAsb(path)],
    ].flatMap(([side, text]) =>
      repoLocalCitations(path, text ?? '').map((finding) => ({ ...finding, side })),
    )
    if (findings.length) blocked.push({ path, findings })
    else proseOnly.push(path)
  }
  return { blocked, proseOnly }
}

/** Text at a path under `root`, or null when it is absent or not text. */
const textReader = (root) => (path) => {
  const full = join(root, path)
  if (!existsSync(full)) return null
  try {
    return readFileSync(full, 'utf8')
  } catch {
    return null
  }
}

/**
 * The report, as text.
 *
 * Separated from the run so the wording can be pinned by a test. The sentence
 * this replaced — "each is one agreed comment away from being enrollable" —
 * was true of none of the three files it was printed over, and nothing was in
 * a position to notice, because the only thing under test was which files the
 * list contained.
 *
 * @param {object} report
 * @param {{path: string, findings: object[]}[]} report.blocked  candidates a citation rules out
 * @param {string[]} report.proseOnly                            the rest
 */
export function formatEnrollableReport({ blocked, proseOnly }) {
  const sections = [
    `${blocked.length + proseOnly.length} shared file(s) differ from the pinned ` +
      'template by prose alone:\nthe code is identical and the comments are not.',
  ]

  if (blocked.length) {
    sections.push(
      `${blocked.length} candidate(s) cite a repo-local identity, which no agreement ` +
        'on the wording\nreaches: `check:reconciled` refuses an enrolled file that cites ' +
        'one, so the\ncitation has to come out of BOTH copies before enrolment is ' +
        'available.',
      blocked
        .flatMap(({ path, findings }) =>
          findings.map(
            (finding) => `  ${finding.side.padEnd(9)}  ${describeCitation(path, finding)}`,
          ),
        )
        .join('\n'),
    )
  }

  if (proseOnly.length) {
    sections.push(
      `${proseOnly.length} file(s) differ by comment only. That is the measurement, not ` +
        'a verdict on\nhow cheap they are: comments carry facts, and two sentences that ' +
        'differ can\neach be true of their own repository. Read them before assuming ' +
        'they agree.',
      proseOnly.map((path) => `  ${path}`).join('\n'),
    )
  }

  sections.push(
    "The template's wording is the tie-break where the two really are just two\n" +
      'people writing the same comment. A deployment sentence that is materially\n' +
      'better goes upstream as its own change first, never sideways; one that\n' +
      'states a different fact does not converge at all.',
  )

  return sections.join('\n\n')
}

/** Every path this repository tracks that a candidate could come from. */
function trackedPaths() {
  return git('ls-tree', '-r', '--name-only', 'HEAD').split('\n').filter(Boolean).filter(inScope)
}

function main() {
  const packageRoot = join(ROOT, PACKAGE)
  if (!existsSync(packageRoot)) {
    console.error(
      `${PACKAGE} is not installed, so there is nothing to compare against.\n` +
        'Run `npm ci` to install the pinned template, then re-run this.',
    )
    process.exit(1)
  }

  // An install behind the pin is a subtler version of the same emptiness: the
  // candidates would be measured against a template nothing else is measured
  // against, so every one of them reddens `check:reconciled` the moment it is
  // enrolled — the opposite of what this list is for (#510).
  refuseOnStaleInstall(ROOT)

  const readInstance = textReader(ROOT)
  const readAsb = textReader(packageRoot)
  const candidates = enrollableCandidates({ paths: trackedPaths(), readInstance, readAsb })

  if (candidates.length === 0) {
    console.log('No shared file differs from the pinned template by prose alone.')
    return
  }

  const { blocked, proseOnly } = splitOnCitations({ candidates, readInstance, readAsb })
  console.log(formatEnrollableReport({ blocked, proseOnly }))
}

if (import.meta.url === `file://${process.argv[1]}`) main()

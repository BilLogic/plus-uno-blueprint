#!/usr/bin/env node
/**
 * How far this instance has drifted from the template it is a deployment of.
 *
 * Reporting, not a guard. Divergence is expected to be non-zero and to move,
 * so there is no threshold to fail on and this script is not wired into CI.
 * What it exists to prevent is the failure that produced it: the first
 * divergence inventory (#74) was hand-measured against a checkout 134 commits
 * behind `origin/main`, three of its findings were wrong, and nothing said so
 * for weeks. A number nobody can re-derive in one command goes stale invisibly.
 *
 * The one thing it DOES refuse to do is report a comfortable answer it cannot
 * stand behind. The `template` remote is a local path to a sibling checkout,
 * so `template/main` is whatever the last person to work there left on their
 * local branch — today it is an ancestor of our own HEAD, and measuring
 * against it reports far less divergence than exists. An unresolvable ref and
 * an already-merged ref both exit 1 rather than printing zeroes.
 *
 *   git fetch template 'refs/remotes/origin/main:refs/remotes/template/upstream-main'
 *   node scripts/measure-template-divergence.mjs                     # that ref
 *   node scripts/measure-template-divergence.mjs <ref> [--files]     # any ref
 *   node scripts/measure-template-divergence.mjs --enrollable        # candidates
 *
 * `--enrollable` answers a different question and reads a different source, so
 * it is worth saying why. It lists files that are NOT byte-identical but would
 * be if prose were the only difference — the ones the citation sweep keeps
 * producing. It used to call every one of them one agreed comment away from
 * enrolment, which was an inference rather than the measurement, and was
 * wrong about all three of its candidates (#579). It now measures the half of
 * that claim it can — a file citing a repo-local identity is not enrollable at
 * any wording — and reports the rest as what was seen. Enrolment is measured
 * against the PINNED package, not the sibling checkout, because that is what
 * `check:reconciled` compares against; a candidate measured against anything
 * else is a candidate that reddens the gate on arrival. It reports and fails
 * on nothing, like the rest of this script — with the one exception it shares
 * with `check:reconciled`: an installed package behind the pin IS "anything
 * else", so `--enrollable` refuses on one rather than proposing enrolments
 * measured against a version nobody else is measuring against (#510). The
 * default mode reads git refs and never opens `node_modules`, so it has
 * nothing to check and asks nothing.
 *
 * Scope matches the inventory it corrects: src/, docs/, scripts/, hooks/ and
 * the root files. `supabase/` is excluded — it is quarantined wholesale and
 * comparing ~800 instance migrations against a dummy backend measures nothing.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RECONCILED_FILES } from './reconciled-files.mjs'
import { describeCitation, repoLocalCitations } from './repo-local-citations.mjs'
import { PACKAGE, refuseOnStaleInstall } from './template-pin.mjs'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')
const DEFAULT_REF = 'template/upstream-main'

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).trim()

/**
 * Ordered: the first predicate that matches wins.
 *
 * The eight `src/…` buckets are gone with `src/` itself. That was not a
 * cosmetic edit — a path matching no bucket is out of scope entirely, for the
 * tally AND for `--enrollable`, so while `deployment/` had no bucket this
 * reporter silently measured nothing about the one tree of this repository's
 * own code that can still diverge from the template. It reported a short list
 * and looked healthy.
 *
 * `deployment/` is here as ONE bucket rather than the eight the application
 * had, because it is ten files rather than six hundred, and because the
 * question it answers is different in kind. A file under `src/` was a copy of
 * a template file and the interesting number was how far it had drifted. A
 * file under `deployment/` has no counterpart upstream by construction — this
 * is the deployment's own code — so what this reporter can say about it is
 * only ever "the template has nothing here", which is the expected answer and
 * the reason the bucket is small.
 */
export const BUCKETS = [
  ['deployment', (p) => p.startsWith('deployment/')],
  ['docs', (p) => p.startsWith('docs/')],
  ['scripts', (p) => p.startsWith('scripts/')],
  ['hooks', (p) => p.startsWith('hooks/')],
  ['root files', (p) => !p.includes('/')],
]

export const inScope = (path) =>
  !path.startsWith('supabase/') &&
  // The application is a dependency now, not a tree to compare. Measuring
  // divergence against it would compare the package to itself.
  !path.startsWith('node_modules/') &&
  !path.startsWith('dist/') &&
  !path.startsWith('.playwright-mcp/') &&
  !path.startsWith('.claude/') &&
  BUCKETS.some(([, match]) => match(path))

export const bucketOf = (path) => BUCKETS.find(([, match]) => match(path))?.[0] ?? null

/**
 * @param {Map<string,string>} ours   path → blob sha
 * @param {Map<string,string>} theirs path → blob sha
 */
export function tally(ours, theirs) {
  const rows = new Map(
    BUCKETS.map(([name]) => [name, { identical: 0, differ: 0, oursOnly: 0, theirsOnly: 0, differing: [] }]),
  )
  const paths = [...new Set([...ours.keys(), ...theirs.keys()])].filter(inScope).sort()
  for (const path of paths) {
    const row = rows.get(bucketOf(path))
    const a = ours.get(path)
    const b = theirs.get(path)
    if (a && b) {
      if (a === b) row.identical++
      else {
        row.differ++
        row.differing.push(path)
      }
    } else if (a) row.oursOnly++
    else row.theirsOnly++
  }
  return rows
}

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
 * The `--enrollable` report, as text.
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

function reportEnrollable() {
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
  const paths = [...tree('HEAD').keys()].filter(inScope)
  const candidates = enrollableCandidates({ paths, readInstance, readAsb })

  if (candidates.length === 0) {
    console.log('No shared file differs from the pinned template by prose alone.')
    return
  }

  const { blocked, proseOnly } = splitOnCitations({ candidates, readInstance, readAsb })
  console.log(formatEnrollableReport({ blocked, proseOnly }))
}

function tree(ref) {
  const map = new Map()
  for (const line of git('ls-tree', '-r', ref).split('\n')) {
    if (!line) continue
    const [meta, path] = line.split('\t')
    map.set(path, meta.split(' ')[2])
  }
  return map
}

function resolve(ref) {
  try {
    return git('rev-parse', '--verify', `${ref}^{commit}`)
  } catch {
    console.error(
      `cannot resolve "${ref}".\n` +
        `Fetch the sibling checkout's remote-tracking ref — not its local branch:\n` +
        `  git fetch template 'refs/remotes/origin/main:refs/remotes/${DEFAULT_REF}'`,
    )
    process.exit(1)
  }
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--enrollable')) return reportEnrollable()
  const showFiles = args.includes('--files')
  const ref = args.find((a) => !a.startsWith('--')) ?? DEFAULT_REF
  const sha = resolve(ref)

  try {
    git('merge-base', '--is-ancestor', sha, 'HEAD')
    console.error(
      `"${ref}" (${sha.slice(0, 7)}) is already an ancestor of HEAD — it has nothing we\n` +
        `have not merged, so measuring against it under-reports divergence. This is\n` +
        `what a stale sibling checkout looks like. Fetch its origin/main:\n` +
        `  git fetch template 'refs/remotes/origin/main:refs/remotes/${DEFAULT_REF}'`,
    )
    process.exit(1)
  } catch (error) {
    if (typeof error?.status !== 'number') throw error
  }

  const rows = tally(tree('HEAD'), tree(sha))
  const total = { identical: 0, differ: 0, oursOnly: 0, theirsOnly: 0 }

  console.log(`HEAD      ${git('log', '-1', '--format=%h %ad %s', '--date=short', 'HEAD')}`)
  console.log(`${ref.padEnd(9)} ${git('log', '-1', '--format=%h %ad %s', '--date=short', sha)}`)
  console.log(`merge base ${git('log', '-1', '--format=%h %ad %s', '--date=short', git('merge-base', 'HEAD', sha))}\n`)
  console.log('| Area | Same path, identical | Same path, differ | Instance only | Template only |')
  console.log('|---|---|---|---|---|')
  for (const [name, row] of rows) {
    if (!row.identical && !row.differ && !row.oursOnly && !row.theirsOnly) continue
    console.log(`| \`${name}\` | ${row.identical} | ${row.differ} | ${row.oursOnly} | ${row.theirsOnly} |`)
    for (const key of Object.keys(total)) total[key] += row[key]
  }
  console.log(
    `| **Total** | **${total.identical}** | **${total.differ}** | **${total.oursOnly}** | **${total.theirsOnly}** |`,
  )

  const shared = total.identical + total.differ
  console.log(
    `\n${shared} shared paths; ${((100 * total.identical) / shared).toFixed(1)}% byte-identical.`,
  )

  if (showFiles) {
    for (const [name, row] of rows) {
      if (row.differing.length) console.log(`\n## ${name} — differ (${row.differ})\n${row.differing.join('\n')}`)
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main()

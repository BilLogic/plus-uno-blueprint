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
 * be if prose were the only difference — the cheapest enrolments available,
 * and the ones the citation sweep keeps producing. Enrolment is measured
 * against the PINNED package, not the sibling checkout, because that is what
 * `check:reconciled` compares against; a candidate measured against anything
 * else is a candidate that reddens the gate on arrival. It reports and fails
 * on nothing, like the rest of this script.
 *
 * Scope matches the inventory it corrects: src/, docs/, scripts/, hooks/ and
 * the root files. `supabase/` is excluded — it is quarantined wholesale and
 * comparing ~800 instance migrations against a dummy backend measures nothing.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RECONCILED_FILES } from './reconciled-files.mjs'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')
const DEFAULT_REF = 'template/upstream-main'

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).trim()

/** Ordered: the first predicate that matches wins, so `src/lib` beats `src other`. */
export const BUCKETS = [
  ['src/components', (p) => p.startsWith('src/components/')],
  ['src/lib', (p) => p.startsWith('src/lib/')],
  ['src/hooks', (p) => p.startsWith('src/hooks/')],
  ['src/styles', (p) => p.startsWith('src/styles/')],
  ['src/contexts', (p) => p.startsWith('src/contexts/')],
  ['src/types', (p) => p.startsWith('src/types/')],
  ['src/data', (p) => p.startsWith('src/data/')],
  ['src (other)', (p) => p.startsWith('src/')],
  ['docs', (p) => p.startsWith('docs/')],
  ['scripts', (p) => p.startsWith('scripts/')],
  ['hooks', (p) => p.startsWith('hooks/')],
  ['root files', (p) => !p.includes('/')],
]

export const inScope = (path) =>
  !path.startsWith('supabase/') &&
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

const PACKAGE = 'node_modules/agentic-service-blueprinting'

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

function reportEnrollable() {
  const packageRoot = join(ROOT, PACKAGE)
  if (!existsSync(packageRoot)) {
    console.error(
      `${PACKAGE} is not installed, so there is nothing to compare against.\n` +
        'Run `npm ci` to install the pinned template, then re-run this.',
    )
    process.exit(1)
  }

  const paths = [...tree('HEAD').keys()].filter(inScope)
  const candidates = enrollableCandidates({
    paths,
    readInstance: textReader(ROOT),
    readAsb: textReader(packageRoot),
  })

  if (candidates.length === 0) {
    console.log('No shared file differs from the pinned template by prose alone.')
    return
  }

  console.log(
    `${candidates.length} shared file(s) differ from the pinned template by prose ` +
      'alone. Each is one agreed comment away from being enrollable:\n',
  )
  for (const path of candidates) console.log(path)
  console.log(
    '\nThe template\'s wording is the tie-break, so a difference that is only two ' +
      '\npeople writing the same comment resolves by taking the template\'s. A ' +
      '\ndeployment sentence that is materially better goes upstream as its own ' +
      '\nchange first, never sideways.',
  )
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

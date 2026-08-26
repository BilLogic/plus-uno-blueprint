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
 *
 * Scope matches the inventory it corrects: src/, docs/, scripts/, hooks/ and
 * the root files. `supabase/` is excluded — it is quarantined wholesale and
 * comparing ~800 instance migrations against a dummy backend measures nothing.
 */
import { execFileSync } from 'node:child_process'

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

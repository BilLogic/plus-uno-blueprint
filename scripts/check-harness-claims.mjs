#!/usr/bin/env node
/**
 * Every assembled component is claimed by exactly one composition doc.
 *
 * `docs/guidelines/composition/*.md` each declare a `claims:` list in their
 * frontmatter. This walks `src/components/{blueprint,editor,cover,mobile}`
 * and holds the two sides to each other in both directions:
 *
 *   - a source file no doc claims fails, and is named
 *   - a claim pointing at a file that no longer exists fails, and names both
 *   - a file two docs claim fails, and names both docs
 *
 * The mapping is declared rather than derived from folder names on purpose.
 * `editor/` alone spans the canvas, the sidebar, slices, the agent and the
 * dialogs, and the `layer`→`lane` rename is the standing proof that folder
 * names are not stable. What folder-derivation would have bought — nothing
 * silently undocumented — is bought here instead, by a check.
 *
 * Co-located `*.test.*` files are a companion to the file they test, not a
 * surface anyone documents; they are excluded from the source set.
 *
 * Run: node scripts/check-harness-claims.mjs   (also: npm run check:harness)
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')
const COMPOSITION = join(ROOT, 'docs/guidelines/composition')
const SOURCE_DIRS = [
  'src/components/blueprint',
  'src/components/editor',
  'src/components/cover',
  'src/components/mobile',
]

const isTest = (name) => /\.test\.[cm]?[jt]sx?$/.test(name)

function walk(abs, out = []) {
  for (const entry of readdirSync(abs, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const full = join(abs, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (!isTest(entry.name)) out.push(relative(ROOT, full))
  }
  return out
}

/** Frontmatter, with support for the one block-list key we need. */
function frontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---/.exec(text)
  if (!match) return {}
  const out = {}
  let listKey = null
  for (const line of match[1].split('\n')) {
    const item = /^\s*-\s+(.*\S)\s*$/.exec(line)
    if (listKey && item) {
      out[listKey].push(item[1])
      continue
    }
    listKey = null
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (value === '') {
      listKey = key
      out[key] = []
    } else {
      out[key] = value
    }
  }
  return out
}

const sources = SOURCE_DIRS.flatMap((dir) => {
  const abs = join(ROOT, dir)
  if (!existsSync(abs) || !statSync(abs).isDirectory()) {
    console.error(`::error::source directory is missing: ${dir}`)
    process.exit(1)
  }
  return walk(abs)
})

const claimedBy = new Map()
const problems = []

if (!existsSync(COMPOSITION)) {
  console.error('::error::docs/guidelines/composition/ does not exist')
  process.exit(1)
}

const docs = readdirSync(COMPOSITION)
  .filter((name) => name.endsWith('.md') && name !== 'index.md')
  .sort()

for (const name of docs) {
  const docPath = relative(ROOT, join(COMPOSITION, name))
  const fm = frontmatter(readFileSync(join(COMPOSITION, name), 'utf8'))
  const claims = Array.isArray(fm.claims) ? fm.claims : []
  if (name !== 'overview.md' && claims.length === 0) {
    problems.push(`${docPath} declares no \`claims:\` list — every composition doc claims the files it documents`)
  }
  for (const claim of claims) {
    if (!existsSync(join(ROOT, claim))) {
      problems.push(`${docPath} claims ${claim}, which no longer exists — drop the claim or restore the file`)
      continue
    }
    const already = claimedBy.get(claim)
    if (already) {
      problems.push(`${claim} is claimed twice: ${already} and ${docPath} — exactly one doc owns a file`)
      continue
    }
    claimedBy.set(claim, docPath)
  }
}

for (const source of sources) {
  if (!claimedBy.has(source)) {
    problems.push(`${source} is claimed by no composition doc — add it to one doc's \`claims:\` list`)
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`::error::${problem}`)
  console.error(`\n${problems.length} composition-claim problem(s).`)
  process.exit(1)
}

console.log(
  `composition claims are complete: ${sources.length} assembled files across ${docs.length} docs`,
)

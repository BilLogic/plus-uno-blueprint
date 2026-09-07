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
 * `sweep` takes the root it reads rather than reaching for `REPO_ROOT`, the
 * shape `check-pointers.mjs` and `check-negation-ratchet.mjs` already use, so
 * that a test can prove the failing cases against a throwaway tree. It used to
 * prove them by planting a real `.tsx` file inside `src/components/cover/` and
 * deleting it a moment later, and that is #423: vitest runs suites in parallel,
 * about ten of them walk `src` through `tokenModel`, and for the few hundred
 * milliseconds the probe existed any of them could sample a file that was gone
 * by the time it asserted.
 *
 * Run: node scripts/check-harness-claims.mjs   (also: npm run check:harness)
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname)

/** The directories whose files a composition doc has to claim. */
export const SOURCE_DIRS = [
  'src/components/blueprint',
  'src/components/editor',
  'src/components/cover',
  'src/components/mobile',
]

const isTest = (name) => /\.test\.[cm]?[jt]sx?$/.test(name)

function walk(abs, root, out = []) {
  for (const entry of readdirSync(abs, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const full = join(abs, entry.name)
    if (entry.isDirectory()) walk(full, root, out)
    else if (!isTest(entry.name)) out.push(relative(root, full))
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

/** Every composition-claim problem in one repository root. */
export function sweep(root = REPO_ROOT) {
  const composition = join(root, 'docs/guidelines/composition')
  const sources = []
  for (const dir of SOURCE_DIRS) {
    const abs = join(root, dir)
    if (!existsSync(abs) || !statSync(abs).isDirectory()) {
      return { problems: [`source directory is missing: ${dir}`], sources, docs: [] }
    }
    sources.push(...walk(abs, root))
  }

  if (!existsSync(composition)) {
    return {
      problems: ['docs/guidelines/composition/ does not exist'],
      sources,
      docs: [],
    }
  }

  const claimedBy = new Map()
  const problems = []
  const docs = readdirSync(composition)
    .filter((name) => name.endsWith('.md') && name !== 'index.md')
    .sort()

  for (const name of docs) {
    const docPath = relative(root, join(composition, name))
    const fm = frontmatter(readFileSync(join(composition, name), 'utf8'))
    const claims = Array.isArray(fm.claims) ? fm.claims : []
    if (name !== 'overview.md' && claims.length === 0) {
      problems.push(`${docPath} declares no \`claims:\` list — every composition doc claims the files it documents`)
    }
    for (const claim of claims) {
      if (!existsSync(join(root, claim))) {
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

  return { problems, sources, docs }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const { problems, sources, docs } = sweep()
  if (problems.length > 0) {
    for (const problem of problems) console.error(`::error::${problem}`)
    console.error(`\n${problems.length} composition-claim problem(s).`)
    process.exit(1)
  }
  console.log(
    `composition claims are complete: ${sources.length} assembled files across ${docs.length} docs`,
  )
}

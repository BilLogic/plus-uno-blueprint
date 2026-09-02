/**
 * The documents this repository holds to its schema.
 *
 * One list, shared by every sweep that reads prose for what the database
 * has: retired identifiers (`a-doc-names-the-schema-it-has`), documented
 * value sets (`check-blueprint-contract`). Two lists would drift the way two
 * vocabularies do — a doc added to one and not the other is a doc that half
 * the guards read.
 *
 * WHAT IS NOT SWEPT, and why: `docs/adr/` records the decisions of its day
 * in the words of its day, and rewriting a decision record is falsifying it.
 * `docs/plans`, `docs/ideation`, `docs/brainstorms` are pre-ticket thinking
 * on the way to a spec; what they got wrong is why the spec exists.
 */
import { readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const ROOT_DOCS = ['CONTEXT.md', 'README.md', 'AGENTS.md']
export const HISTORY = ['docs/adr', 'docs/plans', 'docs/ideation', 'docs/brainstorms']

function markdownUnder(dir) {
  const found = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) found.push(...markdownUnder(path))
    else if (/\.md$/.test(entry)) found.push(path)
  }
  return found
}

/** Repo-relative paths of every swept document, root docs first. */
export function sweptDocs(root = process.cwd()) {
  const base = resolve(root)
  const docs = markdownUnder(resolve(base, 'docs'))
    .map((path) => path.slice(base.length + 1))
    .filter((rel) => !HISTORY.some((dir) => rel.startsWith(`${dir}/`)))
  return [...ROOT_DOCS, ...docs]
}

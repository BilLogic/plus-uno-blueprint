#!/usr/bin/env node
/**
 * A document names the schema it has, not the one it had.
 *
 * `CONTEXT.md` — the glossary, the document a stranger reads first — said on
 * line 34 that `scenarios` has a `view_type` and on line 39 that `paths` has a
 * `path_type`, while its own rename table three hundred lines down recorded
 * both renames. The glossary contradicted itself for two days and nothing
 * could see it: `check-retired-identifiers` replays the live database and
 * `retired-copy` reads JSX strings a reader sees on screen. Neither reads a
 * Markdown file (#261).
 *
 * THE SUBJECT IS A CODE SPAN, MATCHED WHOLE. `path_type` between backticks is
 * a claim about the schema; "path type" in a sentence is English, and
 * `20260830190000_one_spelling_each.sql` is a filename that happens to contain
 * a retired word. Only the first is checked, and only when the span IS the
 * retired name rather than contains it — so `filter_path_type`, an RPC
 * argument that genuinely still exists, is not a finding either.
 *
 * A RENAME STATEMENT IS NOT A FINDING. A line that names the retired spelling
 * and its replacement together — the rename table's own rows, a sentence
 * saying "`path_type` became `kind`" — is recording history, and history keeps
 * its spelling. The test is structural: the same line carries a span from the
 * pair's `is` list. No file and no line is pardoned by name.
 *
 * WHAT IS NOT SWEPT, and why: `docs/adr/` records the decisions of its day in
 * the words of its day; `supabase/migrations/` is the series itself; and
 * `docs/plans`, `docs/ideation`, `docs/brainstorms` are pre-ticket thinking on
 * their way out of the tree. Those are directory rules, stated here, not a
 * list of files.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { RENAME_MAP, RETIRED_IDENTIFIER_FRAGMENTS } from '../retired-vocabulary.mjs'

const REPO_ROOT = process.cwd()
const ROOT_DOCS = ['CONTEXT.md', 'README.md', 'AGENTS.md']
const HISTORY = ['docs/adr', 'docs/plans', 'docs/ideation', 'docs/brainstorms']

function markdownUnder(dir) {
  const found = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) found.push(...markdownUnder(path))
    else if (/\.md$/.test(entry)) found.push(path)
  }
  return found
}

export function sweptDocs() {
  const docs = markdownUnder(resolve(REPO_ROOT, 'docs'))
    .map((path) => path.slice(resolve(REPO_ROOT).length + 1))
    .filter((rel) => !HISTORY.some((dir) => rel.startsWith(`${dir}/`)))
  return [...ROOT_DOCS, ...docs]
}

/**
 * Retired spelling → the spellings that excuse it on the same line.
 *
 * Both rosters feed it: every bare fragment (`path_type`), and every
 * table-qualified `was` (`cells.description`) with its own `is`. A bare
 * fragment's replacement is whatever `is` sits at the same index in its row.
 */
export function retiredSpans(map = RENAME_MAP, fragments = RETIRED_IDENTIFIER_FRAGMENTS) {
  const excused = new Map()
  const add = (was, is) => {
    if (!excused.has(was)) excused.set(was, new Set())
    excused.get(was).add(is)
    // `cells.description` is excused by `cells.summary` and by bare `summary`.
    if (is.includes('.')) excused.get(was).add(is.split('.')[1])
  }
  for (const row of map) {
    // A row with no migration is a LABEL rename — `text` → Content — and a
    // label is copy, which `retired-copy` sweeps. This check names the schema.
    if (row.migrations.length === 0) continue
    row.was.forEach((was, index) => {
      const is = row.is[index] ?? row.is[0]
      add(was, is)
      const bare = was.split('.').at(-1)
      if (fragments.includes(bare)) add(bare, is.split('.').at(-1))
    })
  }
  // A bare fragment (`layer`) is excused by the replacements of every row it
  // came from (`lanes`, `lane_role`, `lane_id`) — never by nothing.
  for (const fragment of fragments) {
    if (excused.has(fragment)) continue
    const set = new Set()
    for (const row of map) {
      if (row.migrations.length === 0) continue
      if (row.was.some((was) => was.includes(fragment))) {
        for (const is of row.is) {
          set.add(is)
          set.add(is.split('.').at(-1))
        }
      }
    }
    excused.set(fragment, set)
  }
  return excused
}

const SPAN = /`([^`\n]+)`/g

/** Lines of `source` whose code spans name a retired identifier with no replacement beside it. */
/**
 * The lines of `source` that belong to the section holding the rename table.
 *
 * That section is the one place a retired word is at home: its commentary
 * explains why each name went, and it does so by naming the name. Found by
 * structure — the `## ` heading above the `| Was | Is | Migration |` row, to
 * the next `## ` or the end — never by a heading's text or a line number.
 */
export function renameSectionLines(lines) {
  const table = lines.findIndex((line) => /^\|\s*Was\s*\|\s*Is\s*\|/.test(line))
  if (table === -1) return new Set()
  let start = table
  while (start > 0 && !/^## /.test(lines[start])) start -= 1
  let end = table + 1
  while (end < lines.length && !/^## /.test(lines[end])) end += 1
  return new Set(Array.from({ length: end - start }, (_, i) => start + i))
}

/**
 * Does `span` name the current spelling of something in `replacements`?
 *
 * Whole or by stem: `lane` for `lanes`, `summary` for `cells.summary`. A span
 * sharing a stem with the replacement is naming the current thing; that is
 * the whole point of the excuse.
 */
function namesReplacement(span, replacements) {
  for (const is of replacements) {
    if (span === is || span.includes(is) || is.includes(span)) return true
  }
  return false
}

export function staleSpans(source, excused = retiredSpans()) {
  const findings = []
  const lines = source.split('\n')
  const history = renameSectionLines(lines)
  // Prose is judged by PARAGRAPH — the block between blank lines — because
  // Markdown reflows: "It replaced\n`cells.links`" is one sentence that a
  // line-scoped rule would read as two.
  let start = 0
  while (start < lines.length) {
    let end = start
    while (end < lines.length && lines[end].trim() !== '') end += 1
    const block = lines.slice(start, end)
    const spans = block.flatMap((line) => [...line.matchAll(SPAN)].map((m) => m[1].trim()))
    const isRenameStatement = spans.some((span) => {
      const replacements = excused.get(span)
      return replacements && spans.some((other) => other !== span && namesReplacement(other, replacements))
    })
    if (!isRenameStatement) {
      block.forEach((line, offset) => {
        if (history.has(start + offset)) return
        for (const m of line.matchAll(SPAN)) {
          const span = m[1].trim()
          if (excused.has(span)) findings.push({ line: start + offset + 1, span })
        }
      })
    }
    start = end + 1
  }
  return findings
}

test('no document names an identifier the schema has retired', () => {
  const excused = retiredSpans()
  const found = []
  for (const rel of sweptDocs()) {
    const source = readFileSync(resolve(REPO_ROOT, rel), 'utf8')
    for (const { line, span } of staleSpans(source, excused)) {
      found.push(`${rel}:${line}  \`${span}\``)
    }
  }
  assert.deepEqual(
    found,
    [],
    `A document names the schema it has (#261). Either the span is a claim ` +
      `about today's schema and is wrong, or it is history and the line should ` +
      `say what the name became:\n${found.join('\n')}`,
  )
})

test('the glossary line this was written against is a finding', () => {
  // CONTEXT.md line 34 as it stood on 2026-09-01 — the red this guard was
  // observed on before the line was fixed, kept so the check can never be
  // green because it examines nothing.
  const line = 'Table `scenarios`: `phase_id`, `name`, `summary`, `position`, `view_type`.'
  assert.deepEqual(staleSpans(line), [{ line: 1, span: 'view_type' }])
})

test('a rename statement is history and not a finding', () => {
  const row = '| `paths.path_type`, `scenarios.view_type` | `paths.kind`, `scenarios.layout` | `20260830190000` |'
  assert.deepEqual(staleSpans(row), [])
  const sentence = 'The column `path_type` became `kind` in the one-spelling migration.'
  assert.deepEqual(staleSpans(sentence), [])
})

test('a span that merely contains a retired word is not the subject', () => {
  // The RPC argument still exists; the migration filename is a filename.
  const line = '`search_blueprint(filter_path_type)` lives in `20260830190000_one_spelling_each.sql`.'
  assert.deepEqual(staleSpans(line), [])
})

test('the rename section is history, found by its table and not by its name', () => {
  const doc = [
    '## Live vocabulary',
    'Table `paths`: `kind`.',
    '## Whatever this section is called',
    '| Was | Is | Migration |',
    '|---|---|---|',
    '| `paths.path_type` | `paths.kind` | `x` |',
    '',
    '`path_type` said what kind of thing a path was, in a column that…',
    '## After',
    'And yet `path_type` here is a claim again.',
  ].join('\n')
  assert.deepEqual(staleSpans(doc), [{ line: 10, span: 'path_type' }])
})

test('prose that says the word without backticks is English', () => {
  assert.deepEqual(staleSpans('A path type is one of three things.'), [])
})

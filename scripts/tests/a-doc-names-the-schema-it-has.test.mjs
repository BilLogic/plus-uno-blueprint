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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RENAME_MAP, RETIRED_IDENTIFIER_FRAGMENTS } from '../retired-vocabulary.mjs'
import { renameSectionLines, retiredSpans, staleSpans } from '../stale-prose.mjs'
import { sweptDocs } from '../swept-docs.mjs'

const REPO_ROOT = process.cwd()

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

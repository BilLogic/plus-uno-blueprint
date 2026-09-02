/**
 * Prose held to the rename map: which code spans name a retired spelling with
 * no replacement beside them.
 *
 * Shared by `a-doc-names-the-schema-it-has` (markdown) and
 * `check-blueprint-contract` (catalog comments, which #260 renders into the
 * agent-facing schema section and which are therefore prose that ships). One
 * rule, two media; a comment has no backticks, so its caller says what a span
 * is there.
 */
import { RENAME_MAP, RETIRED_IDENTIFIER_FRAGMENTS } from './retired-vocabulary.mjs'

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

const backtickSpans = (line) => [...line.matchAll(SPAN)].map((m) => m[1].trim())

/**
 * `spansOf(line)` says what counts as a span — backticked text in markdown; a
 * caller sweeping catalog comments passes one that also reads bare
 * identifiers. `context` is spans the whole text is understood to name (the
 * table a comment is on), which can excuse a retired spelling but never be a
 * finding.
 */
export function staleSpans(source, excused = retiredSpans(), { spansOf = backtickSpans, context = [] } = {}) {
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
    const spans = [...context, ...block.flatMap((line) => spansOf(line))]
    const isRenameStatement = spans.some((span) => {
      const replacements = excused.get(span)
      return replacements && spans.some((other) => other !== span && namesReplacement(other, replacements))
    })
    if (!isRenameStatement) {
      block.forEach((line, offset) => {
        if (history.has(start + offset)) return
        for (const span of spansOf(line)) {
          if (excused.has(span)) findings.push({ line: start + offset + 1, span })
        }
      })
    }
    start = end + 1
  }
  return findings
}

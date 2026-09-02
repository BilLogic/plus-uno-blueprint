/**
 * The blueprint's agent-facing account of itself — the pure half.
 *
 * `docs/agents/blueprint.md` has two kinds of section. The hand-written core
 * says what the catalog cannot: how to retrieve, what absence means, what a
 * status licenses an agent to say, how paths relate to a scenario's main
 * route. The generated sections say what the code and the catalog already
 * say, and are RENDERED from them rather than written a third time:
 *
 *   vocabulary   from `ENTITY_KIND_DEFINITIONS` in src/lib/panelTerms.ts —
 *                the six kinds the board defines for a reader, read off the
 *                source text the way `blueprintContract.mjs` reads the contract
 *   schema       from `public.schema_comments()` (pg_description, live) laid
 *                over the column inventory in src/types/database.ts, so an
 *                undescribed column shows as a gap rather than vanishing
 *
 * Two numbers ratchet against docs/reference/agent-account-baseline.json:
 * column-comment coverage, which may only rise, and the count of
 * prohibitions in the hand-written core, which may only fall. Instructions
 * phrased as what to do are what an agent can act on; "never X" leaves it
 * guessing what to do instead.
 *
 * Pure: reads text, returns text. `generate-agent-account.mjs` does the I/O.
 */

/* ------------------------------------------------------------- sources */

/** The entity kinds and their definitions, read off panelTerms.ts. */
export function entityKinds(source) {
  const start = source.indexOf('export const ENTITY_KIND_DEFINITIONS = {')
  const end = source.indexOf('} as const', start)
  if (start === -1 || end === -1) throw new Error('ENTITY_KIND_DEFINITIONS not found in panelTerms.ts')
  const block = source.slice(start, end)
  const kinds = []
  const ENTRY = /^\s{2}([a-z_]+): \{\s*\n\s*label: '((?:[^'\\]|\\.)*)',\s*\n\s*definition:\s*\n?\s*'((?:[^'\\]|\\.)*)',/gm
  for (const m of block.matchAll(ENTRY)) {
    kinds.push({ kind: m[1], label: unescape(m[2]), definition: unescape(m[3]) })
  }
  if (kinds.length === 0) throw new Error('ENTITY_KIND_DEFINITIONS has no entries the renderer can read')
  return kinds
}

const unescape = (text) => text.replace(/\\(.)/g, '$1')

/**
 * Every relation's columns, read off the generated Supabase types: each
 * `name: { Row: { … } }` under Tables and Views. Functions carry no Row and
 * are not relations.
 */
export function tableColumns(databaseTs) {
  const relations = new Map()
  const ROW = /\n {6}([a-z_]+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/g
  for (const m of databaseTs.matchAll(ROW)) {
    const columns = [...m[2].matchAll(/^\s+([a-z_]+)\??:/gm)].map((c) => c[1])
    relations.set(m[1], columns)
  }
  if (relations.size === 0) throw new Error('no Row types found in database.ts')
  return relations
}

/* ------------------------------------------------------------ rendering */

const cell = (text) => String(text ?? '').replace(/\s+/g, ' ').replaceAll('|', '\\|').trim()

/** The vocabulary section: one line per kind, the label bold, the definition as written. */
export function renderVocabulary(kinds) {
  return kinds.map(({ label, definition }) => `**${label}** — ${definition}`).join('\n\n')
}

/**
 * The schema section. One block per relation an agent can read: the table's
 * own comment, then every column with its comment or a dash. Relations the
 * anon key cannot select are listed after, comment only, so an agent knows
 * they exist and what key they need.
 *
 * `comments` is what `schema_comments()` returns; `columns` is
 * `tableColumns()`; `readable` is the set of relations a bare select
 * succeeded on.
 */
export function renderSchema({ columns, comments, readable }) {
  const tableComment = new Map()
  const columnComment = new Map()
  for (const row of comments) {
    if (row.column_name) columnComment.set(`${row.relation}.${row.column_name}`, row.comment)
    else tableComment.set(row.relation, row.comment)
  }
  const names = [...columns.keys()].sort()
  const open = names.filter((name) => readable.has(name))
  const sealed = names.filter((name) => !readable.has(name))
  const parts = []
  for (const name of open) {
    const cols = columns.get(name)
    const described = cols.filter((c) => columnComment.has(`${name}.${c}`)).length
    // The comment sits in the heading's paragraph on purpose: a table
    // comment that records its own rename ("the bare word `findings` gave a
    // reader no clue") is excused by the name beside it, and `a-doc-names`
    // judges by paragraph.
    parts.push(
      `### \`${name}\`\n` +
        `${cell(tableComment.get(name) ?? '—')}\n\n` +
        `${described} of ${cols.length} columns described.\n\n` +
        '| Column | Meaning |\n|---|---|\n' +
        cols.map((c) => `| \`${c}\` | ${cell(columnComment.get(`${name}.${c}`) ?? '—')} |`).join('\n'),
    )
  }
  if (sealed.length > 0) {
    parts.push(
      '### Not readable with the anon key\n\n' +
        'These exist and a service key reads them. What each is for:\n\n' +
        sealed.map((name) => `- \`${name}\` — ${cell(tableComment.get(name) ?? '—')}`).join('\n'),
    )
  }
  return parts.join('\n\n')
}

/** Column-comment coverage over the relations an agent can read. */
export function coverage({ columns, comments, readable }) {
  const described = new Set(comments.filter((r) => r.column_name).map((r) => `${r.relation}.${r.column_name}`))
  let of = 0
  let done = 0
  for (const [name, cols] of columns) {
    if (!readable.has(name)) continue
    of += cols.length
    done += cols.filter((c) => described.has(`${name}.${c}`)).length
  }
  return { described: done, of }
}

/* --------------------------------------------------------------- splice */

const marker = (name) => ({
  open: new RegExp(`<!-- generated:${name}[^>]*-->`),
  close: `<!-- /generated:${name} -->`,
})

/** The document with the named generated section replaced by `body`. */
export function splice(doc, name, body) {
  const { open, close } = marker(name)
  const start = open.exec(doc)
  const end = doc.indexOf(close)
  if (!start || end === -1 || end < start.index) {
    throw new Error(`docs/agents/blueprint.md has no <!-- generated:${name} --> … ${close} section`)
  }
  const head = doc.slice(0, start.index + start[0].length)
  return `${head}\n\n${body.trim()}\n\n${doc.slice(end)}`
}

/** The hand-written text: everything outside the generated sections and the frontmatter. */
export function handWritten(doc) {
  return doc
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/<!-- generated:([a-z]+)[^>]*-->[\s\S]*?<!-- \/generated:\1 -->/g, '')
}

// An instruction, not a description: "Never assert…" at the head of a
// sentence or a bullet, not "the staff they do not see" inside one.
const PROHIBITION = /(?:^|[.;:!?]\s+|—\s+|\n\s*-\s+)(?:never|do not|don't|must not)\b/gim

/** How many times the hand-written core tells the reader what not to do. */
export function prohibitionCount(text) {
  return (text.match(PROHIBITION) ?? []).length
}

/* -------------------------------------------------------------- ratchet */

/**
 * Failures against the recorded baseline, empty when it holds. Coverage may
 * only rise and prohibitions may only fall; an improvement that is not
 * recorded is a failure too, because a baseline that never moves is a
 * backlog wearing a ratchet's clothes (migration-ledger.mjs).
 */
export function ratchetFailures(current, baseline) {
  const failures = []
  const ratio = ({ described, of }) => (of === 0 ? 0 : described / of)
  const now = ratio(current.columnComments)
  const was = ratio(baseline.columnComments)
  if (now < was) {
    failures.push(
      `column-comment coverage fell: ${current.columnComments.described} of ${current.columnComments.of} ` +
        `described, against ${baseline.columnComments.described} of ${baseline.columnComments.of} recorded. ` +
        `A column added without a comment is a gap in what every agent reads — comment it in the migration.`,
    )
  }
  if (current.prohibitions > baseline.prohibitions) {
    failures.push(
      `the hand-written core has ${current.prohibitions} prohibition(s), against ${baseline.prohibitions} recorded. ` +
        `Say what to do instead of what not to.`,
    )
  }
  if (now > was || current.prohibitions < baseline.prohibitions) {
    failures.push(
      `the baseline is stale — coverage ${current.columnComments.described}/${current.columnComments.of}, ` +
        `prohibitions ${current.prohibitions}, better than recorded. Re-record: npm run agent-account -- --record`,
    )
  }
  return failures
}

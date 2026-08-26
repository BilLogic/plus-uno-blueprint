#!/usr/bin/env node
/**
 * #145 Check B — retired database names inside application string literals.
 *
 * This is the class no compiler reaches. `src/types/database.ts` is generated
 * from the schema by `npm run supabase:types`, so every table and column name
 * arrives in TypeScript by machine and `tsc` fails if the app disagrees. That
 * is why the 2026-08 vocabulary refactor looked clean: the part a compiler can
 * see WAS clean. A relation named inside a string is opaque to all of it.
 *
 * `scripts/backfill_cell_keys.mjs:94` is the standing example. It embeds
 * `phase:phases(lifecycle:service_lifecycles(name))` — a relationship that does
 * not exist — in a file that typechecks perfectly and cannot run.
 *
 * SUBJECT, NARROWLY: string literals that NAME A DATABASE OBJECT.
 *
 *   - the argument to `.from(…)` and `.rpc(…)`
 *   - embed hints inside `.select(…)`: the relation in `alias:relation(…)`,
 *     `relation(…)` and `relation!constraint(…)`
 *   - the same syntax inside a raw PostgREST query string — `…?select=…`,
 *     which is how the REST helpers in `scripts/` read
 *
 * NOT every occurrence of a word, and not the column list. A check that
 * matched any string containing "layer" would need an exemption for every
 * sentence of prose in the repository, and each exemption is a place to hide
 * something real. The narrower subject needs none.
 *
 * Static, needs no database, runs in `gates`.
 *
 * Run: node scripts/check-database-names.mjs   (also: npm run check:database-names)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { replacementFor, retiredFragmentsIn } from './retired-vocabulary.mjs'

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname)
const ROOTS = ['src', 'scripts']
const SOURCE = /\.(?:[cm]?[jt]sx?)$/
/**
 * Test files are out of subject.
 *
 * Two reasons, and the second is the one that matters. A test that names a
 * dead relation fails the moment it runs, which is what a test is for — the
 * whole reason this check exists is that application code carrying the same
 * string does NOT fail until a user finds it. And a guard's own fixtures have
 * to be able to name dead relations: `scripts/tests/retired-copy.test.mjs`
 * proves the copy guard ignores `.from('service_lifecycles')` by writing
 * exactly that, and a check that flagged its sibling's evidence would be
 * pressure to weaken one of the two.
 */
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/

/**
 * Database names allowed to keep a retired spelling. Same shape and same two
 * rules as every other list in this batch — see
 * `scripts/tests/retired-vocabulary.test.mjs`.
 *
 * @type {ReadonlyArray<import('./retired-vocabulary.mjs').Exemption>}
 */
export const DATABASE_NAME_EXEMPTIONS = []

/* ------------------------------------------------------------- extraction */

/** Every single-, double- or back-quoted literal, with its line number. */
export function stringLiterals(code) {
  const out = []
  let line = 1
  let i = 0
  while (i < code.length) {
    const char = code[i]
    if (char === '\n') {
      line += 1
      i += 1
      continue
    }
    if (char === '/' && code[i + 1] === '/') {
      const end = code.indexOf('\n', i)
      i = end === -1 ? code.length : end
      continue
    }
    if (char === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2)
      const stop = end === -1 ? code.length : end + 2
      line += (code.slice(i, stop).match(/\n/g) ?? []).length
      i = stop
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      const start = i
      const startLine = line
      i += 1
      while (i < code.length && code[i] !== char) {
        if (code[i] === '\\') i += 1
        else if (code[i] === '\n') line += 1
        i += 1
      }
      i += 1
      out.push({ value: code.slice(start + 1, i - 1), line: startLine, quote: char })
      continue
    }
    i += 1
  }
  return out
}

/**
 * Relation and function names a literal declares, given how it is used.
 *
 * `kind` is `from`, `rpc`, `select` or `url`. Everything but the relation name
 * is deliberately dropped: an alias is the app's own word, a column is not an
 * embed hint, and neither is this check's subject.
 */
export function databaseNames(value, kind) {
  if (kind === 'from' || kind === 'rpc') return [value.trim()].filter(Boolean)
  const source = kind === 'url' ? selectClause(value) : value
  if (!source) return []
  const names = []
  // `alias:relation(`, `relation(`, `relation!constraint(` — the token that
  // immediately precedes an opening parenthesis is the embedded relation.
  // Lookbehind, not a consuming class: an embed opens with the `(` that the
  // previous match had to end on, so consuming the delimiter loses every
  // nested relation after the first.
  for (const match of source.matchAll(
    /(?:^|(?<=[(,]))\s*(?:[A-Za-z_]\w*\s*:\s*)?([A-Za-z_]\w*)\s*(?:!\s*([A-Za-z_]\w*)\s*)?\(/g,
  )) {
    names.push(match[1])
    if (match[2]) names.push(match[2])
  }
  if (kind === 'url') {
    const path = /^\/?([A-Za-z_]\w*)\?/.exec(value)
    if (path) names.push(path[1])
  }
  return names
}

/** The `select=` parameter of a PostgREST query string, or null. */
function selectClause(value) {
  const match = /[?&]select=([^&]*)/.exec(value)
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * The same source with every comment blanked out, line numbers intact.
 *
 * A comment naming a relation is not a use of it — the same rule
 * `stripComments` states in `src/lib/tokenModel.ts`. This check flagged its
 * own docstring the first time it ran, which is the cheapest possible
 * demonstration of why.
 */
export function withoutComments(code) {
  let out = ''
  let i = 0
  while (i < code.length) {
    const char = code[i]
    if (char === '/' && (code[i + 1] === '/' || code[i + 1] === '*')) {
      const block = code[i + 1] === '*'
      const end = block ? code.indexOf('*/', i + 2) : code.indexOf('\n', i)
      const stop = end === -1 ? code.length : block ? end + 2 : end
      out += code.slice(i, stop).replace(/[^\n]/g, ' ')
      i = stop
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      const start = i
      i += 1
      while (i < code.length && code[i] !== char) {
        if (code[i] === '\\') i += 1
        i += 1
      }
      i += 1
      out += code.slice(start, i)
      continue
    }
    out += char
    i += 1
  }
  return out
}

/** `alias:relation(` — the PostgREST embedded-relationship syntax. */
const EMBED_SYNTAX = /[A-Za-z_]\w*\s*:\s*[A-Za-z_]\w*\s*\(/

/** Every literal in a file that names a database object, tagged with how. */
export function namedObjects(code) {
  const out = []
  for (const literal of stringLiterals(code)) {
    if (/[?&]select=/.test(literal.value)) {
      for (const name of databaseNames(literal.value, 'url')) {
        out.push({ ...literal, name, kind: 'PostgREST query string' })
      }
      continue
    }
    // A `select=` clause long enough to need concatenating is split across
    // several literals, and only the first piece carries the `select=`.
    // `scripts/backfill_cell_keys.mjs:94` is the whole reason this branch
    // exists: the dead relation is on the third line of a three-line
    // concatenation, and matching only the piece that opens the query would
    // step straight over it. The embed grammar — `alias:relation(` — is
    // distinctive enough to stand on its own.
    if (EMBED_SYNTAX.test(literal.value)) {
      for (const name of databaseNames(literal.value, 'select')) {
        out.push({ ...literal, name, kind: 'embed hint' })
      }
    }
  }
  const bare = withoutComments(code)
  for (const match of bare.matchAll(/\.(from|rpc|select)\s*\(\s*(['"`])((?:[^\\]|\\.)*?)\2/g)) {
    const kind = match[1]
    const line = (bare.slice(0, match.index).match(/\n/g) ?? []).length + 1
    for (const name of databaseNames(match[3], kind)) {
      out.push({ line, name, kind: kind === 'select' ? 'embed hint' : `.${kind}()` })
    }
  }
  return out
}

/* ------------------------------------------------------------------- walk */

function sourceFilesUnder(root) {
  const abs = resolve(REPO_ROOT, root)
  let stats
  try {
    stats = statSync(abs)
  } catch {
    return []
  }
  if (!stats.isDirectory()) return SOURCE.test(abs) ? [abs] : []
  return readdirSync(abs, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) return []
      const full = join(abs, entry.name)
      if (entry.isDirectory()) return sourceFilesUnder(full)
      if (TEST_FILE.test(entry.name)) return []
      return SOURCE.test(entry.name) ? [full] : []
    })
}

/** Every finding, in file order. */
export function findings() {
  const out = []
  for (const root of ROOTS) {
    for (const file of sourceFilesUnder(root)) {
      const relativePath = relative(REPO_ROOT, file).split('\\').join('/')
      for (const use of namedObjects(readFileSync(file, 'utf8'))) {
        const words = retiredFragmentsIn(use.name)
        if (words.length === 0) continue
        const identifier = `${relativePath}:${use.line} ${use.name}`
        if (DATABASE_NAME_EXEMPTIONS.some((entry) => entry.identifier === identifier)) continue
        out.push({ ...use, file: relativePath, identifier, words, replacement: replacementFor(words[0]) })
      }
    }
  }
  return out
}

function main() {
  const problems = findings()
  for (const problem of problems) {
    console.error(
      `::error file=${problem.file},line=${problem.line}::retired database name in a string ` +
        `literal — ${problem.kind} names \`${problem.name}\`, which the schema retired ` +
        `(${problem.words.join(', ')} → ${problem.replacement}). Nothing typechecks this.`,
    )
  }
  if (problems.length > 0) {
    console.error(`\n${problems.length} retired database name(s) inside string literals.`)
    process.exit(1)
  }
  console.log('ok — every database name in a string literal is one the schema still has')
}

if (import.meta.url === `file://${process.argv[1]}`) main()

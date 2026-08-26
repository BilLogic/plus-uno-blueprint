/**
 * The schema the migration series produces, replayed statement by statement.
 *
 * `alter table … rename` moves the table and the column and NOTHING ELSE: not
 * the index, not the constraint, not the policy, not the trigger, not the
 * comment, not a line of any plpgsql body. Every rename in this repo has left
 * the same residue behind, and the only reason to model the series rather than
 * read `supabase/schema.reference.sql` is that the reference file is prose
 * maintained by hand — it says what someone believed, and this says what the
 * statements do.
 *
 * WHAT IT MODELS
 *
 *   tables, columns, views, sequences, types and domains
 *   constraints, including the names Postgres mints implicitly
 *     (`t_pkey`, `t_col_fkey`, `t_col_key`, `t_col_check`)
 *   indexes, policies, triggers
 *   functions, as the text of the statement that last defined them
 *   comments on any of the above
 *   the `do $$ … $$` sweeps that rewrite function bodies — see below
 *
 * THE SWEEPS ARE MODELLED, AND THAT IS THE WHOLE POINT
 *
 * The renames in this series repair plpgsql bodies with a `do` block that
 * selects `pg_get_functiondef`, runs `replace`/`regexp_replace` over the text,
 * and `execute`s the result. #143 is a bug inside one of those blocks:
 * `\mservice_scenarios?\M` cannot match inside `service_scenario_id` because
 * `_` is a word constituent in Postgres regex, so the SELECTION found seven
 * bodies while the REPLACEMENT two lines below was written for a case the
 * selection never delivered. Skipping `do` blocks would make this replay
 * report the seven it did fix as broken and miss the eight it did not.
 * Interpreting them reproduces production exactly — JavaScript's `\b` and
 * Postgres's `\m`/`\M` agree that `_` is a word character, so the bug survives
 * the translation.
 *
 * WHAT IT CANNOT SEE, and this is the hole, not a rough edge
 *
 * Anything changed in the database WITHOUT a migration. `Phase` was added to
 * `semantic_search.blueprint_chunks_src` on 2026-08-17 by hand and no static
 * check could ever have known. That is what `check:contract:live` and Check A's
 * own `--service-role` half exist for. A green replay says the statements in
 * this repo produce a clean schema; it does not say the database is clean.
 *
 * Also unmodelled, deliberately: `do` blocks that are pure assertions (they
 * change nothing), dynamic DDL built with `format()` other than the function
 * sweeps, and row data. `replayMigrations` returns the statements it did not
 * recognise under `unhandled`, so a new statement shape shows up as a number
 * that moved rather than as silence.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/* --------------------------------------------------------------- lexing */

/**
 * SQL split into top-level statements, comments removed, strings and
 * dollar-quoted bodies preserved verbatim.
 *
 * Hand-written rather than a dependency because the only hard parts are the
 * two Postgres-specific ones — `$tag$ … $tag$` and `''` inside a literal — and
 * a general parser would still have to be taught them.
 */
export function statements(sql) {
  const out = []
  let buffer = ''
  let i = 0
  while (i < sql.length) {
    const rest = sql.slice(i)
    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', i)
      i = end === -1 ? sql.length : end + 1
      buffer += ' '
      continue
    }
    if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', i + 2)
      i = end === -1 ? sql.length : end + 2
      buffer += ' '
      continue
    }
    if (sql[i] === "'") {
      const end = closingQuote(sql, i)
      buffer += sql.slice(i, end)
      i = end
      continue
    }
    const dollar = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(rest)
    if (dollar) {
      const tag = dollar[0]
      const end = sql.indexOf(tag, i + tag.length)
      const stop = end === -1 ? sql.length : end + tag.length
      buffer += sql.slice(i, stop)
      i = stop
      continue
    }
    if (sql[i] === ';') {
      if (buffer.trim()) out.push(buffer.trim())
      buffer = ''
      i += 1
      continue
    }
    buffer += sql[i]
    i += 1
  }
  if (buffer.trim()) out.push(buffer.trim())
  return out
}

/** Index one past the closing `'`, honouring `''` as an escaped quote. */
function closingQuote(sql, start) {
  let i = start + 1
  while (i < sql.length) {
    if (sql[i] === "'") {
      if (sql[i + 1] === "'") {
        i += 2
        continue
      }
      return i + 1
    }
    i += 1
  }
  return sql.length
}

/** The parenthesised list at `from`, contents only. */
function balanced(text, from) {
  const open = text.indexOf('(', from)
  if (open === -1) return null
  let depth = 0
  let i = open
  while (i < text.length) {
    const char = text[i]
    if (char === "'") {
      i = closingQuote(text, i)
      continue
    }
    if (char === '(') depth += 1
    else if (char === ')') {
      depth -= 1
      if (depth === 0) return { body: text.slice(open + 1, i), open, close: i }
    }
    i += 1
  }
  return null
}

/** Top-level comma split, ignoring commas inside parentheses or strings. */
function splitTopLevel(text) {
  const parts = []
  let depth = 0
  let current = ''
  let i = 0
  while (i < text.length) {
    const char = text[i]
    if (char === "'") {
      const end = closingQuote(text, i)
      current += text.slice(i, end)
      i = end
      continue
    }
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (char === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
      i += 1
      continue
    }
    current += char
    i += 1
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

// `.trim()` is load-bearing: policy names are matched with a class that
// admits spaces (a quoted name may contain one), and the rename statements in
// this series are column-aligned, so a greedy match hands back the padding too.
const bare = (name) => String(name).replace(/"/g, '').replace(/^public\./i, '').trim().toLowerCase()
const qualified = (name) => {
  const clean = String(name).replace(/"/g, '').trim().toLowerCase()
  return clean.includes('.') ? clean : `public.${clean}`
}

/* ---------------------------------------------------------------- model */

function emptySchema() {
  return {
    tables: new Map(),
    constraints: new Map(),
    indexes: new Map(),
    policies: new Map(),
    triggers: new Map(),
    functions: new Map(),
    views: new Map(),
    types: new Map(),
    sequences: new Map(),
    comments: new Map(),
    unhandled: [],
  }
}

const addConstraint = (schema, table, name) =>
  schema.constraints.set(`${table}.${name}`, { table, name })

function dropTable(schema, table) {
  schema.tables.delete(table)
  for (const [key, value] of schema.constraints) if (value.table === table) schema.constraints.delete(key)
  for (const [key, value] of schema.indexes) if (value.table === table) schema.indexes.delete(key)
  for (const [key, value] of schema.policies) if (value.table === table) schema.policies.delete(key)
  for (const [key, value] of schema.triggers) if (value.table === table) schema.triggers.delete(key)
  for (const [key, value] of schema.comments) if (value.table === table) schema.comments.delete(key)
}

function renameTable(schema, from, to) {
  const table = schema.tables.get(from)
  if (table) {
    schema.tables.delete(from)
    schema.tables.set(to, { ...table, name: to })
  }
  // Everything hanging off the table keeps its OWN name and follows the table.
  // This is the trap, expressed as a few lines of bookkeeping.
  for (const collection of ['constraints', 'policies', 'triggers']) {
    for (const [key, value] of schema[collection]) {
      if (value.table !== from) continue
      schema[collection].delete(key)
      schema[collection].set(`${to}.${value.name}`, { ...value, table: to })
    }
  }
  for (const [key, value] of schema.indexes) {
    if (value.table === from) schema.indexes.set(key, { ...value, table: to })
  }
  // A comment is addressed by what it is on, so the ADDRESS moves with the
  // table while the TEXT stays exactly as it was written. That is the whole
  // reason `phases` still says "within a service lifecycle".
  for (const [key, value] of [...schema.comments]) {
    if (value.table !== from) continue
    schema.comments.delete(key)
    const target =
      value.kind === 'table'
        ? to
        : value.kind === 'column'
          ? `${to}.${value.target.split('.').pop()}`
          : value.target
    schema.comments.set(`${value.kind}:${target}`, { ...value, table: to, target, name: target })
  }
}

/* ----------------------------------------------------------- statements */

/** Column and constraint definitions inside `create table (…)`. */
function applyTableBody(schema, table, body) {
  const columns = schema.tables.get(table).columns
  for (const item of splitTopLevel(body)) {
    const named = /^constraint\s+("?[\w.]+"?)\s+(.*)$/is.exec(item)
    if (named) {
      addConstraint(schema, table, bare(named[1]))
      continue
    }
    if (/^primary\s+key\b/i.test(item)) {
      addConstraint(schema, table, `${table}_pkey`)
      continue
    }
    if (/^unique\b/i.test(item)) {
      const cols = balanced(item, 0)
      const names = cols ? splitTopLevel(cols.body).map((c) => bare(c)) : []
      addConstraint(schema, table, `${table}_${names.join('_')}_key`)
      continue
    }
    if (/^foreign\s+key\b/i.test(item)) {
      const cols = balanced(item, 0)
      const first = cols ? bare(splitTopLevel(cols.body)[0]) : 'fk'
      addConstraint(schema, table, `${table}_${first}_fkey`)
      continue
    }
    if (/^(check|exclude|like)\b/i.test(item)) {
      addConstraint(schema, table, `${table}_check`)
      continue
    }
    const column = /^("?[A-Za-z_][\w]*"?)\s+(.*)$/s.exec(item)
    if (!column) continue
    const name = bare(column[1])
    columns.set(name, { name })
    applyColumnConstraints(schema, table, name, column[2])
  }
}

/** The constraints Postgres mints from a column definition's own keywords. */
function applyColumnConstraints(schema, table, column, definition) {
  const named = /\bconstraint\s+("?[\w]+"?)/i.exec(definition)
  if (named) addConstraint(schema, table, bare(named[1]))
  if (/\bprimary\s+key\b/i.test(definition)) addConstraint(schema, table, `${table}_pkey`)
  if (/\bunique\b/i.test(definition)) addConstraint(schema, table, `${table}_${column}_key`)
  if (/\breferences\b/i.test(definition)) addConstraint(schema, table, `${table}_${column}_fkey`)
  if (/\bcheck\s*\(/i.test(definition) && !named) addConstraint(schema, table, `${table}_${column}_check`)
}

function applyAlterTable(schema, statement) {
  const head = /^alter\s+table\s+(?:only\s+)?(?:if\s+exists\s+)?("?[\w."]+"?)\s+([\s\S]*)$/i.exec(statement)
  if (!head) return false
  const table = bare(head[1])
  const rest = head[2].trim()

  let match
  if ((match = /^rename\s+to\s+("?[\w."]+"?)/i.exec(rest))) {
    renameTable(schema, table, bare(match[1]))
    return true
  }
  if ((match = /^rename\s+(?:column\s+)?("?[\w]+"?)\s+to\s+("?[\w]+"?)/i.exec(rest))) {
    const entry = schema.tables.get(table)
    if (entry) {
      const from = bare(match[1])
      const to = bare(match[2])
      entry.columns.delete(from)
      entry.columns.set(to, { name: to })
      const commentKey = `column:${table}.${from}`
      const comment = schema.comments.get(commentKey)
      if (comment) {
        schema.comments.delete(commentKey)
        schema.comments.set(`column:${table}.${to}`, { ...comment, target: `${table}.${to}` })
      }
    }
    return true
  }
  if ((match = /^rename\s+constraint\s+("?[\w]+"?)\s+to\s+("?[\w]+"?)/i.exec(rest))) {
    schema.constraints.delete(`${table}.${bare(match[1])}`)
    addConstraint(schema, table, bare(match[2]))
    return true
  }
  let handled = false
  for (const action of splitTopLevel(rest)) {
    if ((match = /^add\s+constraint\s+("?[\w]+"?)/i.exec(action))) {
      addConstraint(schema, table, bare(match[1]))
      handled = true
    } else if ((match = /^drop\s+constraint\s+(?:if\s+exists\s+)?("?[\w]+"?)/i.exec(action))) {
      schema.constraints.delete(`${table}.${bare(match[1])}`)
      handled = true
    } else if ((match = /^add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?("?[\w]+"?)\s+([\s\S]*)$/i.exec(action))) {
      const entry = schema.tables.get(table)
      if (entry) {
        const name = bare(match[1])
        entry.columns.set(name, { name })
        applyColumnConstraints(schema, table, name, match[2])
      }
      handled = true
    } else if ((match = /^drop\s+(?:column\s+)?(?:if\s+exists\s+)?("?[\w]+"?)/i.exec(action))) {
      schema.tables.get(table)?.columns.delete(bare(match[1]))
      handled = true
    } else if (/^(enable|disable)\s+row\s+level\s+security/i.test(action)) {
      handled = true
    } else if (/^alter\s+(column|constraint)\b/i.test(action)) {
      handled = true
    } else if (/^set\s+schema\b/i.test(action)) {
      // Moved out of `public`. The archive schema is not this check's subject,
      // so the table leaves the model rather than being tracked into it.
      dropTable(schema, table)
      handled = true
    }
  }
  return handled
}

const COMMENT_KINDS = 'table|column|index|constraint|function|view|type|domain|schema|materialized\\s+view|sequence|policy|trigger'

function applyComment(schema, statement) {
  const match = new RegExp(
    `^comment\\s+on\\s+(${COMMENT_KINDS})\\s+([\\s\\S]*?)\\s+is\\s+([\\s\\S]*)$`,
    'i',
  ).exec(statement)
  if (!match) return false
  const kind = match[1].toLowerCase().replace(/\s+/g, ' ')
  const target = match[2].trim()
  const text = match[3].trim()
  if (/^null$/i.test(text)) {
    schema.comments.delete(`${kind}:${bare(target)}`)
    return true
  }
  const literal = text.startsWith("'") ? text.slice(1, closingQuote(text, 0) - 1).replace(/''/g, "'") : text
  const onConstraint = /^([\w"]+)\s+on\s+([\w."]+)$/i.exec(target)
  const table =
    kind === 'table'
      ? bare(target)
      : kind === 'column'
        ? bare(target).split('.').slice(0, -1).join('.')
        : onConstraint
          ? bare(onConstraint[2])
          : undefined
  schema.comments.set(`${kind}:${bare(target)}`, {
    kind,
    target: bare(target),
    name: bare(target),
    table,
    text: literal,
  })
  return true
}

function applyStatement(schema, statement, source) {
  const sql = statement.trim()
  let match

  if ((match = /^create\s+(?:or\s+replace\s+)?(?:temp\s+|temporary\s+)?table\s+(?:if\s+not\s+exists\s+)?("?[\w."]+"?)/i.exec(sql))) {
    const table = bare(match[1])
    const body = balanced(sql, match.index + match[0].length - 1)
    schema.tables.set(table, { name: table, columns: new Map(), source })
    if (body) applyTableBody(schema, table, body.body)
    return true
  }
  if ((match = /^drop\s+table\s+(?:if\s+exists\s+)?([\s\S]*?)(?:\s+cascade|\s+restrict)?$/i.exec(sql))) {
    for (const name of splitTopLevel(match[1])) dropTable(schema, bare(name))
    return true
  }
  if (/^alter\s+table\b/i.test(sql)) return applyAlterTable(schema, sql)

  if ((match = /^create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?("?[\w]+"?)?\s*on\s+("?[\w."]+"?)/i.exec(sql))) {
    const table = bare(match[2])
    let name = match[1] ? bare(match[1]) : null
    if (!name) {
      const cols = balanced(sql, match.index + match[0].length)
      const first = cols ? bare(splitTopLevel(cols.body)[0].split(/\s+/)[0]) : 'expr'
      name = `${table}_${first}_idx`
    }
    schema.indexes.set(name, { name, table, source })
    return true
  }
  if ((match = /^alter\s+index\s+(?:if\s+exists\s+)?("?[\w."]+"?)\s+rename\s+to\s+("?[\w]+"?)/i.exec(sql))) {
    const from = bare(match[1])
    const to = bare(match[2])
    const entry = schema.indexes.get(from)
    if (entry) {
      schema.indexes.delete(from)
      schema.indexes.set(to, { ...entry, name: to })
    }
    return true
  }
  if ((match = /^drop\s+index\s+(?:if\s+exists\s+)?([\s\S]*?)(?:\s+cascade|\s+restrict)?$/i.exec(sql))) {
    for (const name of splitTopLevel(match[1])) schema.indexes.delete(bare(name))
    return true
  }

  if ((match = /^create\s+policy\s+("?[\w ]+"?)\s+on\s+("?[\w."]+"?)/i.exec(sql))) {
    const table = bare(match[2])
    const name = bare(match[1])
    schema.policies.set(`${table}.${name}`, { name, table, source })
    return true
  }
  if ((match = /^drop\s+policy\s+(?:if\s+exists\s+)?("?[\w ]+"?)\s+on\s+("?[\w."]+"?)/i.exec(sql))) {
    schema.policies.delete(`${bare(match[2])}.${bare(match[1])}`)
    return true
  }
  if ((match = /^alter\s+policy\s+("?[\w ]+"?)\s+on\s+("?[\w."]+"?)\s+rename\s+to\s+("?[\w ]+"?)/i.exec(sql))) {
    const table = bare(match[2])
    const from = bare(match[1])
    const entry = schema.policies.get(`${table}.${from}`)
    if (entry) {
      schema.policies.delete(`${table}.${from}`)
      const to = bare(match[3])
      schema.policies.set(`${table}.${to}`, { ...entry, name: to })
    }
    return true
  }
  if (/^alter\s+policy\b/i.test(sql)) return true

  if ((match = /^create\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\s+("?[\w]+"?)[\s\S]*?\son\s+("?[\w."]+"?)/i.exec(sql))) {
    const table = bare(match[2])
    const name = bare(match[1])
    schema.triggers.set(`${table}.${name}`, { name, table, source })
    return true
  }
  if ((match = /^drop\s+trigger\s+(?:if\s+exists\s+)?("?[\w]+"?)\s+on\s+("?[\w."]+"?)/i.exec(sql))) {
    schema.triggers.delete(`${bare(match[2])}.${bare(match[1])}`)
    return true
  }
  if ((match = /^alter\s+trigger\s+("?[\w]+"?)\s+on\s+("?[\w."]+"?)\s+rename\s+to\s+("?[\w]+"?)/i.exec(sql))) {
    const table = bare(match[2])
    const from = bare(match[1])
    const entry = schema.triggers.get(`${table}.${from}`)
    if (entry) {
      schema.triggers.delete(`${table}.${from}`)
      const to = bare(match[3])
      schema.triggers.set(`${table}.${to}`, { ...entry, name: to })
    }
    return true
  }

  if ((match = /^create\s+(?:or\s+replace\s+)?function\s+("?[\w."]+"?)\s*\(/i.exec(sql))) {
    const name = qualified(match[1])
    schema.functions.set(name, { name, definition: sql, source })
    return true
  }
  if ((match = /^drop\s+function\s+(?:if\s+exists\s+)?("?[\w."]+"?)/i.exec(sql))) {
    schema.functions.delete(qualified(match[1]))
    return true
  }

  if ((match = /^create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?("?[\w."]+"?)/i.exec(sql))) {
    const name = qualified(match[1])
    schema.views.set(name, { name, definition: sql, source })
    return true
  }
  if ((match = /^drop\s+view\s+(?:if\s+exists\s+)?([\s\S]*?)(?:\s+cascade|\s+restrict)?$/i.exec(sql))) {
    for (const name of splitTopLevel(match[1])) schema.views.delete(qualified(name))
    return true
  }
  if ((match = /^create\s+(?:type|domain)\s+("?[\w."]+"?)/i.exec(sql))) {
    schema.types.set(qualified(match[1]), { name: qualified(match[1]), definition: sql, source })
    return true
  }
  if ((match = /^drop\s+(?:type|domain)\s+(?:if\s+exists\s+)?([\s\S]*?)(?:\s+cascade|\s+restrict)?$/i.exec(sql))) {
    for (const name of splitTopLevel(match[1])) schema.types.delete(qualified(name))
    return true
  }
  if ((match = /^create\s+sequence\s+(?:if\s+not\s+exists\s+)?("?[\w."]+"?)/i.exec(sql))) {
    schema.sequences.set(qualified(match[1]), { name: qualified(match[1]), source })
    return true
  }

  if (/^comment\s+on\b/i.test(sql)) return applyComment(schema, sql)
  if (/^do\b/i.test(sql)) return applyDoBlock(schema, sql, source)

  // Statements with no bearing on the identifier surface.
  if (/^(begin|commit|rollback|savepoint|start\s+transaction)$/i.test(sql)) return true
  if (/^(insert|update|delete|select|with|set|grant|revoke|create\s+(schema|extension|publication)|drop\s+(schema|extension|publication)|alter\s+(schema|default|view|function|sequence|type|domain|publication)|analyze|vacuum|refresh|truncate)\b/i.test(sql)) {
    return true
  }
  return false
}

/* ------------------------------------------------------- the do-block sweeps */

/**
 * Postgres regex → JavaScript regex, for the fragment of the dialect the
 * sweeps use.
 *
 * `\m` and `\M` are Postgres's start-of-word and end-of-word. `\b` is the
 * JavaScript equivalent and — critically — both dialects count `_` as a word
 * constituent, so a pattern that could not match inside an identifier in
 * Postgres cannot match inside one here either. That is not a coincidence
 * being relied upon; it is the defect in #143 being preserved.
 */
export function postgresRegex(pattern, flags = 'g') {
  return new RegExp(pattern.replace(/\\m/g, '\\b').replace(/\\M/g, '\\b'), flags)
}

const sqlLiteral = (raw) => raw.slice(1, -1).replace(/''/g, "'")

/** `'…'` literals in `text`, in order, as raw slices including the quotes. */
function literals(text) {
  const out = []
  let i = 0
  while (i < text.length) {
    if (text[i] === "'") {
      const end = closingQuote(text, i)
      out.push(text.slice(i, end))
      i = end
      continue
    }
    i += 1
  }
  return out
}

/**
 * A `do` block that rewrites function bodies, applied.
 *
 * Two shapes appear in this series and both reduce to the same thing: pick a
 * set of functions, apply an ordered list of text substitutions to each
 * definition, `execute` the result.
 *
 *   for r in select … where pg_get_functiondef(p.oid) ~ 'PATTERN' loop  …  execute d
 *   select pg_get_functiondef(…) into d … where p.proname = 'NAME'      …  execute d
 *
 * A block with no `execute d` changes nothing — every other `do` block in the
 * series is an assertion — so it is skipped rather than guessed at.
 */
function applyDoBlock(schema, statement, source) {
  if (applyForeachDdl(schema, statement, source)) return true
  if (!/\bexecute\s+d\s*;/i.test(statement)) return true

  for (const segment of statement.split(/\bexecute\s+d\s*;/i).slice(0, -1)) {
    const targets = sweepTargets(schema, segment)
    const edits = sweepEdits(segment)
    if (targets.length === 0 || edits.length === 0) continue
    for (const fn of targets) {
      let definition = fn.definition
      for (const edit of edits) definition = edit(definition)
      schema.functions.set(fn.name, { ...fn, definition, rewritten: true })
    }
  }
  return true
}

/**
 * `foreach t in array array[…] loop … execute format(…) … end loop`, applied.
 *
 * `20260805150000_service_account_tier.sql` mints thirty-nine RLS policies this
 * way, three per table, naming each one `t || '_insert_service_only'`. Those
 * names are as real as any written out longhand — `propositions_insert_service_only`
 * is still on `business_model` today — and a replay that skipped the block
 * would under-report the residue by exactly the policies nobody typed.
 *
 * Deliberately narrow: a literal array, a `format()` whose template is a
 * literal, and arguments that are the loop variable optionally concatenated
 * with literals. Anything else (a `format()` over a query result, say) is left
 * alone rather than guessed at, and the block falls through to the sweep
 * handler.
 */
function applyForeachDdl(schema, statement, source) {
  const header = /\bforeach\s+([a-z_][\w]*)\s+in\s+array\s+array\s*\[/i.exec(statement)
  if (!header) return false
  const list = balancedBracket(statement, header.index + header[0].length - 1)
  if (!list) return false
  const values = literals(list.body).map(sqlLiteral)
  const body = statement.slice(list.close + 1)
  const variable = header[1]

  let applied = false
  const call = /\bexecute\s+format\s*\(/gi
  let match
  while ((match = call.exec(body))) {
    const args = balanced(body, match.index + match[0].length - 1)
    if (!args) continue
    const parts = splitTopLevel(args.body)
    const template = parts[0]?.trim()
    if (!template?.startsWith("'")) continue
    for (const value of values) {
      const resolved = parts.slice(1).map((part) => resolveConcat(part, variable, value))
      if (resolved.some((one) => one === null)) break
      applyStatement(schema, format(sqlLiteral(template), resolved), source)
      applied = true
    }
  }
  return applied
}

/** `t`, `'literal'`, or the two concatenated with `||`. Null when unresolvable. */
function resolveConcat(expression, variable, value) {
  let out = ''
  for (const term of expression.split('||').map((one) => one.trim())) {
    if (term === variable) out += value
    else if (term.startsWith("'")) out += sqlLiteral(term)
    else return null
  }
  return out
}

/** `format()`'s `%I`, `%s` and `%L`, in argument order. */
function format(template, args) {
  let index = 0
  return template.replace(/%[IsL]/g, (specifier) => {
    const value = args[index]
    index += 1
    if (value === undefined) return specifier
    return specifier === '%L' ? `'${String(value).replace(/'/g, "''")}'` : value
  })
}

/** The bracketed list at `from`, contents only. */
function balancedBracket(text, from) {
  const open = text.indexOf('[', from)
  if (open === -1) return null
  let depth = 0
  let i = open
  while (i < text.length) {
    if (text[i] === "'") {
      i = closingQuote(text, i)
      continue
    }
    if (text[i] === '[') depth += 1
    else if (text[i] === ']') {
      depth -= 1
      if (depth === 0) return { body: text.slice(open + 1, i), open, close: i }
    }
    i += 1
  }
  return null
}

/** The functions one sweep segment selects. */
function sweepTargets(schema, segment) {
  const all = [...schema.functions.values()]
  const named = /\bp\.proname\s*=\s*('(?:[^']|'')*')/i.exec(segment)
  if (named) {
    const want = sqlLiteral(named[1])
    return all.filter((fn) => fn.name.split('.').pop() === want)
  }
  const inList = /\bp\.proname\s+(not\s+)?in\s*\(([^)]*)\)/i.exec(segment)
  const pattern = /pg_get_functiondef\([^)]*\)\s*~\s*('(?:[^']|'')*')/i.exec(segment)
  if (!pattern && !inList) return []
  // Not global. `RegExp.prototype.test` on a `/g/` regex carries `lastIndex`
  // between calls, so a shared global pattern silently skips every other
  // function it is asked about.
  const regex = pattern ? postgresRegex(sqlLiteral(pattern[1]), '') : null
  let selected = regex ? all.filter((fn) => regex.test(fn.definition)) : all
  if (inList) {
    const names = literals(inList[2]).map(sqlLiteral)
    const negated = Boolean(inList[1])
    selected = selected.filter((fn) => names.includes(fn.name.split('.').pop()) !== negated)
  }
  return selected
}

/** The `d := replace(…)` / `d := regexp_replace(…)` chain, in order. */
function sweepEdits(segment) {
  const edits = []
  const assignment = /\bd\s*:=\s*(regexp_replace|replace)\s*\(/gi
  let match
  while ((match = assignment.exec(segment))) {
    const call = balanced(segment, match.index + match[0].length - 1)
    if (!call) continue
    const args = splitTopLevel(call.body)
    if (args.length < 3) continue
    const [, from, to] = args
    if (!from.trim().startsWith("'") || !to.trim().startsWith("'")) continue
    const search = sqlLiteral(from.trim())
    const replacement = sqlLiteral(to.trim())
    if (match[1].toLowerCase() === 'replace') {
      edits.push((text) => text.split(search).join(replacement))
    } else {
      const flags = args[3] && args[3].trim().startsWith("'") ? sqlLiteral(args[3].trim()) : ''
      const regex = postgresRegex(search, flags.includes('g') ? 'g' : '')
      edits.push((text) => text.replace(regex, replacement))
    }
  }
  return edits
}

/* --------------------------------------------------------------- driver */

/** Every `.sql` under `dir`, in filename order — the order Supabase applies. */
export function migrationFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

/** The schema the series produces. */
export function replayMigrations(dir) {
  const schema = emptySchema()
  for (const file of migrationFiles(dir)) {
    const sql = readFileSync(join(dir, file), 'utf8')
    for (const statement of statements(sql)) {
      let ok = false
      try {
        ok = applyStatement(schema, statement, file)
      } catch (error) {
        ok = false
        schema.unhandled.push({ file, statement: statement.slice(0, 200), error: error.message })
        continue
      }
      if (!ok) schema.unhandled.push({ file, statement: statement.slice(0, 200) })
    }
  }
  return schema
}

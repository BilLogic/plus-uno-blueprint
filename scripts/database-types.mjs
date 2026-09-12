#!/usr/bin/env node
/**
 * Does this deployment's `types/database.ts` still describe the database?
 *
 * That file is the app's only account of the schema, and for a year it was
 * maintained BY HAND, because the two documented generators both need
 * something this machine does not have: `--linked` needs a project the CLI
 * account can reach, and the `--db-url` form needs Docker. Every hand edit was
 * careful and every one of them said so in the header. The result was still a
 * file describing a schema that had moved: eight columns were missing outright
 * — `cells.origin`, `cells.cell_key`, the stakeholders link then spelled
 * `parent_id` (`part_of_id` since `20260912210000`) and `origin` on
 * five more tables — and two foreign-key names still spelled a relation that a
 * migration had renamed.
 *
 * None of that could fail. A missing column is not a type error; it is a
 * column the app cannot select without casting, and a wrong constraint name is
 * a string nothing dereferences. The file was wrong in the one way a types
 * file can be wrong without anything noticing.
 *
 * So the comparison is the guard, and it lives here as pure functions over two
 * plain descriptions — one parsed out of the file, one read from the
 * catalogue. `check-database-types.mjs` is the database and the filesystem.
 *
 * WHAT IT DOES NOT CHECK, deliberately. Column TYPE beyond nullability: the
 * generator's mapping from Postgres types to TypeScript is its own and this
 * would be a second, worse copy of it. Views: their `Row` shapes come from the
 * same generator and nothing has gone stale there. Return types of functions:
 * `Returns:` is a projection the generator computes, and the argument list is
 * what call sites actually depend on.
 */

/** The text between a `{` at `open` and the `}` that closes it, braces included. */
export function balanced(source, open) {
  let depth = 0
  for (let i = open; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  return null
}

/** The `Tables` map as `{ table: { column: nullable } }`, read from the file. */
export function tablesInFile(source) {
  const at = source.indexOf('    Tables: {')
  if (at === -1) throw new Error('no Tables map in the types file')
  const tables = balanced(source, source.indexOf('{', at))
  const out = new Map()
  for (const match of tables.matchAll(/\n {6}([a-z_]+): \{/g)) {
    const block = balanced(tables, match.index + match[0].length - 1)
    const row = balanced(block, block.indexOf('{', block.indexOf('Row: {')))
    const columns = new Map()
    for (const line of row.matchAll(/\n {10}([a-z_]+): ([^\n]+)/g)) {
      columns.set(line[1], /\| null/.test(line[2]))
    }
    out.set(match[1], columns)
  }
  return out
}

/**
 * The `Functions` map as `{ name: Set<'arg'|'arg?'> }`, read from the file.
 *
 * `Args: never` — a function that takes none — parses to an empty set, which
 * is what the catalogue reports for it too.
 */
export function functionsInFile(source) {
  const at = source.indexOf('    Functions: {')
  if (at === -1) throw new Error('no Functions map in the types file')
  const functions = balanced(source, source.indexOf('{', at))
  const out = new Map()
  for (const match of functions.matchAll(/\n {6}([a-z_]+): \{/g)) {
    const block = balanced(functions, match.index + match[0].length - 1)
    const argsAt = block.indexOf('Args:')
    const args = new Set()
    if (block.slice(argsAt + 'Args:'.length).trimStart().startsWith('{')) {
      const list = balanced(block, block.indexOf('{', argsAt))
      for (const arg of list.matchAll(/([a-z_]+)(\??):/g)) {
        args.add(arg[1] + (arg[2] ? '?' : ''))
      }
    }
    out.set(match[1], args)
  }
  return out
}

/**
 * Every disagreement between the file and the catalogue, as sentences.
 *
 * `unknown` is exempt from the nullability comparison: the generator emits it
 * for the types it has no mapping for — `tsvector` is the one here — and
 * `unknown` already admits null, so there is nothing to disagree about.
 */
export function typesDrift({ fileTables, fileFunctions, dbTables, dbFunctions, fileSource }) {
  const problems = []
  const remainingTables = new Map(dbTables)

  for (const [table, columns] of fileTables) {
    const truth = remainingTables.get(table)
    if (!truth) {
      problems.push(`${table} is in the types file and not in the database`)
      continue
    }
    for (const [column, nullable] of truth) {
      if (!columns.has(column)) {
        problems.push(`${table}.${column} is in the database and not in the types file`)
      } else if (columns.get(column) !== nullable && !isUnknown(fileSource, table, column)) {
        problems.push(
          `${table}.${column} is ${nullable ? 'nullable' : 'not null'} in the database ` +
            `and ${columns.get(column) ? 'nullable' : 'not null'} in the types file`,
        )
      }
    }
    for (const column of columns.keys()) {
      if (!truth.has(column)) {
        problems.push(`${table}.${column} is in the types file and not in the database`)
      }
    }
    remainingTables.delete(table)
  }
  for (const table of remainingTables.keys()) {
    problems.push(`${table} is in the database and not in the types file`)
  }

  const remainingFunctions = new Map(dbFunctions)
  for (const [name, args] of fileFunctions) {
    const truth = remainingFunctions.get(name)
    if (!truth) {
      problems.push(`${name}() is in the types file and not in the database`)
      continue
    }
    const mine = [...args].sort().join(', ')
    const theirs = [...truth].sort().join(', ')
    if (mine !== theirs) {
      problems.push(`${name}() takes (${theirs}) in the database and (${mine}) in the types file`)
    }
    remainingFunctions.delete(name)
  }
  for (const name of remainingFunctions.keys()) {
    problems.push(`${name}() is in the database and not in the types file`)
  }

  return problems
}

/** Whether the file types this column `unknown`, which admits null already. */
function isUnknown(source, table, column) {
  if (!source) return false
  const at = source.indexOf(`\n      ${table}: {`)
  if (at === -1) return false
  const block = balanced(source, source.indexOf('{', at))
  const row = balanced(block, block.indexOf('{', block.indexOf('Row: {')))
  return new RegExp(`\\n {10}${column}: unknown`).test(row)
}

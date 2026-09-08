import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'vitest'

import {
  functionsInFile,
  tablesInFile,
  typesDrift,
} from '../database-types.mjs'

/*
 * The comparison behind `check:database-types:live`.
 *
 * The live half needs a database and does not run in CI. This half is the
 * parser and the difference, over fixtures — so a change to either fails here
 * rather than on the one machine that has a connection.
 *
 * The fixtures are shaped like the generator's output because that is what the
 * parser reads. Every case below is one the hand-maintained file actually hit:
 * a column the database has and the file does not, a nullability that drifted,
 * a function whose argument list moved, and `unknown` on a column type the
 * generator has no mapping for.
 */

const FIXTURE = `
export type Database = {
  public: {
    Tables: {
      cells: {
        Row: {
          cell_key: string | null
          content: string
          id: string
          search_tsv: unknown
        }
        Insert: {
          cell_key?: string | null
        }
        Relationships: []
      }
      lanes: {
        Row: {
          id: string
          origin: string
        }
        Relationships: []
      }
    }
    Functions: {
      add_step: {
        Args: { at_position?: number; name: string; path_id: string }
        Returns: string
      }
      value_sets: {
        Args: never
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
`

const columns = (pairs) => new Map(pairs)

function db(overrides = {}) {
  return {
    dbTables: new Map([
      [
        'cells',
        columns([
          ['cell_key', true],
          ['content', false],
          ['id', false],
          ['search_tsv', true],
        ]),
      ],
      ['lanes', columns([['id', false], ['origin', false]])],
    ]),
    dbFunctions: new Map([
      ['add_step', new Set(['path_id', 'name', 'at_position?'])],
      ['value_sets', new Set()],
      ...(overrides.extraFunctions ?? []),
    ]),
    ...overrides,
  }
}

function drift(overrides) {
  const { dbTables, dbFunctions } = db(overrides)
  return typesDrift({
    fileTables: tablesInFile(FIXTURE),
    fileFunctions: functionsInFile(FIXTURE),
    dbTables,
    dbFunctions,
    fileSource: FIXTURE,
  })
}

test('the parser reads the shape the generator emits', () => {
  const tables = tablesInFile(FIXTURE)
  assert.deepEqual([...tables.keys()], ['cells', 'lanes'])
  // The Row map only — an Insert block repeats the same names with `?` and
  // would double every column if it leaked in.
  assert.deepEqual([...tables.get('cells').keys()], [
    'cell_key',
    'content',
    'id',
    'search_tsv',
  ])
  assert.equal(tables.get('cells').get('cell_key'), true)
  assert.equal(tables.get('cells').get('content'), false)

  const functions = functionsInFile(FIXTURE)
  assert.deepEqual(
    [...functions.get('add_step')].sort(),
    ['at_position?', 'name', 'path_id'],
  )
  // `Args: never` is a function that takes none, which is what the catalogue
  // reports for it too.
  assert.deepEqual([...functions.get('value_sets')], [])
})

test('a file that matches the database reports nothing', () => {
  assert.deepEqual(drift(), [])
})

test('a column the database has and the file does not is a finding', () => {
  // The real one: `cells.origin` had been in the database for weeks.
  const { dbTables, dbFunctions } = db()
  dbTables.get('cells').set('origin', false)
  assert.deepEqual(
    typesDrift({
      fileTables: tablesInFile(FIXTURE),
      fileFunctions: functionsInFile(FIXTURE),
      dbTables,
      dbFunctions,
      fileSource: FIXTURE,
    }),
    ['cells.origin is in the database and not in the types file'],
  )
})

test('a nullability that drifted is a finding, and `unknown` is not', () => {
  const { dbTables, dbFunctions } = db()
  dbTables.get('cells').set('content', true)
  const problems = typesDrift({
    fileTables: tablesInFile(FIXTURE),
    fileFunctions: functionsInFile(FIXTURE),
    dbTables,
    dbFunctions,
    fileSource: FIXTURE,
  })
  // `search_tsv` is nullable in the database and typed `unknown` in the file,
  // which admits null already — the generator emits it for types it has no
  // mapping for, and disagreeing with it would be noise.
  assert.deepEqual(problems, [
    'cells.content is nullable in the database and not null in the types file',
  ])
})

test('an argument list that moved is a finding', () => {
  const { dbTables, dbFunctions } = db()
  dbFunctions.set('add_step', new Set(['path_id', 'name', 'at_position']))
  assert.deepEqual(
    typesDrift({
      fileTables: tablesInFile(FIXTURE),
      fileFunctions: functionsInFile(FIXTURE),
      dbTables,
      dbFunctions,
      fileSource: FIXTURE,
    }),
    [
      'add_step() takes (at_position, name, path_id) in the database and ' +
        '(at_position?, name, path_id) in the types file',
    ],
  )
})

test('a function only one side has is a finding, in either direction', () => {
  const { dbTables, dbFunctions } = db()
  dbFunctions.set('mint_cell_key', new Set(['path_id']))
  dbFunctions.delete('value_sets')
  assert.deepEqual(
    typesDrift({
      fileTables: tablesInFile(FIXTURE),
      fileFunctions: functionsInFile(FIXTURE),
      dbTables,
      dbFunctions,
      fileSource: FIXTURE,
    }),
    [
      'value_sets() is in the types file and not in the database',
      'mint_cell_key() is in the database and not in the types file',
    ],
  )
})

test('the real types file parses, and carries more than the fixture', () => {
  const source = readFileSync('src/types/database.ts', 'utf8')
  const tables = tablesInFile(source)
  const functions = functionsInFile(source)
  // Not a census — a floor. The file described thirteen functions while the
  // database had forty-six, and nothing said so.
  assert.ok(tables.size > 15, `only ${tables.size} tables parsed out of the types file`)
  assert.ok(
    functions.size > 40,
    `only ${functions.size} functions parsed out of the types file`,
  )
  assert.ok(tables.get('cells')?.has('origin'), 'cells.origin is missing again')
})

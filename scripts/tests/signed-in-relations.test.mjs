/**
 * The signed-in-only relations' columns, as the agent account receives them:
 * resolved against the migration series, because the anon key the generator
 * holds is refused all of them.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { tableColumns } from '../agent-account.mjs'
import { BLUEPRINT_CONTRACT } from '../blueprintContract.mjs'
import { repoConfig } from '../repo-config.mjs'
import { signedIn, signedInRelationColumns } from '../signed-in-relations.mjs'

const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '')
const DECLARED = tableColumns(readFileSync(`${ROOT}/deployment/types/database.ts`, 'utf8'))

test('every signed-in-only relation resolves against the migration series, columns and all', () => {
  const answer = signedIn({ root: ROOT, declared: DECLARED })
  assert.deepEqual([...answer.keys()], [...BLUEPRINT_CONTRACT.signedInReadTables])
  for (const [relation, columns] of answer) {
    assert.ok(columns.length > 0, `${relation} resolved to no columns`)
  }
  assert.ok(answer.get('evidence').includes('cell_id'))
  assert.deepEqual(answer.get('evidence_counts'), ['cell_id', 'n'], 'a view takes the columns its select list names')
  assert.deepEqual(
    answer.get('trash'),
    ['id', 'deleted_at', 'deleted_by', 'kind', 'label', 'payload', 'affected_slices'],
    'an aliased view column resolves, in the order the view names it',
  )
  assert.deepEqual(
    answer.get('audit_findings').slice(0, 5),
    ['id', 'service_id', 'run_id', 'source', 'check_key'],
    'a renamed column keeps its place, as it does in Postgres',
  )
})

test('the generator reaches the hook through repo-config', async () => {
  const answer = await repoConfig.agentAccount.signedIn({ root: ROOT, declared: DECLARED })
  assert.ok(answer instanceof Map)
  assert.equal(answer.size, BLUEPRINT_CONTRACT.signedInReadTables.length)
})

test('a view keeps only the declared columns its select list names', () => {
  const schema = {
    tables: new Map(),
    views: new Map([['public.tally', { definition: 'create view public.tally as select cell_id, count(*) as n from public.evidence' }]]),
  }
  const answer = signedInRelationColumns({
    relations: ['tally'],
    schema,
    declared: new Map([['tally', ['n', 'cell_id', 'gone']]]),
  })
  assert.deepEqual(answer.get('tally'), ['cell_id', 'n'])
})

test('a view whose select list names none of its declared columns refuses the run', () => {
  const schema = {
    tables: new Map(),
    views: new Map([['public.everything', { definition: 'create view public.everything as select * from public.evidence' }]]),
  }
  assert.throws(
    () => signedInRelationColumns({ relations: ['everything'], schema, declared: new Map([['everything', ['id']]]) }),
    /names none of its declared columns/,
  )
})

test('a signed-in-only relation no migration defines refuses the run', () => {
  assert.throws(
    () =>
      signedInRelationColumns({
        relations: ['renamed_away'],
        schema: { tables: new Map(), views: new Map() },
        declared: new Map(),
      }),
    /no migration defines it/,
  )
})

/**
 * The columns of the relations a signed-in session reads and the anon key may
 * not, for the agent account (`repoConfig.agentAccount.signedIn`).
 *
 * The generator asks the live database as the anon key, and since
 * 20261101130000 the anon key is refused every one of
 * `signedInReadTables`. A refusal says the relation is there and nothing
 * about its columns, yet a signed-in agent reads every one of them. So the
 * columns come from the migration series instead — the same replay
 * `check-blueprint-contract.mjs` resolves names on those relations against —
 * and no key beyond the anon one is needed, in CI or anywhere else.
 *
 * A table's columns are the replay's, in the order the series gives them. A
 * view's columns are not modelled by the replay, so a view takes the columns
 * its declared Row names and keeps each one its select list names, by the
 * contract check's own `staticClaimProblem`, in the order the select list
 * names them. A relation the series does not define, or a view none of whose
 * declared columns its select list names (`select *`, say), refuses the run:
 * an account that silently dropped it would hide the drift.
 */
import { resolve } from 'node:path'
import { BLUEPRINT_CONTRACT, CONTRACT_PATH } from './blueprintContract.mjs'
import { columnPattern, staticClaimProblem, viewSelectList } from './check-blueprint-contract.mjs'
import { replayMigrations } from './migration-replay.mjs'

/** Where in the select list a column is named, so a view prints in its own order. */
const position = (selectList, column) => selectList.search(columnPattern(column))

/**
 * @param {{ relations: readonly string[], schema: { tables: Map<string, { columns: Map<string, unknown> }>, views: Map<string, unknown> }, declared: Map<string, string[]> }} input
 * @returns {Map<string, string[]>}
 */
export function signedInRelationColumns({ relations, schema, declared }) {
  const answer = new Map()
  for (const relation of relations) {
    const table = schema.tables.get(relation)
    if (table) {
      answer.set(relation, [...table.columns.keys()])
      continue
    }
    if (staticClaimProblem({ table: relation, column: null }, schema) !== null) {
      throw new Error(
        `${CONTRACT_PATH} names "${relation}" signed-in only, and no migration defines it. ` +
          'Renamed or dropped? Fix the contract and the account renders it again.',
      )
    }
    const columns = (declared.get(relation) ?? []).filter(
      (column) => staticClaimProblem({ table: relation, column }, schema) === null,
    )
    if (columns.length === 0) {
      throw new Error(
        `the signed-in-only view "${relation}" names none of its declared columns in its select list. ` +
          'Declare its Row in deployment/types/database.ts, or spell its columns out in the view.',
      )
    }
    const selectList = viewSelectList(schema.views.get(`public.${relation}`).definition)
    answer.set(relation, columns.sort((a, b) => position(selectList, a) - position(selectList, b)))
  }
  return answer
}

/**
 * The hook `repo-config.mjs` hands the generator.
 *
 * @param {{ root: string, declared: Map<string, string[]> }} input
 */
export function signedIn({ root, declared }) {
  return signedInRelationColumns({
    relations: BLUEPRINT_CONTRACT.signedInReadTables,
    schema: replayMigrations(resolve(root, 'supabase/migrations')),
    declared,
  })
}

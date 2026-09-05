import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearSession,
  recordChange,
  sessionSnapshot,
  type ChangeEntry,
} from '@/lib/authoringSession'
import { executeRevert } from '@/lib/revertChange'
import type { Database } from '@/types/database'

/**
 * A ledger entry outlives the schema it was recorded under. The one case
 * this pins: an "edited a touchpoint at this cell" entry recorded before
 * 20260902160000 carries four captured columns, two of which are not
 * columns any more (#276). Reverting it must still restore the two that
 * are, and must not send the two that are not — PostgREST answers an
 * unknown column with a 400, which would make every old entry unrevertable.
 */
type Row = Record<string, unknown>

function fakeClient(rows: Row[]) {
  const updates: Array<{ table: string; patch: Row; filters: Row }> = []
  const client = {
    from(table: string) {
      return {
        update(patch: Row) {
          const filters: Row = {}
          const api = {
            eq(column: string, value: unknown) {
              filters[column] = value
              return api
            },
            select() {
              return api
            },
            then(onFulfilled: (value: unknown) => unknown) {
              const hit = rows.filter((row) =>
                Object.entries(filters).every((entry) => row[entry[0]] === entry[1]),
              )
              for (const row of hit) Object.assign(row, patch)
              updates.push({ table, patch, filters })
              return Promise.resolve({ data: hit, error: null }).then(onFulfilled)
            },
          }
          return api
        },
      }
    },
  } as unknown as SupabaseClient<Database>
  return { client, updates, rows }
}

beforeEach(() => clearSession())

describe('reverting a placement edit recorded before #276', () => {
  it('restores summary and role, and sends nothing for the dropped columns', async () => {
    const { client, updates, rows } = fakeClient([
      { id: 'ct-1', summary: 'New words.', role: 'peripheral' },
    ])
    recordChange(
      'update_touchpoint_placement',
      { placement_id: 'ct-1' },
      {
        fn: 'restore_touchpoint_placement',
        args: {
          placement_id: 'ct-1',
          // As a pre-contract entry captured it: four columns.
          columns: {
            summary: 'The words before.',
            screenshot: '/blueprint-images/shared/plus-app.png',
            url: 'https://www.figma.com/file/abc',
            role: null,
          },
        },
      },
    )
    const [entry] = sessionSnapshot()
    await executeRevert(client, entry!)

    expect(updates).toHaveLength(1)
    expect(updates[0]!.table).toBe('cell_touchpoints')
    expect(updates[0]!.patch).toEqual({ summary: 'The words before.', role: null })
    expect(rows[0]).toMatchObject({ summary: 'The words before.', role: null })
  })
})

/**
 * The first undo of a first summary.
 *
 * Every one-column prose field starts null, so the FIRST save of one captures
 * `''` as its previous value — which makes "restore the empty" the commonest
 * revert in the ledger, not an edge case. `stringArg` refuses `''` on purpose
 * (an id never legitimately is one), and `update_service_summary` read its
 * value through it while the scenario and step cases did not. Reverting the
 * first service summary anyone wrote therefore threw "This change's revert is
 * missing its “summary” value" and left the field as typed.
 *
 * All three now read through `optionalStringArg`, so this asserts the same
 * thing three times rather than once: the empty string is the value, and the
 * write that clears the column actually runs.
 */
const revertEntry = (fn: string, args: Record<string, unknown>): ChangeEntry => ({
  id: 'change-1',
  fn: fn as ChangeEntry['fn'],
  args: {},
  at: 0,
  revert: { fn, args },
})

describe('executeRevert restores an empty summary', () => {
  it('clears a service summary back to nothing', async () => {
    const { client, updates } = fakeClient([
      { id: 'svc-1', summary: 'A sentence nobody asked for' },
    ])

    await executeRevert(
      client,
      revertEntry('update_service_summary', { service_id: 'svc-1', summary: '' }),
    )

    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({
      table: 'services',
      patch: { summary: null },
      filters: { id: 'svc-1' },
    })
  })

  it('clears a scenario summary back to nothing', async () => {
    const { client, updates } = fakeClient([
      { id: 'scn-1', summary: 'Typed once, regretted immediately' },
    ])

    await executeRevert(
      client,
      revertEntry('update_scenario_spec', { scenario_id: 'scn-1', summary: '' }),
    )

    expect(updates[0]?.patch).toEqual({ summary: null })
  })

  it('clears a step summary back to nothing', async () => {
    const { client, updates } = fakeClient([
      { id: 'step-1', summary: 'What this moment is' },
    ])

    await executeRevert(
      client,
      revertEntry('update_step_spec', { step_id: 'step-1', summary: '' }),
    )

    expect(updates[0]?.patch).toEqual({ summary: null })
  })

  it('still refuses a summary that is missing rather than empty', async () => {
    const { client } = fakeClient([{ id: 'svc-1', summary: 'x' }])

    await expect(
      executeRevert(client, revertEntry('update_service_summary', { service_id: 'svc-1' })),
    ).rejects.toThrow(/missing its .summary. value/)
  })
})

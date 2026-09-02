import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it } from 'vitest'

import { clearSession, recordChange, sessionSnapshot } from '@/lib/authoringSession'
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

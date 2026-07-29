import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Optimistic-concurrency token: the VERBATIM `updated_at` string PostgREST
 * returned for the row. Never pass it through `Date` — one round trip
 * truncates microseconds and every save becomes a phantom conflict.
 */
export type UpdatedAtToken = string

type Tables = Database['public']['Tables']
export type MutableTableName = keyof Tables

export type ConcurrencyOutcome<Row> =
  | { conflict: false; row: Row }
  | {
      /** Someone changed or removed the row since we read it. */
      conflict: true
      /** Fresh row for merge/reload; null = the row is gone (deleted). */
      current: Row | null
    }

/** Structural view of the query builder — keeps the generic table name out
 * of supabase-js's conditional types (they do not resolve for generic T). */
type RowFilterBuilder = {
  update: (values: Record<string, unknown>) => {
    eq: (
      column: string,
      value: string,
    ) => {
      eq: (
        column: string,
        value: string,
      ) => {
        select: () => PromiseLike<{
          data: unknown[] | null
          error: { message: string } | null
        }>
      }
    }
  }
  select: (columns: string) => {
    eq: (
      column: string,
      value: string,
    ) => {
      maybeSingle: () => PromiseLike<{
        data: unknown | null
        error: { message: string } | null
      }>
    }
  }
}

/**
 * Update one row iff its `updated_at` still matches `lastUpdatedAt`.
 *
 * The three hard rules encoded here:
 * 1. The conflict branch is `data.length === 0` — PostgREST answers a
 *    zero-row match with 200 + empty array, NOT an error.
 * 2. `lastUpdatedAt` is the verbatim string from the row (see
 *    {@link UpdatedAtToken}).
 * 3. `updated_at` is trigger-maintained — never include it in `patch`.
 *
 * On conflict the row is refetched so the caller can branch: `current`
 * present → toast + merge/reload; `current` null → the row was deleted
 * (tombstone / close the view).
 */
export async function updateWithConcurrency<T extends MutableTableName>(
  client: SupabaseClient<Database>,
  table: T,
  id: string,
  patch: Tables[T]['Update'],
  lastUpdatedAt: UpdatedAtToken,
  /** Primary-key column; `propositions` keys on `service_lifecycle_id`. */
  idColumn: string = 'id',
): Promise<ConcurrencyOutcome<Tables[T]['Row']>> {
  const builder = client.from(table) as unknown as RowFilterBuilder

  const { data, error } = await builder
    .update(patch as Record<string, unknown>)
    .eq(idColumn, id)
    .eq('updated_at', lastUpdatedAt)
    .select()
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Tables[T]['Row'][]
  if (rows.length > 0) {
    return { conflict: false, row: rows[0] }
  }

  // Zero rows matched — changed, deleted, or RLS-hidden. Refetch and branch.
  const refetch = client.from(table) as unknown as RowFilterBuilder
  const { data: current, error: refetchError } = await refetch
    .select('*')
    .eq(idColumn, id)
    .maybeSingle()
  if (refetchError) throw new Error(refetchError.message)

  return {
    conflict: true,
    current: (current ?? null) as Tables[T]['Row'] | null,
  }
}

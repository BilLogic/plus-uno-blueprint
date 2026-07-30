/**
 * Last-write-wins protection for the rows two people can edit at once.
 *
 * Three sharp edges live here rather than in every call site, because each
 * one fails silently rather than loudly:
 *
 * 1. **PostgREST returns 200 with an empty array when zero rows match.** The
 *    conflict branch is therefore `data.length === 0`, never `error !== null`.
 *    Checking `error` alone reports every conflict as a success.
 * 2. **The token must be the verbatim string PostgREST returned.** One pass
 *    through `Date` truncates microseconds, so `.eq('updated_at', token)`
 *    matches nothing and every save becomes a phantom conflict. Hence the
 *    opaque string type — it is never parsed, formatted, or compared as a
 *    date.
 * 3. **`updated_at` is trigger-maintained.** Clients never set it; a client
 *    that writes its own value defeats the whole mechanism.
 */

/**
 * A row's `updated_at` exactly as the server sent it. Opaque on purpose:
 * parse it and the guard stops working.
 */
export type UpdatedAtToken = string & { readonly __brand: 'UpdatedAtToken' }

export function asUpdatedAtToken(value: string): UpdatedAtToken {
  return value as UpdatedAtToken
}

/**
 * What an empty result means. It is genuinely ambiguous — the row may have
 * been changed by someone else, deleted, or hidden from this session by RLS —
 * so the caller refetches to find out which.
 */
export type WriteOutcome<T> =
  | { status: 'ok'; row: T }
  | { status: 'conflict' }

export class ConflictError extends Error {
  constructor(message = 'Someone else changed this first.') {
    super(message)
    this.name = 'ConflictError'
  }
}

/**
 * Interprets a guarded update's response.
 *
 * Call with the result of an `.update(...).eq('updated_at', token).select()`
 * — the `.select()` matters: without it there are no rows to count and the
 * conflict is invisible.
 */
export function readWriteOutcome<T>(
  data: T[] | null,
  error: { message: string } | null,
): WriteOutcome<T> {
  if (error) throw new Error(error.message)
  const rows = data ?? []
  if (rows.length === 0) return { status: 'conflict' }
  return { status: 'ok', row: rows[0] }
}

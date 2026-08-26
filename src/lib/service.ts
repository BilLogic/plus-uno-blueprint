import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>

/**
 * Shared first-service lookup — the settled result is cached module-level
 * and concurrent callers share one in-flight query, so the `useSlices` /
 * `useServicePhases` / evidence-insert chains do not each hit
 * `services`. Errors are not cached; the next caller retries.
 *
 * Deliberately takes no abort signal: the promise is shared, so one caller
 * leaving its view would cancel the lookup every other caller is awaiting.
 */
let firstServiceId: Promise<string | null> | null = null

/** First service by `created_at`, or null when the database has none. */
export function findFirstServiceId(client: Client): Promise<string | null> {
  if (!firstServiceId) {
    firstServiceId = (async () => {
      const { data, error } = await client
        .from('services')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1)
      if (error) throw new Error(error.message)
      return data?.[0]?.id ?? null
    })().catch((error: unknown) => {
      firstServiceId = null
      throw error
    })
  }
  return firstServiceId
}

/** First service by `created_at`; throws when the database has none. */
export async function resolveFirstServiceId(client: Client): Promise<string> {
  const id = await findFirstServiceId(client)
  if (!id) throw new Error('No service exists in the database')
  return id
}

/**
 * Await a shared lookup without inheriting its uncancellability.
 *
 * `findFirstServiceId` deliberately takes no signal — the promise is shared,
 * so one caller leaving its view would cancel the lookup every other caller is
 * awaiting. That is right for the *lookup* and wrong for the *wait*: inside
 * `withSupabaseTimeout` the deadline aborts a controller the shared request
 * never sees, so the read that was supposed to be bounded sat in `loading`
 * until the network answered.
 *
 * This settles the caller's wait when the signal fires and leaves the shared
 * request running for whoever else is waiting on it.
 */
export function awaitOrAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason ?? new Error('aborted'))
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new Error('aborted'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error as Error)
      },
    )
  })
}

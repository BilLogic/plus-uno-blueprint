import { useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { raceSupabaseQuery } from '@/lib/supabaseFetchTimeout'
import type { Database } from '@/types/database'

export type QueryResult<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T; source: 'database' | 'fallback' }
  | { status: 'error'; message: string; fallback: T | null }

type SettledQueryResult<T> = Exclude<QueryResult<T>, { status: 'loading' }>

const LOADING_RESULT = { status: 'loading' } as const

const NOT_CONFIGURED_MESSAGE = 'Supabase is not configured'

type CacheEntry = {
  promise: Promise<unknown>
  /** Present once the fetch resolved successfully. */
  settled?: { data: unknown }
}

/**
 * Cross-mount query cache. In-flight promises dedupe concurrent mounts of
 * the same key; settled values serve later mounts synchronously, so tab
 * switches never refetch. Revalidation is explicit: either the key changes
 * (reload tokens baked into keys, e.g. `useEvidence`) or a mutation calls
 * {@link invalidateQueries}. Failures and timeouts are never cached — the
 * next mount retries.
 */
const queryCache = new Map<string, CacheEntry>()

type InvalidationListener = (prefix: string) => void
const invalidationListeners = new Set<InvalidationListener>()

/**
 * Drop every cached query whose key starts with `prefix` and notify mounted
 * hooks so they refetch (e.g. `invalidateQueries('slices')` after deleting a
 * slice). Mounted hooks keep serving their last settled value while the
 * refetch is in flight (stale-while-revalidate).
 */
export function invalidateQueries(prefix: string): void {
  for (const key of [...queryCache.keys()]) {
    if (key.startsWith(prefix)) queryCache.delete(key)
  }
  for (const listener of invalidationListeners) listener(prefix)
}

function startQuery<T>(
  key: string,
  client: SupabaseClient<Database>,
  fetcher: (client: SupabaseClient<Database>) => PromiseLike<T>,
): Promise<unknown> {
  const entry: CacheEntry = {
    // The async wrapper turns a synchronous fetcher throw into a rejection
    // (surfaced as the error state) instead of an unhandled exception.
    promise: raceSupabaseQuery((async () => fetcher(client))()).then(
      (outcome) => {
        if (outcome === 'timeout') {
          if (queryCache.get(key) === entry) queryCache.delete(key)
          throw new Error('The request timed out')
        }
        if (queryCache.get(key) === entry) entry.settled = { data: outcome }
        return outcome as unknown
      },
      (error: unknown) => {
        if (queryCache.get(key) === entry) queryCache.delete(key)
        throw error
      },
    ),
  }
  queryCache.set(key, entry)
  return entry.promise
}

/**
 * One shared query state machine for read hooks (thin hooks like `useSlices`
 * wrap it). `key` identifies the request: results are cached module-level by
 * key (shared across mounts), the fetcher re-runs when the key changes, and
 * stale responses are dropped. Pass `key: null` to gate the query — nothing
 * runs and the result stays `loading` (e.g. while a parent query resolves).
 * `fetcher` is read through a ref, so inline closures are fine — it is
 * re-evaluated per key, not per identity. `fallback` must be referentially
 * stable (wrap it in `useCallback`): the no-DB result is memoized on its
 * identity.
 *
 * No-DB mode (client null) resolves synchronously from `fallback()`:
 * `ready`/`'fallback'` when it returns data, `error` when it returns null.
 * Database errors and timeouts surface as `error` with `fallback` populated.
 */
export function useSupabaseQuery<T>(
  key: string | null,
  fetcher: (client: SupabaseClient<Database>) => PromiseLike<T>,
  fallback: () => T | null,
): QueryResult<T> {
  const { client, configured } = useSupabase()
  const fetcherRef = useRef(fetcher)
  const fallbackRef = useRef(fallback)

  useEffect(() => {
    fetcherRef.current = fetcher
    fallbackRef.current = fallback
  })

  const [settled, setSettled] = useState<{
    key: string
    result: SettledQueryResult<T>
  } | null>(null)

  // Bumped when an invalidation matches this key — re-runs the fetch effect.
  const [epoch, setEpoch] = useState(0)

  const noDb = !configured || !client

  // No-DB mode resolves synchronously; memoized so callers get a stable
  // result object as long as their fallback is stable.
  const noDbResult = useMemo<SettledQueryResult<T> | null>(() => {
    if (!noDb || key === null) return null
    const data = fallback()
    return data !== null
      ? { status: 'ready', data, source: 'fallback' }
      : { status: 'error', message: NOT_CONFIGURED_MESSAGE, fallback: null }
  }, [noDb, key, fallback])

  // First-paint cache hit: serve an already-settled value synchronously so a
  // remount (tab switch) never flashes a loading state.
  const cachedResult = useMemo<SettledQueryResult<T> | null>(() => {
    if (noDb || key === null) return null
    const entry = queryCache.get(key)
    return entry?.settled
      ? { status: 'ready', data: entry.settled.data as T, source: 'database' }
      : null
    // epoch: recompute after an invalidation cleared the entry.
  }, [noDb, key, epoch])

  useEffect(() => {
    if (key === null) return
    const listener: InvalidationListener = (prefix) => {
      if (key.startsWith(prefix)) setEpoch((value) => value + 1)
    }
    invalidationListeners.add(listener)
    return () => {
      invalidationListeners.delete(listener)
    }
  }, [key])

  useEffect(() => {
    if (key === null || !configured || !client) return

    let cancelled = false
    const entry = queryCache.get(key)
    const promise =
      entry?.promise ?? startQuery(key, client, fetcherRef.current)

    promise.then(
      (data) => {
        if (cancelled) return
        setSettled({
          key,
          result: { status: 'ready', data: data as T, source: 'database' },
        })
      },
      (error: unknown) => {
        if (cancelled) return
        setSettled({
          key,
          result: {
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
            fallback: fallbackRef.current(),
          },
        })
      },
    )

    return () => {
      cancelled = true
    }
  }, [client, configured, key, epoch])

  if (key === null) return LOADING_RESULT
  if (noDbResult) return noDbResult

  // `settled` wins over the cache memo: after an invalidation it keeps
  // serving the previous value while the refetch is in flight.
  if (settled && settled.key === key) return settled.result
  if (cachedResult) return cachedResult
  return LOADING_RESULT
}

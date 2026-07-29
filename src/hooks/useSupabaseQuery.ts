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

/**
 * One shared query state machine for read hooks (thin hooks like `useSlices`
 * wrap it). `key` identifies the request: the fetcher re-runs when it changes
 * and stale responses are dropped. `fetcher` is read through a ref, so inline
 * closures are fine — it is re-evaluated per `key`, not per identity.
 * `fallback` must be referentially stable (wrap it in `useCallback`): the
 * no-DB result is memoized on its identity.
 *
 * No-DB mode (client null) resolves synchronously from `fallback()`:
 * `ready`/`'fallback'` when it returns data, `error` when it returns null.
 * Database errors and timeouts surface as `error` with `fallback` populated.
 */
export function useSupabaseQuery<T>(
  key: string,
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

  const noDb = !configured || !client

  // No-DB mode resolves synchronously; memoized so callers get a stable
  // result object as long as their fallback is stable.
  const noDbResult = useMemo<SettledQueryResult<T> | null>(() => {
    if (!noDb) return null
    const data = fallback()
    return data !== null
      ? { status: 'ready', data, source: 'fallback' }
      : { status: 'error', message: NOT_CONFIGURED_MESSAGE, fallback: null }
  }, [noDb, fallback])

  useEffect(() => {
    if (!configured || !client) return

    let cancelled = false

    const fail = (message: string) => {
      setSettled({
        key,
        result: { status: 'error', message, fallback: fallbackRef.current() },
      })
    }

    void raceSupabaseQuery(Promise.resolve(fetcherRef.current(client))).then(
      (outcome) => {
        if (cancelled) return
        if (outcome === 'timeout') {
          fail('The request timed out')
          return
        }
        setSettled({
          key,
          result: { status: 'ready', data: outcome, source: 'database' },
        })
      },
      (error: unknown) => {
        if (cancelled) return
        fail(error instanceof Error ? error.message : String(error))
      },
    )

    return () => {
      cancelled = true
    }
  }, [client, configured, key])

  if (noDbResult) return noDbResult

  if (settled && settled.key === key) return settled.result
  return LOADING_RESULT
}

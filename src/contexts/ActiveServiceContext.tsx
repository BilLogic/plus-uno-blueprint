import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import {
  getActiveServiceSlug,
  setActiveServiceSlug,
  useActiveServiceSlug,
} from '@/contexts/activeServiceStore'
import { resolveServiceBySlug, serviceSlug } from '@/lib/serviceSlug'

/**
 * The active service — the one the URL slug names — resolved to its id and
 * name, threaded the way the path selection is: a provider mounted high in the
 * tree, read through a hook.
 *
 * The slug itself lives in a module store (`activeServiceStore`, ADR 0005),
 * because non-React resolvers read it; this provider is the React-side
 * resolution of slug -> service and the one place that CANONICALIZES the URL:
 * once the service is known, its own slug is written to the path, so a
 * single-service deployment that booted at the bare root ends with its slug in
 * the address bar, and a reload lands on the same service.
 *
 * Journey reads do not consume this context — they resolve the id inside their
 * fetchers via `lib/service.ts` so their two reads still go out in the same
 * tick. This context is for surfaces that need the service's identity (the
 * cover, a future switcher) and for the canonicalization effect below.
 */

export type ActiveService = { id: string; name: string; slug: string }

type ActiveServiceContextValue = {
  /** The resolved active service, or `null` while loading / when none matches. */
  service: ActiveService | null
  /** The slug currently in the URL (may trail the resolved slug for a frame). */
  slug: string | null
  loading: boolean
}

const ActiveServiceContext = createContext<ActiveServiceContextValue>({
  service: null,
  slug: null,
  loading: true,
})

export function ActiveServiceProvider({ children }: { children: ReactNode }) {
  // Subscribe so the context value tracks the slug the store holds.
  const routeSlug = useActiveServiceSlug()
  const fallback = useCallback(() => null, [])

  const result = useSupabaseQuery<ActiveService | null>(
    // One active service per page load (no switcher yet), so the key is
    // constant; the fetcher reads the current slug from the store.
    'active-service',
    async (client, signal) => {
      const { data, error } = await client
        .from('services')
        .select('id, name, slug')
        .order('created_at')
        .abortSignal(signal)
      if (error) throw new Error(error.message)

      const services = data ?? []
      const slug = getActiveServiceSlug()
      const picked = slug
        ? resolveServiceBySlug(services, slug)
        : (services[0] ?? null)
      return picked
        ? { id: picked.id, name: picked.name, slug: serviceSlug(picked) }
        : null
    },
    fallback,
  )

  const service = result.status === 'ready' ? result.data : null

  // Canonicalize: write the resolved service's own slug into the URL. This is
  // what puts the single service's slug in the address bar and keeps a reload
  // on the same service. No-ops once the URL already carries the canonical slug.
  useEffect(() => {
    if (!service) return
    if (getActiveServiceSlug() !== service.slug) setActiveServiceSlug(service.slug)
  }, [service])

  const value = useMemo<ActiveServiceContextValue>(
    () => ({ service, slug: routeSlug, loading: result.status === 'loading' }),
    [service, routeSlug, result.status],
  )

  return (
    <ActiveServiceContext.Provider value={value}>
      {children}
    </ActiveServiceContext.Provider>
  )
}

/** The active service and the slug in the URL. `null` service until resolved. */
export function useActiveService(): ActiveServiceContextValue {
  return useContext(ActiveServiceContext)
}

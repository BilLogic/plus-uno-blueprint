import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import {
  createSupabaseClient,
  devLoginCredentials,
  hasDevAuthoringKey,
  hasDevAuthoringUi,
  isSupabaseConfigured,
} from '../lib/supabase'
import type { Database } from '../types/database'

type SupabaseContextValue = {
  client: SupabaseClient<Database> | null
  configured: boolean
  session: Session | null
  isLoading: boolean
  /**
   * Visibility hint for mutation UI (hidden — never disabled — when false).
   * RLS is the authority; this only reflects whether this session has any
   * chance of a write succeeding: a signed-in user, or a dev server holding
   * the local authoring key. A deployed visitor is neither.
   */
  canWrite: boolean
  /** Writing with the local authoring key rather than as a signed-in user. */
  isDevAuthoring: boolean
  /**
   * Showing the authoring UI on a dev server that cannot actually write.
   * Distinct from `isDevAuthoring`, and the two must never share a badge: one
   * means "your writes reach the live database", the other means "they will
   * not". Getting those the wrong way round is the expensive mistake.
   */
  isEditPreview: boolean
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null)

type SupabaseProviderProps = {
  children: ReactNode
}

export function SupabaseProvider({ children }: SupabaseProviderProps) {
  const configured = isSupabaseConfigured()
  const client = useMemo(() => createSupabaseClient(), [])
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(configured)

  useEffect(() => {
    if (!client) {
      setIsLoading(false)
      return
    }

    let mounted = true

    client.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [client])

  /*
    Dev sign-in. A real session through the front door: `signInWithPassword`
    against a dev account, so RLS sees `authenticated` exactly as it would
    for any user. This is the sanctioned alternative to the service key —
    the key bypasses policy; this obeys it.

    Runs once per boot, only in DEV, only when the pair is configured, and
    only when no session already exists (a persisted session from the last
    boot wins). Failure downgrades to read-only and logs — same behavior as
    having no credentials at all.
  */
  useEffect(() => {
    if (!client || isLoading || session) return
    const credentials = devLoginCredentials()
    if (!credentials) return
    let cancelled = false
    void client.auth
      .signInWithPassword(credentials)
      .then(({ error }) => {
        if (!cancelled && error) {
          console.error('[dev-login] sign-in failed:', error.message)
        }
      })
    return () => {
      cancelled = true
    }
  }, [client, isLoading, session])

  const isDevAuthoring = hasDevAuthoringKey()
  // Only ever true on a dev server, and never while anything can actually
  // write — a session that saves for real is not a preview of one, and the
  // "nothing saves" chip lying over working saves would be worse than either
  // state alone.
  const isEditPreview =
    hasDevAuthoringUi() && !isDevAuthoring && session === null

  const value = useMemo(
    () => ({
      client,
      configured,
      session,
      isLoading,
      canWrite:
        configured && (session !== null || isDevAuthoring || isEditPreview),
      isDevAuthoring,
      isEditPreview,
    }),
    [client, configured, session, isLoading, isDevAuthoring, isEditPreview],
  )

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  )
}

export function useSupabase(): SupabaseContextValue {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useSupabase must be used within SupabaseProvider')
  }
  return context
}

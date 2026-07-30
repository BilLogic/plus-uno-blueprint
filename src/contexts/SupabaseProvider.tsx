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
  hasDevAuthoringKey,
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

  const isDevAuthoring = hasDevAuthoringKey()

  const value = useMemo(
    () => ({
      client,
      configured,
      session,
      isLoading,
      canWrite: configured && (session !== null || isDevAuthoring),
      isDevAuthoring,
    }),
    [client, configured, session, isLoading, isDevAuthoring],
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

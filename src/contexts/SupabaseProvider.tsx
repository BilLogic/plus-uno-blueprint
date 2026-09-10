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
import {
  setAuthoringLogWriter,
  supabaseAuthoringLogWriter,
} from '../lib/authoringLog'
import { sessionRefresher, setSessionReconciler } from '../lib/sessionReconcile'
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
  /** Any signed-in session may open the agent (viewers chat read-only). */
  canAgent: boolean
  /**
   * Whether a read from this client may name a table outside the contract's
   * `publicReadTables`.
   *
   * `anon` holds no SELECT on `business_models` — the service's commercial
   * spec — and PostgREST refuses the WHOLE select when one names it, so every
   * signed-out visitor saw `permission denied for table business_models` above
   * the board (#442). A read that wants such a table has to ask this first and
   * do without when the answer is no.
   *
   * Distinct from `canWrite`, which is about the service tier, and from
   * `canAgent`, which happens to share this predicate today for an unrelated
   * reason. Reads reach the database as `authenticated` for any signed-in
   * session — the tier gates writing, not reading — and as `service_role` on a
   * dev server holding the authoring key, which is wider still.
   */
  canReadPrivate: boolean
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null)

type SupabaseProviderProps = {
  children: ReactNode
}

/*
 * Module singleton, not useMemo: StrictMode's double render re-runs memo
 * initializers, and two GoTrueClients on one storage key is undefined
 * behavior (and a console warning on every load). One client per page is
 * the actual contract — same reasoning as lib/queryClient.ts.
 */
const sharedClient = createSupabaseClient()

/*
 * The durable change log's writer (#176), installed here for the same reason
 * the client is a module singleton: `recordChange` is a plain function with no
 * component and no client around it, and there is exactly one client per page.
 * Null in no-DB mode, where the append is simply not attempted and the
 * in-memory change list still works.
 */
setAuthoringLogWriter(
  sharedClient ? supabaseAuthoringLogWriter(sharedClient) : null,
)

export function SupabaseProvider({ children }: SupabaseProviderProps) {
  const configured = isSupabaseConfigured()
  const client = sharedClient
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(configured)

  useEffect(() => {
    if (!client) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot resolution of the initial loading gate when Supabase is unconfigured; the async auth sync below is the real work
      setIsLoading(false)
      return
    }

    let mounted = true

    client.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setIsLoading(false)
      // Roles live in the JWT, which is minted at sign-in — a session that
      // predates a role change carries stale claims until refresh. One
      // refresh per boot keeps app_metadata.role current for long-lived
      // sessions (onAuthStateChange delivers the updated session).
      if (data.session) void client.auth.refreshSession()
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

  /*
    Reconcile the tier when the database says the tier is wrong.

    `canWrite` below reads the LOCAL session's app_metadata. That is refreshed
    on every token refresh, so a server-side demotion reaches the UI within one
    token lifetime by itself — but until then the reader is offered editing
    affordances the database will refuse. A refused write is the one reliable
    signal that the local copy is stale, so `toAuthoringError` reports it here
    and this refreshes, which lands a newly-minted JWT through
    `onAuthStateChange` above and re-derives everything below (#136).
  */
  useEffect(() => {
    if (!client) return
    // `sessionRefresher`, not an inline `await refreshSession()`: that call
    // resolves on failure, and the reason is written where the function is.
    setSessionReconciler(sessionRefresher(client))
    return () => setSessionReconciler(null)
  }, [client])

  const isDevAuthoring = hasDevAuthoringKey()
  // Only ever true on a dev server, and never while anything can actually
  // write — a session that saves for real is not a preview of one, and the
  // "nothing saves" banner lying over working saves would be worse than either
  // state alone.
  const isEditPreview =
    hasDevAuthoringUi() && !isDevAuthoring && session === null

  /*
   * The service-account tier, ASKED rather than inferred.
   *
   * The seam is a database function — `is_service_account()` — that every
   * write RPC asserts in its own body and every restrictive write policy
   * ANDs with. Reading `app_metadata.role` instead was a guess at what that
   * function would answer, and the two can disagree: a role stamped after
   * this token was minted, or a deployment whose function reads something
   * other than the claim, and the gate says one thing while the database
   * does another.
   *
   * The ask is keyed on the ACCESS TOKEN, because the answer is computed
   * server-side from the token this client presents. It is HELD against the
   * user id, so the boot refresh — a new token for the same account, seconds
   * in — updates the answer without blanking it. A refresh is not a tier
   * change, and flickering the editing UI for one would be a lie told twice.
   *
   * A failed ask answers `false`. The alternative is a gate that opens on a
   * network error, and the wall behind it (the restrictive policies and the
   * RPC guards) would refuse the write anyway — so the honest failure is a
   * board that does not offer to save.
   *
   * UX gate only. The policies are the wall.
   */
  const userId = session?.user.id ?? null
  const accessToken = session?.access_token ?? null
  const [tierAnswer, setTierAnswer] = useState<{
    userId: string
    isService: boolean
  } | null>(null)

  useEffect(() => {
    if (!client || userId === null || accessToken === null) return
    let cancelled = false
    void client
      .rpc('is_service_account')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('[tier] is_service_account failed:', error.message)
        }
        setTierAnswer({ userId, isService: !error && data === true })
      })
    return () => {
      cancelled = true
    }
  }, [client, userId, accessToken])

  // An answer belongs to the account it was asked about, so signing out — or
  // signing in as somebody else — retires it without waiting for a round trip.
  const answeredIsService =
    tierAnswer?.userId === userId ? tierAnswer.isService : null

  /*
   * Local, not published on the context: `canWrite` below is the only
   * question a surface should be asking, and an exported second flag that
   * says almost-but-not-quite the same thing is an invitation to gate on
   * the wrong one.
   */
  const isServiceAccount = answeredIsService === true || isDevAuthoring

  /*
   * Boot is not over until the tier is known. A signed-in session pays one
   * round trip for it; a visitor with no session pays none, having nothing to
   * ask about. The alternative is to render an answer and then correct it,
   * which shows an editor a read-only board or a viewer a save button.
   */
  const tierPending = userId !== null && answeredIsService === null

  const value = useMemo(
    () => ({
      client,
      configured,
      session,
      isLoading: isLoading || tierPending,
      canWrite:
        configured &&
        ((session !== null && isServiceAccount) ||
          isDevAuthoring ||
          isEditPreview),
      isDevAuthoring,
      isEditPreview,
      canAgent: configured && (session !== null || isDevAuthoring),
      canReadPrivate: configured && (session !== null || isDevAuthoring),
    }),
    [
      client,
      configured,
      session,
      isLoading,
      tierPending,
      isDevAuthoring,
      isEditPreview,
      isServiceAccount,
    ],
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

/**
 * Bringing the UI's idea of what it may write back in line with the database's.
 *
 * The tier a surface gates on comes from the local session's
 * `app_metadata.role`. That is re-derived whenever the access token refreshes
 * — `autoRefreshToken` is on and `SupabaseProvider` subscribes to
 * `onAuthStateChange` — so a server-side demotion reaches the UI within one
 * token lifetime on its own. The gap is the window before that refresh, where
 * the reader is still offered editing affordances the database will refuse.
 *
 * This is a UI defect and not an authorization hole: RLS re-evaluates
 * `auth.jwt()` on every statement, so the write fails at the database rather
 * than succeeding. The symptom is a button that lies (#136).
 *
 * So: reconcile at the exact moment the lie is exposed. A write that comes back
 * denied is the one reliable signal that the local tier is stale, and it costs
 * nothing on the happy path — no timer, no polling, no round-trip until
 * something has already gone wrong.
 *
 * A REGISTRATION SEAM rather than a direct import, because the client lives in
 * `SupabaseProvider` and `src/lib/` must not reach up into `src/contexts/`.
 */

/** Set by `SupabaseProvider` while a client exists. */
let reconciler: (() => Promise<void>) | null = null

/** Guards against a burst of denials queueing a refresh each. */
let inFlight = false

/**
 * How long after a reconcile before another denial may trigger one.
 *
 * A save that fans out to several tables can produce several denials from one
 * gesture, and a refresh per row would be a self-inflicted request storm
 * against the auth endpoint. One refresh answers all of them: they were all
 * refused by the same token.
 */
const COOLDOWN_MS = 10_000

let lastRunAt = 0

/**
 * Register how to reconcile. Pass `null` to unregister.
 *
 * Idempotent by construction: the last registration wins, so a re-render that
 * registers again cannot stack handlers.
 */
export function setSessionReconciler(
  fn: (() => Promise<void>) | null,
): void {
  reconciler = fn
}

/**
 * A write was refused on authorization grounds — re-derive the tier.
 *
 * Deliberately fire-and-forget. The caller is a translation function on an
 * error path; it must not become async, must not throw, and must not make the
 * user wait for an auth round-trip to see the message explaining what failed.
 *
 * `now` is injectable so the cooldown is testable without a clock.
 */
export function reconcileSessionAfterDenial(now: number = Date.now()): void {
  if (!reconciler || inFlight) return
  if (now - lastRunAt < COOLDOWN_MS) return

  inFlight = true
  lastRunAt = now
  void reconciler()
    .catch((error: unknown) => {
      // A refresh that fails is not worth surfacing: the write already failed
      // and the reader is being shown that. Signing them out here would turn
      // one refused save into a lost session.
      console.error('[session] reconcile after denial failed:', error)
    })
    .finally(() => {
      inFlight = false
    })
}

/** Test seam — no caller in the app. */
export function resetSessionReconcileState(): void {
  reconciler = null
  inFlight = false
  lastRunAt = 0
}

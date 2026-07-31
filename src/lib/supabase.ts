import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const PLACEHOLDER_KEY = 'your-anon-key'
const PLACEHOLDER_URL_FRAGMENT = 'YOUR_PROJECT'

export function isSupabaseConfigured(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) return false
  if (supabaseAnonKey === PLACEHOLDER_KEY) return false
  if (supabaseUrl.includes(PLACEHOLDER_URL_FRAGMENT)) return false
  return true
}

/**
 * Local authoring key, dev server only.
 *
 * The deployed app is read-only by design: every write policy is `to
 * authenticated`, there is no sign-in, so a browser visitor cannot write.
 * Authoring is for people who already hold this project's database
 * credentials — us — working against `npm run dev`.
 *
 * Three guards, because a service key in a browser bundle is full database
 * access to anyone who loads the page:
 *
 * 1. `import.meta.env.DEV` — a production build takes the anon path even if
 *    the variable is somehow present at build time.
 * 2. The variable lives in `.env.local`, which `.gitignore` covers via
 *    `.env.*`. It must never be set in Netlify's environment.
 * 3. The provider surfaces a visible badge while it is in use, so nobody
 *    edits the live database believing they are a viewer.
 */
const devAuthoringKey = import.meta.env.DEV
  ? import.meta.env.VITE_SUPABASE_DEV_SERVICE_KEY
  : undefined

/** True when this session can write — dev server, with the authoring key set. */
export function hasDevAuthoringKey(): boolean {
  return Boolean(import.meta.env.DEV && devAuthoringKey)
}

/**
 * Show the authoring UI on the dev server *without* an authoring key.
 *
 * Grants nothing. RLS and the function grants are the authority and neither of
 * them reads this flag — holding only the anon key, a write still comes back
 * `permission denied for function upsert_cell`, which is the revoke working.
 *
 * It exists because the Edit surfaces became invisible to their own designer:
 * hiding them when `canWrite` is false is right for a deployed visitor and
 * wrong for someone building them, and the alternative — pasting a
 * service-role key into a bundle to look at a toolbar — is a far worse trade.
 * A flag that over-promises costs one clear error message; a key in a bundle
 * costs the database.
 */
const devAuthoringUi = import.meta.env.DEV
  ? import.meta.env.VITE_DEV_AUTHORING_UI
  : undefined

export function hasDevAuthoringUi(): boolean {
  return Boolean(import.meta.env.DEV && devAuthoringUi === 'true')
}

export function createSupabaseClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) {
    return null
  }

  const key = hasDevAuthoringKey() ? devAuthoringKey! : supabaseAnonKey

  return createClient<Database>(supabaseUrl, key, {
    auth: {
      // A service key must not be persisted or refreshed as if it were a
      // user session — it is not one, and storing it widens where it lands.
      persistSession: !hasDevAuthoringKey(),
      autoRefreshToken: !hasDevAuthoringKey(),
    },
  })
}

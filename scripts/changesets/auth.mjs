import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'

export function authoringCredentials(root) {
  const localPath = resolve(root, '.env.local')
  if (!existsSync(localPath)) throw new Error('Dev authoring requires this worktree’s gitignored .env.local')
  const local = parseEnv(readFileSync(localPath, 'utf8'))
  const shared = existsSync(resolve(root, '.env')) ? parseEnv(readFileSync(resolve(root, '.env'), 'utf8')) : {}
  const url = local.VITE_SUPABASE_URL ?? shared.VITE_SUPABASE_URL
  const key = local.VITE_SUPABASE_ANON_KEY ?? shared.VITE_SUPABASE_ANON_KEY
  const email = local.VITE_SUPABASE_DEV_EMAIL
  const password = local.VITE_SUPABASE_DEV_PASSWORD
  if (!url || !key || !email || !password)
    throw new Error('Configure VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_DEV_EMAIL and VITE_SUPABASE_DEV_PASSWORD in .env.local')
  if (key.startsWith('sb_secret_')) throw new Error('Secret/service-role keys are forbidden')
  if (!key.startsWith('sb_publishable_')) {
    let claims
    try { claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()) } catch { /* Refuse below. */ }
    if (claims?.role !== 'anon') throw new Error('The API key must be publishable or anon; service-role keys are forbidden')
  }
  return { url, key, email, password }
}

export async function devSignIn(client, credentials) {
  const { data, error } = await client.auth.signInWithPassword({ email: credentials.email, password: credentials.password })
  if (error) throw new Error(`Dev sign-in failed: ${error.message}`)
  const role = data.user?.app_metadata?.role
  const claims = JSON.parse(Buffer.from(data.session?.access_token?.split('.')[1] ?? '', 'base64url').toString())
  if (role !== 'service' || claims.role !== 'authenticated')
    throw new Error('This runner requires the authenticated dev authoring user; rpc_writer and service_role are forbidden')
  return data.user.id
}

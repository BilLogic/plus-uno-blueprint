#!/usr/bin/env node
/**
 * Can this checkout write to the database?
 *
 * Exists because the failure it diagnoses is silent and expensive: authoring
 * is gated on a key in `.env.local`, and when it is missing — or is still the
 * placeholder from a copy-pasted command — every write is refused by the
 * database with a message that reads like an application bug. This answers
 * the question before anything is clicked.
 *
 * Never prints the key. Length and prefix only, which is enough to tell a
 * real JWT from a placeholder and useless to anyone reading a terminal
 * recording.
 *
 * Run: npm run authoring:check
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ENV_LOCAL = join(ROOT, '.env.local')

function readEnv(path) {
  if (!existsSync(path)) return {}
  const entries = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const at = trimmed.indexOf('=')
    if (at === -1) continue
    entries[trimmed.slice(0, at).trim()] = trimmed.slice(at + 1).trim()
  }
  return entries
}

/** Same rule the app uses — keep the two in step. */
function looksLikePlaceholder(key) {
  if (key.length < 20) return true
  if (key.startsWith('<') || key.endsWith('>')) return true
  return /^(your|paste|replace|todo)[-_]/i.test(key)
}

const env = readEnv(ENV_LOCAL)
const key = env.VITE_SUPABASE_DEV_SERVICE_KEY ?? ''
const previewUi = env.VITE_DEV_AUTHORING_UI === 'true'

if (!existsSync(ENV_LOCAL)) {
  console.log('✗ No .env.local. Authoring is off; the app opens read-only.')
} else if (!key) {
  console.log(
    previewUi
      ? '● Edit preview. The Edit UI is visible, and every write will be refused.'
      : '✗ No authoring key, and no VITE_DEV_AUTHORING_UI. Edit is hidden.',
  )
} else if (looksLikePlaceholder(key)) {
  console.log(
    `✗ VITE_SUPABASE_DEV_SERVICE_KEY is a placeholder (${key.length} chars, starts "${key.slice(0, 3)}…").`,
  )
  console.log('  The app ignores it, so reads still work — but nothing saves.')
} else {
  console.log(
    `✓ Authoring key present (${key.length} chars, starts "${key.slice(0, 6)}…"). Writes should work.`,
  )
}

if (key && looksLikePlaceholder(key)) {
  console.log('')
  console.log('  Open .env.local and replace the value with the real')
  console.log('  service_role key from Supabase → Project Settings → API,')
  console.log('  then restart the dev server. Do not wrap it in <angle brackets>.')
}

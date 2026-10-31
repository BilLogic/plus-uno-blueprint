#!/usr/bin/env node
import { readFileSync, existsSync, mkdirSync, writeFileSync, renameSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { runChangeset, validateChangeset } from './content-changeset.mjs'
import { createDatabase } from './changesets/database.mjs'
import { authoringCredentials, devSignIn } from './changesets/auth.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node scripts/run-content-changeset.mjs <changeset.json> --dry-run|--apply|--verify')
    console.log('Dev credentials: this worktree’s .env.local. Apply only after Bill comments approved on the ticket.')
    return
  }
  const mode = args[1]?.replace(/^--/, '')
  if (args.length !== 2 || !['dry-run', 'apply', 'verify'].includes(mode)) throw new Error('Use --help for usage; exactly one mode is required')
  const changeset = JSON.parse(readFileSync(resolve(args[0]), 'utf8'))
  validateChangeset(changeset)
  const credentials = authoringCredentials(root)
  const hash = createHash('sha256').update(JSON.stringify(changeset)).digest('hex')
  const receiptPath = resolve(root, '.changeset-receipts', `${changeset.issue}-${hash}.local`)
  const saved = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, 'utf8')) : null
  if (saved && mode === 'apply') throw new Error('A receipt exists for this batch; inspect partial writes and run --verify instead of reapplying')

  const { createClient } = await import('@supabase/supabase-js')
  const client = createClient(credentials.url, credentials.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  let server
  let database
  try {
    const userId = await devSignIn(client, credentials)
    console.log(`Issue #${changeset.issue}; mode=${mode}; changeset sha256=${hash}; authenticated user=${userId}`)
    if (saved && (saved.project !== credentials.url || saved.userId !== userId)) throw new Error('Receipt belongs to another project or authoring user')
    const { createServer } = await import('vite')
    server = await createServer({ root, server: { middlewareMode: true, watch: null }, appType: 'custom', logLevel: 'error' })
    const { modules } = await server.ssrLoadModule('/deployment/lib/contentChangesetModules.ts')
    database = createDatabase(client, modules)
    const persist = (applied, progress = {}) => {
      mkdirSync(dirname(receiptPath), { recursive: true })
      const temporary = `${receiptPath}.tmp`
      writeFileSync(temporary, JSON.stringify({ hash, project: credentials.url, userId, applied, ...progress }, null, 2) + '\n', { mode: 0o600 })
      renameSync(temporary, receiptPath)
    }
    const result = await runChangeset(changeset, mode, database, { receipt: saved?.applied ?? [], onProgress: persist })
    if (mode === 'verify' && !saved) {
      result.failures.push('No local apply receipt; durable log verification is unverified.')
    }
    if (mode === 'verify' && JSON.stringify(saved?.applied?.map((entry) => entry.key)) !== JSON.stringify(changeset.operations.map((op) => op.key))) {
      result.failures.push('Incomplete apply receipt: not every operation has a verified durable change.')
    }
    result.ok = result.failures.length === 0
    console.log(JSON.stringify(result, null, 2))
    if (mode === 'apply' && result.applied.length) persist(result.applied)
    if (!result.ok) process.exitCode = 1
  } finally {
    database?.close()
    await server?.close()
    await client.auth.signOut({ scope: 'local' })
  }
}

main().catch((error) => {
  console.error(`Changeset failed: ${error.message}`)
  process.exitCode = 1
})

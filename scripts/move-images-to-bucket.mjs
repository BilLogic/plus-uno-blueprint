#!/usr/bin/env node
/**
 * #278 — the shipped images move into the bucket.
 *
 * `public/blueprint-images` held 18 MB of one deployment's authored
 * screenshots, served by the site and named by site-relative paths in
 * `resources.url`, `cells.frame` and the fallback fixtures. Authored content
 * belongs in the bucket 20260902150000 made, under a URL that survives a
 * deploy of a different service.
 *
 * This script does the half a migration cannot: it puts the bytes in the
 * bucket. The paths are rewritten by 20260902180000, which derives every
 * object key the same way this does — so the two agree by construction,
 * not by a mapping file passed between them:
 *
 *   key = cells/<cell>/<md5(path) as a uuid>.<ext>
 *
 * where <cell> is the smallest cell id among the rows that name the path
 * (a file used by several cells lives under the first), and a file no row
 * names — the fallback fixtures' own frames — lives under the template's
 * shared shelf, the all-zero cell id the write policy's pattern admits.
 *
 * Uploads go through the AUTHORING SESSION (the dev sign-in), because the
 * bucket's write policy is `is_service_account()` and nothing else may
 * write it. `upsert: false`: a key that already exists is a file already
 * moved, and the script says so and moves on — running it twice is safe.
 *
 * Usage (from the repo root, with .env and .env.local loaded):
 *   node scripts/move-images-to-bucket.mjs            # plan only
 *   node scripts/move-images-to-bucket.mjs --upload   # put the files in
 *   node scripts/move-images-to-bucket.mjs --rewrite-src   # fixtures → bucket URLs
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
export const BUCKET = 'cell-attachments'
export const SHELF_CELL = '00000000-0000-4000-8000-000000000000'
const FOLDER = '/blueprint-images/'

/** md5 of the path, worn as a uuid — what `md5(path)::uuid` gives in Postgres. */
export function objectId(path) {
  const hex = createHash('md5').update(path).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function objectKey(path, cellId) {
  const ext = (path.match(/\.([A-Za-z0-9]+)$/)?.[1] ?? 'bin').toLowerCase()
  return `cells/${cellId}/${objectId(path)}.${ext}`
}

export function publicUrl(supabaseUrl, key) {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}/${key}`
}

/** The smallest cell id per path, over every row that names it. */
export function firstCellByPath(rows) {
  const first = new Map()
  for (const { path, cellId } of rows) {
    if (!path?.startsWith(FOLDER)) continue
    const have = first.get(path)
    if (!have || cellId < have) first.set(path, cellId)
  }
  return first
}

function filesUnder(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...filesUnder(full))
    else out.push(full)
  }
  return out
}

async function plan(client) {
  const [resources, cells] = await Promise.all([
    client.from('resources').select('cell_id, url').like('url', `${FOLDER}%`),
    client.from('cells').select('id, frame').like('frame', `${FOLDER}%`),
  ])
  if (resources.error) throw resources.error
  if (cells.error) throw cells.error
  const first = firstCellByPath([
    ...resources.data.map((row) => ({ path: row.url, cellId: row.cell_id })),
    ...cells.data.map((row) => ({ path: row.frame, cellId: row.id })),
  ])
  const onDisk = filesUnder(resolve(ROOT, 'public/blueprint-images')).map(
    (file) => `/${relative(resolve(ROOT, 'public'), file)}`,
  )
  return onDisk.map((path) => ({
    path,
    cellId: first.get(path) ?? SHELF_CELL,
    key: objectKey(path, first.get(path) ?? SHELF_CELL),
    namedByRows: first.has(path),
  }))
}

async function upload(client, entries) {
  const bucket = client.storage.from(BUCKET)
  let put = 0
  let kept = 0
  for (const entry of entries) {
    const bytes = readFileSync(resolve(ROOT, `public${entry.path}`))
    const type = entry.path.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
    const { error } = await bucket.upload(entry.key, bytes, { contentType: type, upsert: false })
    if (!error) put += 1
    else if (/already exists|Duplicate/i.test(error.message)) kept += 1
    else throw new Error(`${entry.path} → ${entry.key}: ${error.message}`)
  }
  return { put, kept }
}

/** The fallback fixtures name the same files; they get the same URLs. */
function rewriteSources(entries, supabaseUrl) {
  const byPath = new Map(entries.map((entry) => [entry.path, publicUrl(supabaseUrl, entry.key)]))
  const files = filesUnder(resolve(ROOT, 'src')).filter(
    (file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file),
  )
  let touched = 0
  for (const file of files) {
    const before = readFileSync(file, 'utf8')
    const after = before.replace(/'(\/blueprint-images\/[^']+)'/g, (whole, path) =>
      byPath.has(path) ? `'${byPath.get(path)}'` : whole,
    )
    if (after !== before) {
      writeFileSync(file, after)
      touched += 1
    }
  }
  return touched
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  const email = process.env.VITE_SUPABASE_DEV_EMAIL
  const password = process.env.VITE_SUPABASE_DEV_PASSWORD
  if (!url || !anon) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required')
  const client = createClient(url, anon, { auth: { persistSession: false } })

  const entries = await plan(client)
  const named = entries.filter((entry) => entry.namedByRows).length
  console.log(
    `${entries.length} files under public/blueprint-images: ${named} named by rows, ` +
      `${entries.length - named} fixtures-only (shelf ${SHELF_CELL})`,
  )

  if (process.argv.includes('--upload')) {
    if (!email || !password) throw new Error('--upload needs VITE_SUPABASE_DEV_EMAIL and VITE_SUPABASE_DEV_PASSWORD')
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw error
    const { put, kept } = await upload(client, entries)
    console.log(`uploaded ${put}, already there ${kept}`)
  }
  if (process.argv.includes('--rewrite-src')) {
    console.log(`rewrote ${rewriteSources(entries, url)} source files`)
  }
  if (!process.argv.includes('--upload') && !process.argv.includes('--rewrite-src')) {
    console.log('plan only — pass --upload to put the files in, --rewrite-src to point the fixtures at them')
  }
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    console.error(error.message ?? error)
    process.exit(1)
  })
}

/**
 * #274 — an upload is an attachment with a stable URL.
 *
 * The replayed series must leave the `cell-attachments` bucket with its four
 * policies on `storage.objects`, every write policy behind
 * `is_service_account()` and under the `cells/<id>/<id>.<ext>` pattern. The
 * live half — that the anon key is refused — is `check:auth-posture`.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { replayMigrations } from '../migration-replay.mjs'

const ROOT = resolve(new URL('../..', import.meta.url).pathname)
const schema = replayMigrations(resolve(ROOT, 'supabase/migrations'))

const WRITE_POLICIES = [
  'cell_attachments_insert',
  'cell_attachments_update',
  'cell_attachments_delete',
]

test('the series leaves the four bucket policies on storage.objects', () => {
  for (const name of ['cell_attachments_select', ...WRITE_POLICIES]) {
    assert.ok(
      schema.policies.has(`storage.objects.${name}`),
      `the series never leaves ${name} on storage.objects`,
    )
  }
})

test('every write policy is service-account only and keyed by ids', () => {
  for (const name of WRITE_POLICIES) {
    const policy = schema.policies.get(`storage.objects.${name}`)
    assert.ok(policy)
    const { definition } = policy
    assert.match(definition, /is_service_account\(\)/, `${name} is open to any signed-in session`)
    assert.match(definition, /\bto\s+authenticated\b/i, `${name} does not name its role`)
    assert.doesNotMatch(definition, /\bto\s+(anon|public)\b/i, `${name} admits anon`)
    if (name !== 'cell_attachments_delete') {
      assert.match(
        definition,
        /cells\/\[0-9a-f-\]\{36\}\/\[0-9a-f-\]\{36\}\\\.\[a-z0-9\]\{1,8\}/,
        `${name} does not pin the object key to ids`,
      )
    }
  }
})

test('the bucket is public to read, and the migration says why', () => {
  const sql = readFileSync(
    resolve(ROOT, 'supabase/migrations/20260902150000_an_upload_is_an_attachment_with_a_stable_url.sql'),
    'utf8',
  )
  assert.match(sql, /'cell-attachments', 'cell-attachments', true/)
  assert.match(sql, /Public because the app reads without a session/)
})

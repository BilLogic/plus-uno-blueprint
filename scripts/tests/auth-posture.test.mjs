/**
 * The machinery behind `scripts/check-auth-posture.mjs`, exercised directly.
 *
 * This one is unusual among the checks here: it is RED against production
 * right now, and the tests still have work to do. Green-against-nothing is the
 * usual failure mode; this file guards the opposite one — that the check stays
 * red for the right reason, and goes green only when the setting actually
 * changes rather than when the payload shape does.
 *
 * The `settings` fixtures are the real shape, taken from
 * `GET /auth/v1/settings` on the production project, trimmed to the fields the
 * check reads.
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  findings,
  probeAnonUpload,
  readSettings,
  settingsUrl,
  storageFindings,
  uploadProbeUrl,
} from '../check-auth-posture.mjs'

/** Production, as measured. Public sign-up on, everything else off. */
const AS_MEASURED = {
  disable_signup: false,
  mailer_autoconfirm: false,
  external: { email: true, anonymous_users: false, google: false, github: false },
}

/** The same project with the one setting #60 asks for. */
const CLOSED = { ...AS_MEASURED, disable_signup: true }

test('the state production is actually in is caught', () => {
  const found = findings(AS_MEASURED)
  assert.equal(found.length, 1)
  assert.equal(found[0].setting, 'disable_signup')
  assert.match(found[0].detail, /public sign-up is ON/)
})

test('and flipping that one setting is enough to clear it', () => {
  // The check must not demand more than #60 asks for. If it did, the person
  // who does the work would flip the switch and still see red.
  assert.deepEqual(findings(CLOSED), [])
})

test('email staying enabled is not a finding', () => {
  // The team signs in with email. `disable_signup` is what decides whether a
  // STRANGER may, and judging the provider's presence too would make the
  // check unsatisfiable without breaking sign-in for the people who need it.
  assert.deepEqual(findings({ ...CLOSED, external: { email: true } }), [])
})

test('anonymous sign-in is its own route and its own finding', () => {
  const found = findings({ ...CLOSED, external: { email: true, anonymous_users: true } })
  assert.equal(found.length, 1)
  assert.match(found[0].detail, /needs no account at all/)
})

test('an external provider nobody reviewed is a finding', () => {
  const found = findings({ ...CLOSED, external: { email: true, google: true, github: true } })
  assert.equal(found.length, 1)
  assert.match(found[0].detail, /google, github/)
})

test('a payload that lost the field fails rather than passing', () => {
  // The failure mode this check is most exposed to: GoTrue renames or drops
  // `disable_signup`, `undefined === false` is false, and a check that only
  // looked for `false` would go quietly green on a project it can no longer
  // see.
  const found = findings({ external: { email: true } })
  assert.equal(found.length, 1)
  assert.match(found[0].detail, /expected true or false/)

  assert.equal(findings(null).length, 1)
  assert.equal(findings('nope').length, 1)
})

test('mailer_autoconfirm is deliberately not asserted', () => {
  // Requiring email confirmation raises the cost of self-provisioning to
  // owning a mailbox, which the attacker does. Asserting it would let someone
  // satisfy this check by tightening the wrong thing.
  assert.deepEqual(findings({ ...CLOSED, mailer_autoconfirm: false }), [])
  assert.deepEqual(findings({ ...AS_MEASURED, mailer_autoconfirm: true }).length, 1)
})

test('the settings url is built from the project url, trailing slash or not', () => {
  assert.equal(settingsUrl('https://x.supabase.co'), 'https://x.supabase.co/auth/v1/settings')
  assert.equal(settingsUrl('https://x.supabase.co/'), 'https://x.supabase.co/auth/v1/settings')
})

test('the reader sends the key and refuses a bad response', async () => {
  let seen = null
  const ok = async (url, init) => {
    seen = { url, init }
    return { ok: true, json: async () => CLOSED }
  }
  assert.deepEqual(await readSettings('https://x.supabase.co', 'anon-key', ok), CLOSED)
  assert.equal(seen.url, 'https://x.supabase.co/auth/v1/settings')
  assert.equal(seen.init.headers.apikey, 'anon-key')

  const refused = async () => ({ ok: false, status: 401 })
  await assert.rejects(
    () => readSettings('https://x.supabase.co', 'anon-key', refused),
    /returned 401/,
  )
})

/* ---------------------------------------------------- the bucket (#274) */

test('an anon upload that lands is the finding', () => {
  const found = storageFindings(200)
  assert.equal(found.length, 1)
  assert.match(found[0].detail, /anon key uploaded/)
})

test('a refusal is the pass, and only a refusal', () => {
  assert.deepEqual(storageFindings(403), [])
  assert.deepEqual(storageFindings(400), [])
  assert.equal(storageFindings(500).length, 1)
  assert.equal(storageFindings(undefined).length, 1)
})

test('the probe writes under the key pattern the policy admits, as anon', async () => {
  const calls = []
  const status = await probeAnonUpload('https://x.supabase.co/', 'anon-key', async (url, init) => {
    calls.push({ url, init })
    return { status: 403 }
  })
  assert.equal(status, 403)
  assert.equal(calls[0].url, uploadProbeUrl('https://x.supabase.co'))
  assert.match(calls[0].url, /\/storage\/v1\/object\/cell-attachments\/cells\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.txt$/)
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.headers.apikey, 'anon-key')
})

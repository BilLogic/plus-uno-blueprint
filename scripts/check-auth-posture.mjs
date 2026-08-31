#!/usr/bin/env node
/**
 * #60 — can a stranger with the public key make themselves an author?
 *
 * Every write policy in this schema is `to authenticated using (true)`, and
 * #183 narrowed which COLUMNS that role may write but not who may become it.
 * So the value of an `authenticated` token is exactly the value of being able
 * to mint one, and whether a stranger can mint one is a single setting in a
 * dashboard this repository cannot see.
 *
 * It was `false` for months and nothing said so. #60 sat open as "manual",
 * which is another way of spelling "checked when somebody remembers".
 *
 * ── The thing that makes this checkable at all ────────────────────────────
 *
 * GoTrue publishes its own configuration to the anon key:
 *
 *   GET {SUPABASE_URL}/auth/v1/settings   apikey: {ANON_KEY}
 *   { "disable_signup": false, "mailer_autoconfirm": false,
 *     "external": { "email": true, "anonymous_users": false, … } }
 *
 * The anon key is public by design — it ships inside the browser bundle this
 * project deploys. So unlike `check:rls-posture:live`, `check:contract:live`
 * and `check:identifiers:live`, this check needs NO privileged credential and
 * is not structurally condemned to be manual. That is the whole point of
 * writing it: every incident this repository logged this month was a check
 * that could only run when someone thought to run it.
 *
 * It still needs the two values in the environment, because they are not in
 * the repository. `gates.yml` reads them from repository VARIABLES rather than
 * secrets, which is the correct home for a value that is already public, and
 * the workflow says so where a reader will meet it. Until those variables are
 * set the job reports that it could not look — loudly, and as a failure of the
 * check rather than a pass, because "no configuration" and "configured and
 * safe" must never print the same line.
 *
 * ── What it asserts, and what it deliberately does not ────────────────────
 *
 * ASSERTED: public sign-up is off, anonymous sign-in is off, and no external
 * provider is enabled. Those three are the routes to a token.
 *
 * NOT ASSERTED: `mailer_autoconfirm`. Requiring email confirmation raises the
 * cost of self-provisioning to owning a mailbox, which the attacker does. It
 * is a speed bump, not a gate, and asserting it would let someone satisfy this
 * check by tightening the wrong thing.
 */

/** The three settings that decide whether a stranger can obtain a token. */
export function findings(settings) {
  if (!settings || typeof settings !== 'object') {
    return [{ setting: 'settings', detail: 'the endpoint returned nothing usable' }]
  }
  const found = []

  if (settings.disable_signup === false) {
    found.push({
      setting: 'disable_signup',
      detail:
        'public sign-up is ON — anyone holding the published anon key can ' +
        'create an account and every write policy admits `authenticated`',
    })
  } else if (settings.disable_signup !== true) {
    // Absent is not the same as off. A payload shape that changed under us
    // must fail rather than read as a pass.
    found.push({
      setting: 'disable_signup',
      detail: `expected true or false, got ${JSON.stringify(settings.disable_signup)}`,
    })
  }

  const external = settings.external ?? {}
  if (external.anonymous_users === true) {
    found.push({
      setting: 'external.anonymous_users',
      detail: 'anonymous sign-in is ON — a token needs no account at all',
    })
  }

  // `email` is listed among the providers and is the one sign-up path this
  // project uses for its own team, so it is judged by `disable_signup` above
  // rather than by its presence here.
  const enabledProviders = Object.entries(external)
    .filter(([name, on]) => on === true && name !== 'email' && name !== 'anonymous_users')
    .map(([name]) => name)
  if (enabledProviders.length > 0) {
    found.push({
      setting: 'external',
      detail: `${enabledProviders.join(', ')} can mint a token and nobody here reviews that path`,
    })
  }

  return found
}

/** Where GoTrue publishes its configuration. */
export function settingsUrl(supabaseUrl) {
  return `${String(supabaseUrl).replace(/\/+$/, '')}/auth/v1/settings`
}

export async function readSettings(supabaseUrl, anonKey, fetchImpl = fetch) {
  const response = await fetchImpl(settingsUrl(supabaseUrl), {
    headers: { apikey: anonKey },
  })
  if (!response.ok) {
    throw new Error(`auth settings returned ${response.status}`)
  }
  return response.json()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error(
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set, so this check ' +
        'looked at nothing.\n\nBoth are public values — the anon key ships in the ' +
        'browser bundle — so they belong in repository VARIABLES, not secrets. ' +
        'Locally: set -a; . ./.env; set +a.\n\nThis is a failure rather than a skip ' +
        'because "not configured" and "configured and safe" must not print the same line.',
    )
    process.exit(1)
  }

  const settings = await readSettings(url, key)
  const bad = findings(settings)
  if (bad.length > 0) {
    for (const { setting, detail } of bad) console.error(`${setting}: ${detail}`)
    console.error(
      '\nFix in the dashboard: Authentication → Sign In / Providers. This check ' +
        'cannot fix it and neither can a migration — the setting is not in the database.',
    )
    process.exit(1)
  }
  console.log(
    'ok — public sign-up is off, anonymous sign-in is off, and no external provider can mint a token',
  )
}

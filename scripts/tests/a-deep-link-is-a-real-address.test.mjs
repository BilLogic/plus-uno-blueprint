// The service route only works if Netlify hands every path to the app.
//
// `serviceRoute.ts` says a deep link like `/plus-tutoring?cell=<id>` carries
// both the service and the cell. That sentence is only true when the host
// serves `index.html` for a path with no file behind it — and for a while it
// did not, so the address the app itself wrote into the bar answered 404 on
// reload. This holds the rule that fixed it.
//
// Every rule sits under the path the app is served from — the BASE_PATH in
// `netlify.toml`, read here the way the template's hosting check reads it, so
// the build and these assertions cannot disagree about the prefix. The build
// writes the redirects itself under that prefix, so this repository ships no
// `public/_redirects`: these tests read what the build writes, from the same
// function the build calls, over the files this repository does ship.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import {
  basePathIn,
  cacheFindings,
  fileRedirectFindings,
  hostingRules,
} from 'uno-blueprint/scripts/check-hosting-rules.mjs'
import { hostRulesUnder } from '../../vite.config.ts'
import { BLUEPRINT_CONTRACT } from '../blueprintContract.mjs'

const REDIRECTS = 'the _redirects the build writes'
const HEADERS = 'public/_headers'
const CONFIG = 'netlify.toml'

// The file alone, not the shell: a developer's own BASE_PATH must not decide
// what production is held to.
const BASE = basePathIn(readFileSync(CONFIG, 'utf8'), {})
const RULES = hostingRules(BASE)
// A `public/_redirects` added later is read the way the build reads it: kept
// above the written rules, or refused if it answers for the app.
const OWN_REDIRECTS = 'public/_redirects'
const WRITTEN = hostRulesUnder(BASE, {
  redirects: existsSync(OWN_REDIRECTS) ? readFileSync(OWN_REDIRECTS, 'utf8') : null,
  headers: readFileSync(HEADERS, 'utf8'),
})

const ruleLines = () =>
  WRITTEN.redirects
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))

test('every path falls back to the app, and keeps the address it asked for', () => {
  const rules = ruleLines()

  assert.ok(rules.length > 0, `${REDIRECTS} has no rules, so no path reaches the app`)

  const fallback = rules.at(-1)
  const [from, to, status] = fallback.split(/\s+/)

  assert.equal(from, RULES.catchAll, `the last rule must catch every path under ${BASE}, not just ${from}`)
  assert.equal(to, `${BASE}index.html`, 'the fallback must serve the app shell')
  assert.equal(
    status,
    '200',
    'a rewrite, not a redirect — a 301 would throw away the slug and the query params the app reads',
  )
})

// And the one path that must NOT reach the app.
//
// A hashed chunk under `/assets/` either exists or is gone with the deploy
// that built it. Falling through to the rule above hands a stale tab the app
// shell with a 200 and a `text/html` type where it asked for a script, which
// surfaces as "Failed to fetch dynamically imported module" instead of the
// 404 it is. First match wins, so the only thing holding that is the order.
test('a missing hashed asset is a 404, and the catch-all still comes last', () => {
  const rules = ruleLines()

  const assets = rules.findIndex((rule) => rule.split(/\s+/)[0] === RULES.assets)
  const fallback = rules.findIndex((rule) => rule.split(/\s+/)[0] === RULES.catchAll)

  assert.ok(assets !== -1, `${REDIRECTS} has no ${RULES.assets} rule, so a missing chunk is served the app shell`)
  assert.ok(
    assets < fallback,
    `the ${RULES.assets} rule must precede the catch-all — Netlify takes the first match`,
  )

  const [, to, status] = rules[assets].split(/\s+/)

  assert.equal(to, RULES.missingChunk.to, 'the splat keeps the real path, so a chunk that IS there is still served')
  assert.equal(status, '404', 'a missing chunk must be a not-found, not the app shell')
})

// Hashed names are what makes a year-long cache safe.
test('hashed assets are served immutable', () => {
  const headers = WRITTEN.headers
    .split('\n')
    .map((line) => line.trimEnd())

  const section = headers.findIndex((line) => line.trim() === RULES.assets)
  assert.ok(section !== -1, `${HEADERS} has no ${RULES.assets} section`)

  const directives = []
  for (const line of headers.slice(section + 1)) {
    if (!line.startsWith(' ') && !line.startsWith('\t')) break
    directives.push(line.trim())
  }

  assert.ok(
    directives.includes('Cache-Control: public, max-age=31536000, immutable'),
    'the content hash is in the filename, so the year-long immutable cache is the point of hashing it',
  )
})

// And the template's own findings over what the build writes, at the same
// prefix: no forced rule, no second asset block, no long cache on the shell.
// Only the `public/` half of its check applies here. Its `netlify.toml` half
// expects the redirect table in that file, and this repository keeps
// `netlify.toml` to the one setting.
test('the template hosting check finds nothing under the prefix', () => {
  assert.deepEqual(fileRedirectFindings(WRITTEN.redirects, REDIRECTS, BASE), [])
  assert.deepEqual(cacheFindings(WRITTEN.headers, HEADERS, BASE), [])
})

// Served from a path, the site's own root has no file behind it. Somebody who
// knows the bare address is sent to the board rather than handed a 404.
test.skipIf(BASE === '/')('the bare root is sent to the board, and shadows nothing', () => {
  const rules = ruleLines()
  const [from, to, status] = rules[0].split(/\s+/)
  assert.equal(from, '/', 'the root redirect comes first and matches the bare root alone')
  assert.equal(to, BASE, `the root is sent to ${BASE}`)
  assert.equal(status, '301', 'the build sends the bare root on to the prefix for good')
})

// The bot builds `${appUrl}/?cell=<id>`, so the contract's app root has to sit
// at the same prefix the build is served under, or every cell link it posts
// lands outside the app.
test('the contract app root is served under the same prefix', () => {
  const { pathname } = new URL(BLUEPRINT_CONTRACT.appUrl)
  assert.equal(
    pathname.replace(/\/*$/, '/'),
    BASE,
    `appUrl ${BLUEPRINT_CONTRACT.appUrl} must sit at ${BASE}, the BASE_PATH in ${CONFIG}`,
  )
})

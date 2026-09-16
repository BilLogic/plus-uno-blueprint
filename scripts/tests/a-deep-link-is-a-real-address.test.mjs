// The service route only works if Netlify hands every path to the app.
//
// `serviceRoute.ts` says a deep link like `/plus-tutoring?cell=<id>` carries
// both the service and the cell. That sentence is only true when the host
// serves `index.html` for a path with no file behind it — and for a while it
// did not, so the address the app itself wrote into the bar answered 404 on
// reload. This holds the rule that fixed it.
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const REDIRECTS = 'public/_redirects'
const HEADERS = 'public/_headers'

const ruleLines = () =>
  readFileSync(REDIRECTS, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))

test('every path falls back to the app, and keeps the address it asked for', () => {
  const rules = ruleLines()

  assert.ok(rules.length > 0, `${REDIRECTS} has no rules, so no path reaches the app`)

  const fallback = rules.at(-1)
  const [from, to, status] = fallback.split(/\s+/)

  assert.equal(from, '/*', `the last rule must catch every path, not just ${from}`)
  assert.equal(to, '/index.html', 'the fallback must serve the app shell')
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

  const assets = rules.findIndex((rule) => rule.split(/\s+/)[0] === '/assets/*')
  const fallback = rules.findIndex((rule) => rule.split(/\s+/)[0] === '/*')

  assert.ok(assets !== -1, `${REDIRECTS} has no /assets/* rule, so a missing chunk is served the app shell`)
  assert.ok(
    assets < fallback,
    'the /assets/* rule must precede the catch-all — Netlify takes the first match',
  )

  const [, to, status] = rules[assets].split(/\s+/)

  assert.equal(to, '/assets/:splat', 'the splat keeps the real path, so a chunk that IS there is still served')
  assert.equal(status, '404', 'a missing chunk must be a not-found, not the app shell')
})

// Hashed names are what makes a year-long cache safe.
test('hashed assets are served immutable', () => {
  const headers = readFileSync(HEADERS, 'utf8')
    .split('\n')
    .map((line) => line.trimEnd())

  const section = headers.findIndex((line) => line.trim() === '/assets/*')
  assert.ok(section !== -1, `${HEADERS} has no /assets/* section`)

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

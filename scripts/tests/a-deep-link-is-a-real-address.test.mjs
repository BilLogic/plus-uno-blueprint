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

test('every path falls back to the app, and keeps the address it asked for', () => {
  const rules = readFileSync(REDIRECTS, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

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

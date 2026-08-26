#!/usr/bin/env node
/**
 * uno-bot's `/health/blueprint`, asserted as SHAPE rather than as a boolean.
 *
 * What this replaced was `grep -q '"ok":true'`. That grep passes on any
 * response containing those six characters, and it says nothing about which
 * reads the bot actually probed. So the two failures it was built to catch —
 * a renamed FK constraint, a moved RPC parameter — were invisible to it, and
 * so was the case where the bot quietly STOPPED probing a table the contract
 * still promises it reads. A probe that shrinks is indistinguishable from a
 * probe that passes, when all you assert is one word.
 *
 * Every expectation here is derived from `BLUEPRINT_CONTRACT`, not typed out
 * again: the bot must probe an `rpc_*` for every RPC the contract declares and
 * a `table_*` for every table in `botReadTables`, each must be true, and the
 * endpoint must not report `ok:true` over a probe that is false. A key the
 * contract does not account for fails too — the bot reading something nobody
 * wrote down is the shape the next silent break takes.
 *
 * Unreachable is a FAILURE, never a pass. A network error, a non-200, a body
 * that is not JSON and a body with no `probes` object each exit non-zero and
 * say which one happened.
 *
 * Run: node scripts/check-bot-contract-probe.mjs   (also: npm run check:bot-probe)
 */
import { BLUEPRINT_CONTRACT } from './blueprintContract.mjs'

const DEFAULT_URL = 'https://uno-bot.bryanhuang628.workers.dev/health/blueprint'
const TIMEOUT_MS = 30_000

/** `semantic_search.match_corpus_chunks` is probed as `rpc_match_corpus_chunks`. */
const probeKeyForRpc = (name) => `rpc_${name.split('.').pop()}`

/**
 * The probe keys the contract obliges the endpoint to carry.
 *
 * Only `searchBlueprint` is required. `matchCorpusChunks` lives in the
 * `semantic_search` schema, which PostgREST does not expose — the bot reaches
 * it with the service role over its own connection, and the public endpoint
 * cannot probe it without holding a key. It is listed as optional so that the
 * bot growing that probe is accepted rather than rejected as undeclared.
 */
export function expectedProbeKeys(contract = BLUEPRINT_CONTRACT) {
  return {
    required: [
      probeKeyForRpc(contract.rpcs.searchBlueprint),
      ...contract.botReadTables.map((table) => `table_${table}`),
    ],
    optional: [probeKeyForRpc(contract.rpcs.matchCorpusChunks)],
  }
}

/**
 * Everything wrong with a probe response, as messages. Empty means it agrees
 * with the contract.
 *
 * Pure on purpose: `scripts/tests/blueprintContract.test.mjs` feeds it forged
 * bodies, so the failure paths are exercised on every test run rather than
 * only on the day the bot breaks.
 */
export function probeFailures(body, contract = BLUEPRINT_CONTRACT) {
  const failures = []

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return ['the response body is not a JSON object']
  }
  if (typeof body.build !== 'string' || body.build.trim() === '') {
    failures.push('the response carries no `build` string — cannot tell which bot answered')
  }

  const probes = body.probes
  if (probes === null || typeof probes !== 'object' || Array.isArray(probes)) {
    return [...failures, 'the response carries no `probes` object — there is no shape to assert']
  }

  const { required, optional } = expectedProbeKeys(contract)
  const accounted = new Set([...required, ...optional])

  for (const key of required) {
    if (!(key in probes)) {
      failures.push(
        `the contract declares "${key.replace(/^table_/, '')}" as a bot read, but ` +
          `/health/blueprint no longer probes it (missing key "${key}"). Either the ` +
          `bot stopped reading it or the probe stopped covering it; both make the ` +
          `next break silent.`,
      )
    }
  }

  for (const [key, value] of Object.entries(probes)) {
    if (value !== true) {
      failures.push(
        `probe "${key}" is ${JSON.stringify(value)} — that read is broken against the ` +
          `live database, and a schema change in this repo is the usual cause.`,
      )
    }
    if (/^(table|rpc)_/.test(key) && !accounted.has(key)) {
      failures.push(
        `the bot probes "${key}", which BLUEPRINT_CONTRACT does not declare. ` +
          `Add it to botReadTables/rpcs so the dependency is written down where a ` +
          `migration author will see it.`,
      )
    }
  }

  const allPassed = Object.values(probes).every((value) => value === true)
  if (body.ok !== allPassed) {
    failures.push(
      `the endpoint reports ok:${JSON.stringify(body.ok)} while its probes say ` +
        `${JSON.stringify(allPassed)} — the summary disagrees with the detail, so the ` +
        `summary cannot be trusted.`,
    )
  }

  // The cross-repo half of #79: the endpoint does not echo the breadcrumb it
  // parsed yet. When it does, a drifted label fails here instead of reaching
  // Slack as a mis-parsed citation. Until then this repo covers the breadcrumb
  // against the live database itself — see scripts/check-blueprint-contract.mjs.
  if (body.breadcrumb && typeof body.breadcrumb === 'object') {
    const { separator, labels } = contract.breadcrumb
    if (body.breadcrumb.separator !== separator) {
      failures.push(
        `the bot parses breadcrumbs on ${JSON.stringify(body.breadcrumb.separator)}, ` +
          `the contract says ${JSON.stringify(separator)}`,
      )
    }
    const echoed = body.breadcrumb.labels
    if (!Array.isArray(echoed) || echoed.join('|') !== labels.join('|')) {
      failures.push(
        `the bot parses breadcrumb labels ${JSON.stringify(echoed)}, the contract ` +
          `declares ${JSON.stringify(labels)}`,
      )
    }
  }

  return failures
}

async function main() {
  const url = process.argv[2] ?? process.env.UNO_BOT_HEALTH_URL ?? DEFAULT_URL
  console.log(`probing ${url}`)

  let response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (error) {
    fail([
      `could not reach ${url}: ${error.message}. An unreachable bot is a failed ` +
        `check, not a quiet one — if the Worker is down, the contract is unverified.`,
    ])
    return
  }

  const text = await response.text()
  console.log(text.slice(0, 2000))

  if (!response.ok) {
    fail([`${url} returned HTTP ${response.status}`])
    return
  }

  let body
  try {
    body = JSON.parse(text)
  } catch {
    fail([`${url} returned a body that is not JSON — see the output above`])
    return
  }

  const failures = probeFailures(body)
  if (failures.length > 0) {
    fail(failures)
    return
  }

  const { required } = expectedProbeKeys()
  console.log(`ok — ${required.length} contract-declared probes present and true`)
  if (!body.breadcrumb) {
    console.log(
      'not covered here: the endpoint does not echo the breadcrumb it parses. ' +
        'The breadcrumb is checked against the live database by ' +
        'scripts/check-blueprint-contract.mjs instead.',
    )
  }
}

function fail(messages) {
  for (const message of messages) {
    console.error(`::error::uno-bot contract probe: ${message}`)
  }
  console.error(
    'bot repo: PLUS-UNO/plus-vibe-coding-starting-kit/agents/uno-bot · ' +
      'contract: src/lib/blueprintContract.ts · docs/connectors/plus-uno.md',
  )
  process.exitCode = 1
}

if (import.meta.url === `file://${process.argv[1]}`) await main()

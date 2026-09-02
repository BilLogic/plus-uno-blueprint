#!/usr/bin/env node
/**
 * Render the generated sections of docs/agents/blueprint.md and hold the
 * document to its sources.
 *
 *   npm run agent-account              rewrite the generated sections
 *   npm run agent-account -- --record  …and record the ratchet baseline
 *   npm run check:agent-account        fail if the sections or the ratchet
 *                                      have drifted (the live CI job)
 *
 * The schema section comes from `public.schema_comments()` on the LIVE
 * database under the anon key, because pg_description is the source (#260)
 * and PostgREST exposes the catalog to no role except through that function
 * (20260902200000). Which relations an agent can read is probed the same
 * way the contract check probes them: a bare select as anon.
 *
 * Refuses to pass without seeing the database, like every live check here.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  coverage,
  entityKinds,
  handWritten,
  prohibitionCount,
  ratchetFailures,
  renderSchema,
  renderVocabulary,
  splice,
  tableColumns,
} from './agent-account.mjs'
import { credentials, postgrest, rest } from './check-blueprint-contract.mjs'

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname)
const DOC = resolve(REPO_ROOT, 'docs/agents/blueprint.md')
const BASELINE = resolve(REPO_ROOT, 'docs/reference/agent-account-baseline.json')
const PANEL_TERMS = resolve(REPO_ROOT, 'src/lib/panelTerms.ts')
const DATABASE_TS = resolve(REPO_ROOT, 'src/types/database.ts')

async function main() {
  const check = process.argv.includes('--check')
  const record = process.argv.includes('--record')
  const { url, key } = credentials({ serviceRole: false })

  const kinds = entityKinds(readFileSync(PANEL_TERMS, 'utf8'))
  const columns = tableColumns(readFileSync(DATABASE_TS, 'utf8'))

  const comments = await rest(url, key, 'rpc/schema_comments', { method: 'POST', body: '{}' })
  if (!comments.ok || !Array.isArray(comments.body) || comments.body.length === 0) {
    throw new Error(
      `could not read the catalog's comments from ${url} — ${postgrest(comments.body)}. ` +
        `public.schema_comments() (20260902200000) is the route; nothing here is rendered from memory.`,
    )
  }
  const readable = new Set()
  for (const name of columns.keys()) {
    const probe = await rest(url, key, `${name}?select=*&limit=0`)
    if (probe.ok) readable.add(name)
  }

  const doc = readFileSync(DOC, 'utf8')
  const sources = { columns, comments: comments.body, readable }
  const next = splice(splice(doc, 'vocabulary', renderVocabulary(kinds)), 'schema', renderSchema(sources))
  const current = { columnComments: coverage(sources), prohibitions: prohibitionCount(handWritten(next)) }

  const failures = []
  if (check) {
    if (next !== doc) {
      failures.push(
        'docs/agents/blueprint.md is not what its sources render — panelTerms.ts, pg_description or ' +
          'database.ts changed and the account did not. Run: npm run agent-account',
      )
    }
  } else {
    writeFileSync(DOC, next)
    console.log(`wrote ${DOC.slice(REPO_ROOT.length + 1)}`)
  }

  if (record) {
    writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`)
    console.log(`recorded ${BASELINE.slice(REPO_ROOT.length + 1)}`)
  } else if (existsSync(BASELINE)) {
    failures.push(...ratchetFailures(current, JSON.parse(readFileSync(BASELINE, 'utf8'))))
  } else {
    failures.push('docs/reference/agent-account-baseline.json does not exist — record it: npm run agent-account -- --record')
  }

  console.log(
    `vocabulary: ${kinds.length} kinds · schema: ${readable.size} readable relation(s) of ${columns.size} · ` +
      `column comments: ${current.columnComments.described} of ${current.columnComments.of} · ` +
      `prohibitions: ${current.prohibitions}`,
  )
  for (const failure of failures) console.error(`::error::agent account — ${failure}`)
  if (failures.length > 0) process.exitCode = 1
  else console.log('ok — the account agrees with its sources and the ratchet holds')
}

main().catch((error) => {
  console.error(`::error::agent account: ${error.message}`)
  process.exitCode = 1
})

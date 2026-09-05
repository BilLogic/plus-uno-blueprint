#!/usr/bin/env node
/**
 * Render the generated sections of `docs/reference/interface-schema-map.md`,
 * and hold the document to its sources.
 *
 *   npm run interface-map            rewrite the generated sections
 *   npm run check:interface-map      fail if they have drifted (the CI gate)
 *
 * The map moved out of `CONTEXT.md` in #365. It went there in the first place
 * because that was the file people read to learn the vocabulary; it left
 * because a glossary that also carries ninety lines of reference is read by
 * every session that wanted one word. Under `docs/` it is a disclosed
 * reference: one pointer in `AGENTS.md`, read when a session touches a panel.
 *
 * TWO HALVES, AND ONLY ONE OF THEM IS WRITTEN BY HAND. The table restates
 * what the catalog already says — which column each label names, and the
 * sentence the catalog carries about that column — so it is rendered, from
 * `scripts/interface-schema-map.mjs` and from the schema
 * `scripts/migration-replay.mjs` replays out of `supabase/migrations`. The
 * prose is hand-written, because why two words differ is a decision and no
 * catalog holds decisions.
 *
 * IT IS THE STATIC CATALOG, and that is the same trade
 * `check-retired-identifiers` states in capitals: the replay describes the
 * FILES, not the database. It needs no credential, so `--check` can be a
 * required gate rather than a job that runs when somebody remembers — and the
 * live half is already covered, because `check:contract:live` sweeps the same
 * prose against the deployed schema on every pull request.
 *
 * Modelled on `scripts/generate-docs-index.mjs` and
 * `scripts/generate-agent-account.mjs`: write by default, `--check` to fail on
 * drift, and the same `<!-- generated:… -->` markers.
 *
 * Run: node scripts/generate-interface-schema-map.mjs   (also: npm run interface-map)
 * CI-check: node scripts/generate-interface-schema-map.mjs --check
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  LABEL_COLUMNS,
  boundNames,
  namesNotInCatalog,
  renderBinding,
  renderCatalog,
  splice,
} from './interface-schema-map.mjs'
import { replayMigrations } from './migration-replay.mjs'

export const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname)
export const DOC = 'docs/reference/interface-schema-map.md'

/** The document as its sources render it, and what a run should report. */
export function render(doc, schema, map = LABEL_COLUMNS) {
  const missing = namesNotInCatalog(schema, map)
  const next = splice(splice(doc, 'binding', renderBinding(map), DOC), 'catalog', renderCatalog(schema, map), DOC)
  return { next, missing }
}

function main() {
  const check = process.argv.includes('--check')
  const path = resolve(REPO_ROOT, DOC)
  const schema = replayMigrations(resolve(REPO_ROOT, 'supabase/migrations'))
  const doc = readFileSync(path, 'utf8')
  const { next, missing } = render(doc, schema)

  const failures = []
  if (missing.length > 0) {
    failures.push(
      `${DOC} binds ${missing.length} name(s) the replayed catalog does not have: ${missing.join(', ')}. ` +
        'A label pointed at a column that is not there is the defect this map exists to end — ' +
        'fix the name in scripts/interface-schema-map.mjs, or add the migration that creates it.',
    )
  }
  if (check) {
    if (next !== doc) {
      failures.push(
        `${DOC} is not what its sources render — scripts/interface-schema-map.mjs or the ` +
          'catalog changed and the document did not. Run: npm run interface-map',
      )
    }
  } else if (next !== doc) {
    writeFileSync(path, next)
    console.log(`wrote ${DOC}`)
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`[interface-map] ${failure}`)
    process.exit(1)
  }
  const described = boundNames().filter((name) =>
    schema.comments.has(name.includes('.') ? `column:${name}` : `table:${name}`),
  ).length
  console.log(
    `[interface-map] ${LABEL_COLUMNS.length} labels bind ${boundNames().length} names, ` +
      `all in the replayed catalog, ${described} of them described by a comment` +
      `${check ? ' — the document is what they render' : ''}.`,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()

#!/usr/bin/env node
/**
 * THE BROWSER RENDER WALK — THE PACKAGE'S RUNNER, BEHIND THIS DEPLOYMENT'S ONE
 * PRECONDITION.
 *
 * The walk is the template's: a published directory inside
 * `node_modules/agentic-service-blueprinting/render-walk/`. Nothing here
 * decides what it opens or what it asserts, and since v1.44.10 nothing here
 * STAGES it either.
 *
 * ── WHAT LEFT THIS FILE ────────────────────────────────────────────────────
 *
 * Half of it. Up to v1.44.9 the published invocation pointed Playwright
 * straight at a TypeScript config under `node_modules`, which neither loader
 * will compile — Playwright's transform hook declines any path with a
 * `node_modules` segment, and Node's own type stripping refuses it outright —
 * so this script copied the directory out first and handed Playwright the
 * copy. v1.44.10 ships that copying as `render-walk/run.mjs`, linked as the
 * `render-walk` bin, and this repository's staging is deleted rather than kept
 * beside it: a second copy of a thing the pin now publishes is a second copy to
 * drift. The run below is the published one, `npx render-walk` by another
 * spelling — resolved as a path rather than through `npx` so it is the
 * installed copy that runs and not one fetched from somewhere.
 *
 * ── WHAT DID NOT LEAVE, AND WHY THIS FILE STILL EXISTS ────────────────────
 *
 * The precondition. The walk is over a build made with the Supabase variables
 * cleared, so it needs an app that serves a BOARD with no database, and this
 * deployment still does not have one.
 *
 * v1.44.10 gave the missing half a config home — `sample.blueprints` beside
 * `sample.nav`, the two replaced rather than merged — and this deployment now
 * supplies both (`deployment/deployment.ts`). But the content is empty, and
 * `deployment/data/sampleBlueprints.ts` carries the reason at length: the
 * registry's generator takes a Service Blueprint IR, this deployment has never
 * had one, its board arrived as an import that happened elsewhere, and the cell
 * prose lives in the live database and nowhere this tree can read. Generating
 * it needs credentials no check here holds.
 *
 * So a no-database build still draws this deployment's phase and scenario rows
 * over a registry that answers none of their ids, and the walk would fail on
 * the first board it asserts — a true failure about the seam, reported as if
 * the application were broken. That is a fact to STATE rather than a red to
 * collect: `unverified` from `sweep.mjs`, the same "a skip is said out loud"
 * mechanism every other check here uses. The reason prints on every run and
 * lands in the CI job's summary, and the day the registry is filled in this
 * stops printing it with no edit to this file.
 *
 * Arguments are passed through, so `npm run check:render-walk -- --headed` and
 * the environment variables the package's README documents
 * (`RENDER_WALK_PORT`, `RENDER_WALK_INJECT_CONSOLE_ERROR`) all still work.
 *
 * Run: node scripts/render-walk.mjs   (also: npm run check:render-walk)
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { unverified } from './sweep.mjs'
import { PACKAGE, TEMPLATE_PACKAGE, refuseOnStaleInstall } from './template-pin.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** The published runner, inside the installed package. */
export const RUNNER = join(PACKAGE, 'render-walk', 'run.mjs')

/** Where this deployment states the board a no-database build shows. */
export const NAV = 'deployment/data/sampleNav.ts'

/** And the content those rows resolve to. Both are `sample.*` on the config. */
export const BLUEPRINTS = 'deployment/data/sampleBlueprints.ts'

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g

/** Every id spelled in `text`, as a set. */
const idsIn = (text) => new Set(text.match(UUID) ?? [])

/**
 * Whether a build of this repository with no database serves a board the walk
 * can open: one of the scenarios this deployment's own `sample.nav` lists has
 * offline content registered for it on `sample.blueprints`.
 *
 * Both halves are read as TEXT, and the test is an id in common rather than a
 * registry shape. The registry is a generated block and a reader that knew its
 * shape would be a reader to break on the next regeneration; an id from the nav
 * appearing anywhere in the content module is the fact that actually decides
 * whether a board renders.
 *
 * The subject moved with the seam. It used to be the application's offline data
 * modules, read through the `app` sweep, because that was the only place
 * content could be registered — a resident under `src/`. Since v1.44.10 it is
 * configuration, so the two files this deployment hands the config are what get
 * compared, and neither answer depends on what the package happens to ship.
 *
 * ERRS TOWARD RUNNING. If either half cannot be read, this answers yes: the
 * walk runs and a real failure is reported. The opposite default would let a
 * rename turn the walk off silently, which is the failure this whole file is
 * careful about.
 */
export function servesASampleBoard(root) {
  const navPath = join(root, NAV)
  const contentPath = join(root, BLUEPRINTS)
  if (!existsSync(navPath) || !existsSync(contentPath)) return true
  const declared = idsIn(readFileSync(navPath, 'utf8'))
  if (declared.size === 0) return true
  for (const id of idsIn(readFileSync(contentPath, 'utf8'))) {
    if (declared.has(id)) return true
  }
  return false
}

function main() {
  const runner = join(REPO_ROOT, RUNNER)
  if (!existsSync(runner)) {
    console.error(
      `${TEMPLATE_PACKAGE} is installed without its render-walk/ runner, or not installed at ` +
        `all: ${RUNNER} is not there.\nRun \`npm ci\`, then re-run this check.`,
    )
    process.exit(1)
  }
  refuseOnStaleInstall(REPO_ROOT)

  if (!servesASampleBoard(REPO_ROOT)) {
    unverified(
      'the browser render walk over this deployment’s own board',
      `${NAV} lists this deployment's phases and scenarios and ${BLUEPRINTS} registers content ` +
        'for none of them, so a build with no database configured serves nav rows and an empty ' +
        "canvas. The registry's generator takes a Service Blueprint IR and this deployment has " +
        'never had one — its board arrived as an import made elsewhere, and its cell prose lives ' +
        `in the live database and in no file here. Fill ${BLUEPRINTS} from an export of that ` +
        'board — the header there carries the command — or run the walk against a build that ' +
        'has a database.',
    )
    return
  }

  const result = spawnSync(process.execPath, [runner, ...process.argv.slice(2)], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  process.exit(result.status ?? 1)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()

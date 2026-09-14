#!/usr/bin/env node
/**
 * THE BROWSER RENDER WALK, RUN OUT OF THE PACKAGE.
 *
 * The walk itself is the template's: `render-walk/playwright.config.ts` and the
 * two specs beside it, a published path, shipped inside
 * `node_modules/agentic-service-blueprinting`. Nothing here decides what it
 * opens or what it asserts — the version this repository pins does. It builds
 * nothing either: it previews this repository's own `dist`, walks the board that
 * build shows, and fails on any console error or page error, naming the address
 * it appeared on, with one screenshot per view under `render-walk-output/`.
 *
 * This script exists for two reasons, and both are worth stating precisely.
 *
 * ── 1. THE PUBLISHED INVOCATION DOES NOT RUN ───────────────────────────────
 *
 * The package's own README says a deployment needs no script at all:
 *
 *   npx playwright test -c node_modules/agentic-service-blueprinting/render-walk/playwright.config.ts
 *
 * It fails. Both loaders that could compile that file refuse it for the same
 * reason — it is under `node_modules`. Playwright's transform hook answers
 * `shouldTransform` false for any path containing a `node_modules` segment, so
 * Node sees raw TypeScript and fails with
 * `TypeError: Unknown file extension ".ts"` (`ERR_UNKNOWN_FILE_EXTENSION`);
 * Node's own type stripping refuses the same file explicitly, with
 * `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`. The rule is in both, it is not
 * configurable, and it applies to the specs as much as to the config, so
 * pointing Playwright at the installed files cannot work whichever of the two
 * is asked to compile them. It is filed upstream.
 *
 * So the directory is STAGED OUT of `node_modules` first, byte for byte, into a
 * gitignored directory, and Playwright is pointed at the copy. That is a copy
 * and it is not drift: it is written from the installed package on every run and
 * read by nothing else, so it cannot be edited into something other than what
 * the pin ships. Deleting this half of the script is the right change the day
 * either loader will compile a published TypeScript file in place.
 *
 * ── 2. AND THE ONE PRECONDITION THIS DEPLOYMENT DOES NOT MEET ──────────────
 *
 * The walk is over a build made with the Supabase variables cleared, and its
 * first assertion is that the app shows its `sample data` badge — otherwise it
 * would be measuring somebody's rows. So it needs an app that serves a BOARD
 * with no database, and this deployment does not have one.
 *
 * Not for want of a sample: it has one, and that is exactly the problem.
 * `sample.nav` is a config field, replaced and never merged, so this
 * deployment's phases and scenarios are the ones a no-database build shows —
 * and the blueprint CONTENT behind them has no config home at all. The
 * fallback registry is a generated block inside the application's own
 * `data/blueprintFallbacks.ts`, keyed by scenario id, and every key in it is
 * one of the template's sample ids. None of this deployment's nav ids is
 * among them. A no-database build therefore renders this deployment's phase
 * and scenario rows and then an empty canvas, which is the shape the walk
 * reports as a board that failed to render.
 *
 * That is a fact about the seam rather than a defect in the walk, so the run
 * SAYS SO AND STOPS rather than failing — `unverified` from `sweep.mjs`, which
 * is the same "a skip is said out loud" mechanism every other check here uses.
 * Nothing is silenced: the reason is printed on every run and lands in the CI
 * job's summary, and the day the content arrives this stops printing it.
 *
 * Two ways it arrives, and the walk runs on either without a line changing
 * here: this deployment keeps a resident `src/data/blueprintFallbacks.ts`
 * registering content for one of its own scenarios — the overlay resolves the
 * application per path now, so a single resident is legal where a half-vendored
 * `src` once was not — or the template grows a config home for offline content
 * the way it has one for the nav.
 *
 * Arguments are passed through, so `npm run check:render-walk -- --headed` and
 * the environment variables the package's README documents
 * (`RENDER_WALK_PORT`, `RENDER_WALK_INJECT_CONSOLE_ERROR`) all still work.
 *
 * Run: node scripts/render-walk.mjs   (also: npm run check:render-walk)
 */
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { sweep, unverified } from './sweep.mjs'
import { PACKAGE, TEMPLATE_PACKAGE, refuseOnStaleInstall } from './template-pin.mjs'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** The published directory, inside the installed package. */
export const PUBLISHED = join(PACKAGE, 'render-walk')

/**
 * Where it is staged. Gitignored, rewritten every run, and named so nobody
 * mistakes it for a directory this repository authors — a leading dot and the
 * word `staged` in the path.
 */
export const STAGED = '.render-walk-staged'

/** Where this deployment states the board a no-database build shows. */
export const NAV = 'deployment/data/sampleNav.ts'

/** Where the application keeps the modules a no-database build reads from. */
export const OFFLINE_DATA = (path) => /^src\/data\/.*\.ts$/.test(path) && !/\.test\.ts$/.test(path)

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g

/** Every id spelled in `text`, as a set. */
const idsIn = (text) => new Set(text.match(UUID) ?? [])

/**
 * Whether a build of this repository with no database serves a board the walk
 * can open: one of the scenarios its own `sample.nav` lists has offline
 * blueprint content behind it.
 *
 * Both halves are read as text, and the application half comes through the
 * `app` subject, so it is the module the BUILD resolves — a resident here, the
 * package's where there is no resident. Which is the whole point: the day this
 * deployment overlays one offline-data module of its own, this answer changes
 * with no edit to this file.
 *
 * The test is an id in common, not a registry shape. The registry is a
 * generated block keyed by scenario id, and a reader that knew its shape would
 * be a reader to break on the next regeneration; an id from this deployment's
 * nav appearing anywhere in the application's offline data is the fact that
 * actually decides whether a board renders.
 *
 * ERRS TOWARD RUNNING. If either half cannot be read, this answers yes: the
 * walk runs and a real failure is reported. The opposite default would let a
 * rename turn the walk off silently, which is the failure this whole file is
 * careful about.
 */
export function servesASampleBoard(root) {
  const navPath = join(root, NAV)
  if (!existsSync(navPath)) return true
  const declared = idsIn(readFileSync(navPath, 'utf8'))
  if (declared.size === 0) return true
  const offline = sweep({ subject: 'app', root, where: OFFLINE_DATA, what: 'offline data module' })
  for (const path of offline.files) {
    const source = offline.read(path)
    if (source === null) continue
    for (const id of idsIn(source)) if (declared.has(id)) return true
  }
  return false
}

function main() {
  const published = join(REPO_ROOT, PUBLISHED)
  if (!existsSync(published)) {
    console.error(
      `${TEMPLATE_PACKAGE} is installed without its render-walk/ directory, or not installed at ` +
        `all: ${PUBLISHED} is not there.\nRun \`npm ci\`, then re-run this check.`,
    )
    process.exit(1)
  }
  refuseOnStaleInstall(REPO_ROOT)

  if (!servesASampleBoard(REPO_ROOT)) {
    unverified(
      'the browser render walk over this deployment’s own board',
      `${NAV} lists this deployment's phases and scenarios, and no offline blueprint content ` +
        'is registered for any of them, so a build with no database configured serves nav rows ' +
        'and an empty canvas. Register content for one scenario — a resident offline data ' +
        'module is enough, the overlay resolves the application per path — or run the walk ' +
        'against a build that has a database.',
    )
    return
  }

  const staged = join(REPO_ROOT, STAGED)
  // From scratch each time. A file left behind by an older pin is exactly the
  // stale-subject failure this walk exists to catch one layer down.
  rmSync(staged, { recursive: true, force: true })
  cpSync(published, staged, { recursive: true })

  const result = spawnSync(
    'npx',
    ['playwright', 'test', '-c', join(STAGED, 'playwright.config.ts'), ...process.argv.slice(2)],
    { cwd: REPO_ROOT, stdio: 'inherit' },
  )
  // The staged copy is left in place on the way out: Playwright's own trace
  // viewer resolves a failing step back to the spec it ran, and a reader
  // opening the uploaded trace needs the file to still be there.
  if (result.error) throw result.error
  process.exit(result.status ?? 1)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()

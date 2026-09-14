import type { DeploymentConfig } from 'agentic-service-blueprinting'

/**
 * The content behind `sampleNav.ts`'s rows — the other half of this
 * deployment's offline board, and EMPTY, on purpose, with the reason written
 * down rather than left to be rediscovered.
 *
 * `sample.nav` lists the phases and scenarios a build shows before a database
 * answers; this is what each of those scenarios draws. The kit replaces both
 * rather than merging them, so a deployment that supplies only the nav draws
 * its own rows over the template's registry — which is keyed by the template's
 * scenario ids and answers none of ours. That is the shape this repository has
 * been in: nav rows above an empty canvas in every no-database build, and a
 * render walk with no board to open.
 *
 * ── WHY THERE IS NOTHING HERE YET ────────────────────────────────────────
 *
 * The kit's generator writes both halves in one pass —
 * `scripts/generate_fallbacks.py --register`, inside the installed package —
 * and its input is a Service Blueprint IR. THIS DEPLOYMENT HAS NO IR. Its
 * board arrived as imported data (`docs/adr/0009-the-migration-series-is-a-
 * narrative.md`: "no migration in the series ever creates a path, a lane, a
 * step or a cell"), the import happened elsewhere, and what this tree holds
 * instead is hand-authored SQL: `supabase/seed.sql` and the scenario files
 * under `supabase/seeds/`, whose inserts are upserts keyed by hand-minted ids.
 * The cell prose itself is not even in those any more — `scripts/
 * authored_fields.mjs` says it plainly, that the seed carries no cells at all
 * and the blueprint's actual prose lives in the database and nowhere else.
 *
 * So the registry cannot be generated from anything in this repository. It
 * needs an export of the live board, which needs credentials, and no command
 * here produces one: `node scripts/authored_fields.mjs export` reaches the
 * database but emits authored FIELDS keyed by natural keys, not a board.
 *
 * ── WHAT REGENERATES IT ──────────────────────────────────────────────────
 *
 * Once this deployment's board exists as an IR — exported from the project the
 * `deployment/types/database.ts` header names, or authored the way the kit's
 * own sample is — one run rewrites this file and `sampleNav.ts` together, and
 * the two stay in step because they came from the same pass:
 *
 *   python3 node_modules/agentic-service-blueprinting/scripts/generate_fallbacks.py \
 *     <ir-file> --locale <tag> --out deployment/data/sampleBlueprints.ts --register
 *
 * Until then this exports an empty registry, which the kit reads as "nothing
 * to say" and resolves to the package's own — the same board a build shows
 * today. Nothing about the running application changes by wiring it; what
 * changes is that the field has a home, the reason has an address, and
 * `npm run check:render-walk` reports its skip against THIS file rather than
 * against a guess about the application's internals.
 *
 * `references/customization.md` § The offline board is two fields, inside the
 * installed package, is the kit's side of this.
 */
type SampleBlueprintRegistry = NonNullable<
  NonNullable<DeploymentConfig['sample']>['blueprints']
>

export const SAMPLE_BLUEPRINTS: SampleBlueprintRegistry = {
  blueprintsByScenario: {},
}

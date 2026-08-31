/**
 * The rename map, machine-readable — the one list three checks agree on.
 *
 * `CONTEXT.md`'s "The rename map — fixed vocabulary" table is the DOCUMENTED
 * map and stays the thing a person reads. This is the ENFORCED map. Neither
 * derives from the other, and `scripts/tests/retired-vocabulary.test.mjs`
 * asserts they still say the same thing.
 *
 * That the two are separate is the point. A prose document should not be
 * load-bearing for CI — reformatting a markdown table must not break a build,
 * and a check that parses prose acquires an exemption for every sentence that
 * merely mentions a word. But a documented map that has drifted from the
 * enforced one is a lie in the file people read to learn the vocabulary, so
 * divergence is itself a failure. Hence: two lists, one test holding them
 * together.
 *
 * Read by:
 *   - `scripts/check-retired-identifiers.mjs`  (#145 Check A — database identifiers)
 *   - `scripts/check-database-names.mjs`       (#145 Check B — names inside strings)
 *   - `scripts/tests/retired-copy.test.mjs`    (#146 — words a person reads on screen)
 */

/**
 * One row per row of `CONTEXT.md`'s rename table, in the same order.
 *
 * `was` / `is` / `migrations` are the table's three columns, reduced to the
 * code spans they contain — the test compares exactly those, so prose around
 * them ("on the `entity_status` domain") can be rewritten freely.
 *
 * `retired` is what the identifier checks actually match: SUBSTRINGS, not
 * whole words. `20260821370000_the_rename_reaches_the_functions.sql` is the
 * standing proof — `\mlayer_id\M` never matched inside
 * `cells_layer_step_slot_unique` because `_` is a word constituent, and a
 * function no cell write can avoid stayed broken for a day because of it.
 * Every fragment is asserted to be a substring of one of the same row's `was`
 * entries, so the enforced words cannot wander from the documented ones.
 *
 * `copy` is the prose spelling of the same retirement, for the guard over
 * words a person reads. Each entry is asserted to correspond to a `was`
 * identifier with underscores read as spaces.
 */
export const RENAME_MAP = Object.freeze(
  [
    {
      was: ['layers', 'layer_role', 'cells.layer_id'],
      is: ['lanes', 'lane_role', 'cells.lane_id'],
      migrations: ['20260820120000'],
      retired: ['layer'],
      copy: ['layer', 'layers'],
    },
    {
      was: ['cell_triggers'],
      is: ['cell_dependencies'],
      migrations: ['20260820100000'],
      retired: ['cell_trigger'],
      copy: ['cell trigger', 'cell triggers'],
    },
    {
      was: ['sets_off'],
      is: ['leads_to'],
      migrations: ['20260820180000'],
      retired: ['sets_off'],
      copy: ['sets off'],
    },
    {
      was: [
        'service_scenarios',
        'service_lifecycles',
        '*_service_scenario_id',
        '*_service_lifecycle_id',
      ],
      is: ['scenarios', 'services', 'scenario_id', 'service_id'],
      migrations: ['20260820140000', '20260821340000'],
      // `lifecycle` bare, not `service_lifecycle`: `phases_lifecycle_order_idx`
      // carries the dead word without the prefix.
      retired: ['service_scenario', 'lifecycle'],
      copy: ['service scenario', 'service scenarios', 'lifecycle', 'lifecycles'],
    },
    {
      was: ['row_position', 'column_position', 'slot_position', 'order_position'],
      is: ['position'],
      migrations: ['20260820130000'],
      retired: ['row_position', 'column_position', 'slot_position', 'order_position'],
      copy: ['row position', 'column position', 'slot position', 'order position'],
    },
    {
      was: ['cells.maturity'],
      is: ['cells.status', 'entity_status'],
      migrations: ['20260821240000'],
      retired: ['maturity'],
      copy: ['maturity'],
    },
    {
      was: ['propositions'],
      is: ['business_model'],
      migrations: ['20260821350000'],
      retired: ['proposition'],
      copy: ['proposition', 'propositions'],
    },
    /*
      THE ONE ROW THAT ENFORCES NOTHING FROM HERE, and the empty lists are the
      entry rather than an omission.

      `stakeholders.note` held a definition on all eighteen of its rows — "Who
      the tutoring is for", "The tutor running a session" — so it was a
      `summary` wearing the word this vocabulary reserves for an aside. The
      retired word is therefore `note`, and `note` is a LIVE column on three
      other tables where it means exactly what it says: `paths.note`,
      `cell_dependencies.note` and `findings.note` are all genuine asides.

      Enforcing `note` as a fragment would fail the series on those three. The
      obvious narrowing, `stakeholders.note`, would match nothing at all: the
      identifier sweep hands `retiredFragmentsIn` a BARE column name and never
      a qualified one, so a qualified fragment is a guard that cannot fire, and
      a guard that cannot fire is a comment wearing a check's clothes.

      So this rename is recorded here for the person reading the map and
      enforced by `scripts/tests/stakeholder-summary.test.mjs`, which replays
      the series and asserts the shape against the one table it concerns — and
      asserts, on a fixture series that never renames, that it goes red.
    */
    {
      was: ['stakeholders.note'],
      is: ['stakeholders.summary'],
      migrations: ['20260830160000'],
      retired: [],
      copy: [],
    },
  ].map((row) => Object.freeze({ ...row, ...Object.fromEntries(
    ['was', 'is', 'migrations', 'retired', 'copy'].map((k) => [k, Object.freeze(row[k])]),
  ) })),
)

/** Every retired identifier fragment, deduplicated, longest first. */
export const RETIRED_IDENTIFIER_FRAGMENTS = Object.freeze(
  [...new Set(RENAME_MAP.flatMap((row) => row.retired))].sort(
    (a, b) => b.length - a.length || a.localeCompare(b),
  ),
)

/** Every retired prose spelling, deduplicated, longest first. */
export const RETIRED_COPY_WORDS = Object.freeze(
  [...new Set(RENAME_MAP.flatMap((row) => row.copy))].sort(
    (a, b) => b.length - a.length || a.localeCompare(b),
  ),
)

/** The current name a retired fragment was renamed to, for the failure message. */
export function replacementFor(fragment) {
  const row = RENAME_MAP.find((entry) => entry.retired.includes(fragment))
  return row ? row.is.join(' / ') : null
}

/**
 * Retired fragments present in an identifier, as substrings. Case-insensitive
 * because Postgres folds unquoted identifiers to lower case and nothing in this
 * schema is quoted.
 */
export function retiredFragmentsIn(identifier) {
  const lower = String(identifier).toLowerCase()
  return RETIRED_IDENTIFIER_FRAGMENTS.filter((fragment) => lower.includes(fragment))
}

/**
 * The shape every exemption in every one of these checks takes.
 *
 * Modelled on `VENDORED_FONT_SIZE_LITERALS` in `src/lib/tokenDiscipline.test.ts`
 * — a named list rather than a narrowed pattern, because a pattern narrowed to
 * dodge a real case reads, to the next person, as a rule that never covered it.
 *
 *   identifier  what is exempt, exactly as the check names it
 *   because     why, in a sentence a stranger can evaluate
 *   until       the issue that ends it. ABSENT MEANS PERMANENT, and a
 *               permanent entry must be defined in CONTEXT.md — see
 *               `scripts/tests/retired-vocabulary.test.mjs`.
 *
 * @typedef {{ identifier: string, because: string, until?: string }} Exemption
 */

/** True when `identifier` is covered by one of `exemptions`. */
export function isExempt(identifier, exemptions) {
  return exemptions.some((entry) => entry.identifier === identifier)
}

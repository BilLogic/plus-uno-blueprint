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
      // The PLURAL only, and the singular's absence is the entry rather than
      // an omission — it is the same distinction CONTEXT.md's one permanent
      // exemption already makes, applied to the words on screen.
      //
      // `propositions` was a TABLE, and it was renamed because that word
      // already meant a cell's value proposition. So the rename moved the
      // container and left the concept exactly where it was: `value_props`
      // still holds value propositions, `evidence.proposition_question_key`
      // still records which proposition an evidence row answers, and #182
      // puts the concept on a label, where it names `cells.value_props`
      // precisely. Forbidding the singular on screen would forbid the word
      // this rename was performed in order to protect.
      //
      // The identifier fragment above is untouched, because a DATABASE object
      // spelled `proposition` really is the retired one — there is exactly
      // one, and CONTEXT.md documents it as permanent.
      copy: ['propositions'],
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
      migrations: ['20260830170000'],
      retired: [],
      copy: [],
    },
    {
      was: ['frontstage_tech', 'backstage_tech'],
      is: ['frontstage_touchpoints', 'backstage_touchpoints'],
      migrations: ['20260830150000'],
      // Not `tech`: it is a substring of nothing here but is an ordinary
      // English word the identifier sweep would hit across the tree, and
      // `TECH_ITEM_DETAIL_PICTURES` is a legitimate surviving use — a stock
      // logo for a well-known tool is a static asset, not a lane role. The
      // full role spellings are what actually retired.
      retired: ['frontstage_tech', 'backstage_tech'],
      // The prose spellings the guard can derive from the identifiers above.
      // The lane LABELS were "Front Stage Tech" and "Back Stage Tech", and
      // those are not listed: the copy guard's list must read the identifier
      // aloud, and a label is free-form text the migration renames directly.
      // Adding them here would make this list a second vocabulary that can
      // drift from the map, which is the thing the parity test forbids.
      copy: ['frontstage tech', 'backstage tech'],
    },
    {
      was: ['tech_description'],
      is: ['cell_touchpoints'],
      migrations: ['20260830140000'],
      // Both lists are empty, and that IS the entry rather than an omission.
      //
      // `tech_description` still appears in the tree and must: the fallback
      // blueprints in src/data are not migrating, and `cellTouchpoints.ts`
      // reads that link type to resolve them. So there is nothing for the
      // identifier sweep to forbid. And nothing ever put the phrase on
      // screen — it was a jsonb `type` value, never a label — so there is no
      // prose spelling to retire either, and a `copy` entry with no matching
      // `retired` one is exactly what the guard below refuses.
      //
      // What retired is the ARRANGEMENT: detail keyed to a cell by matching
      // a label. The check that holds it is the import migration's own
      // assertion that every resolving link carried its detail across.
      retired: [],
      copy: [],
    },
    // #177's four rows. Three of them carry EMPTY lists, and the reason is the
    // same in each case: a substring cannot express the retirement.
    //
    // `audit_findings` contains `findings`; `business_models` contains
    // `business_model`. Any fragment that catches the old name catches the new
    // one, so there is no word to enforce. And `label`, `note`, `origin` and
    // `description` are all still LIVE, correct names elsewhere —
    // `deleted_structure.label`, `paths.note`, six `origin` columns, and a
    // `create_phase` argument the file series carries that production does
    // not. Adding any of them would flag code that is right, which is the one
    // thing this list must never do.
    //
    // The rule that a false positive is fixed by narrowing the SUBJECT and
    // never the word list still holds; it just has nothing to narrow here,
    // because the subject is a bare identifier with no table beside it.
    // `scripts/tests/one-spelling-each.test.mjs` carries these four
    // retirements instead, as table-qualified names, which is a subject narrow
    // enough to say `description` without saying it about `create_phase`.
    {
      was: ['slices.description', 'findings.note', 'cell_dependencies.label'],
      is: ['slices.summary', 'audit_findings.summary', 'cell_dependencies.name'],
      migrations: ['20260830190000'],
      retired: [],
      copy: [],
    },
    {
      was: ['paths.path_type', 'slices.slice_type', 'scenarios.view_type'],
      is: ['paths.kind', 'slices.kind', 'scenarios.layout'],
      migrations: ['20260830190000'],
      retired: ['path_type', 'slice_type', 'view_type'],
      copy: ['path type', 'slice type', 'view type'],
    },
    {
      was: ['findings', 'findings.check_name'],
      is: ['audit_findings', 'audit_findings.check_key'],
      migrations: ['20260830190000'],
      retired: ['check_name'],
      copy: ['check name'],
    },
    {
      was: ['slices.origin', 'business_model'],
      is: ['slices.authorship', 'business_models'],
      migrations: ['20260830190000'],
      retired: [],
      copy: [],
    },
    // #179's three rows. The word "frame" meant two things and "storyboard"
    // meant two more, and all three rows below are the same repair: a name
    // that said what the MEDIUM is, where every sibling says what the thing
    // is for.
    //
    // `visual` was a lane role beside `customer_actions` and
    // `support_actions` — the one that answered "what is in this row" while
    // the others answered "what is this row for". It is `storyboard` now,
    // which is the word the interface, the panel term and the lane's own
    // display name were already using.
    {
      was: ['visual'],
      is: ['storyboard'],
      migrations: ['20260830270000'],
      retired: ['visual'],
      // A common enough English word to be worth saying why it is listed:
      // the only reader-facing use of it was "Visual walkthrough", which is
      // the storyboard played step by step and now says so. If a legitimate
      // "visual" ever needs to reach a reader, the rule is the one every
      // check in this batch follows — narrow the SUBJECT, never the word.
      copy: ['visual'],
    },
    {
      was: ['cells.picture'],
      is: ['cells.frame'],
      migrations: ['20260830270000'],
      retired: ['picture'],
      copy: ['picture', 'pictures'],
    },
    // The table rename is enforceable and the column rename is not, which is
    // the usual split and not an omission. `slice_item` is a substring of
    // nothing that survives. `caption` is a live, correct English word for
    // text under an image — `steps.summary` is displayed as one — so a bare
    // fragment would flag a comment that is right. That half is held
    // table-qualified by `scripts/tests/a-frame-a-strip-and-a-slide.test.mjs`,
    // exactly as #177's four unenforceable renames are.
    //
    // `slice_items.illustration` is dropped rather than renamed, so it is not
    // in this table at all: this map is renames. The same test carries the
    // drop, in the shape `one-spelling-each.test.mjs` uses for the two note
    // columns #177 dropped.
    {
      was: ['slice_items', 'slice_items.caption'],
      is: ['slides', 'slides.title'],
      migrations: ['20260830270000'],
      retired: ['slice_item'],
      copy: ['slice item', 'slice items'],
    },
    /*
      THE LAST ROW, AND IT ENFORCES NOTHING FROM HERE EITHER — the empty
      lists ARE the entry, for the third distinct reason in this map.

      `cells.links` held three unrelated things at once: 475 resources, 117
      touchpoint details and 64 provenance citations. 20260830260000 moved the
      unplaceable details out to their own queue; 20260830280000 moved the
      resources to `resources` and the citations to `evidence`, then dropped
      the column.

      The retired word would be `links`, and it is the wrong instrument three
      ways. It is an ordinary English word the identifier sweep would hit
      across the tree ("deep links", "Figma links", `mergeUrlLinks`). The
      hand-written fallback blueprints in src/data are not migrating and still
      express a cell's resources as a `links` array, which `cellResources.ts`
      reads and `cellTouchpoints.ts` reads beside it. And `search_blueprint`
      still RETURNS a column called `links`, built from the new table, because
      uno-bot reads it by key and the contract has no alias mechanism for an
      output column.

      What retired is the ARRANGEMENT: one column holding three things under a
      name describing one of them. The check that holds it is
      `scripts/tests/cell-resources.test.mjs`, which replays the series and
      asserts the end state — and proves every finding goes red.
    */
    {
      was: ['cells.links'],
      is: ['resources', 'evidence'],
      migrations: ['20260830280000'],
      retired: [],
      copy: [],
    },
    /*
      #182'S FIVE ROWS, AND THEY ARE A DIFFERENT KIND OF ROW — the first in
      this map whose left column is a WORD ON SCREEN rather than an identifier,
      and the first with no migration.

      Every row above renames something in the database and the interface
      follows. These four rename nothing in the database, because by the time
      they land the column already says the right thing: `cells.content`,
      `cells.value_props`, `path_steps.position` and `paths.summary` were all
      correct while the labels above them said Text, Value, Columns and Applies
      when. So the `migrations` list is empty, and the `is` column carries two
      things — the word a reader now sees, and the column it names.

      Two of the four are enforceable here and two are not, which is the same
      split every batch in this map has had. `column` and `applies when` are
      said nowhere else on screen, so the copy guard can forbid them outright.
      `text` and `value` cannot be forbidden: "Text size", "Add text…" and
      "Delete text" on the annotation toolbar are correct uses of the first,
      and the second is an ordinary English word the copy guard's deliberately
      naive JSX extraction meets inside expressions. Adding either would flag
      code that is right.

      Those two are held by `scripts/tests/labels-name-their-columns.test.mjs`,
      which narrows the SUBJECT to panel labels — the `label`, `term` and
      `title` props of the four components that put a field's name in front of
      a reader — and is therefore narrow enough to say `Text` without saying it
      about "Text size". The same file asserts the other half no schema check
      can see: that the column each label now names is a column the schema
      actually has.
    */
    {
      was: ['text'],
      is: ['Content', 'cells.content'],
      migrations: [],
      retired: [],
      copy: [],
    },
    {
      was: ['value'],
      is: ['Value proposition', 'cells.value_props'],
      migrations: [],
      retired: [],
      copy: [],
    },
    {
      was: ['columns'],
      is: ['Position', 'path_steps.position'],
      migrations: [],
      // Nothing in the schema was ever called `column` — `column_position`
      // retired five rows up, and this is the label that outlived it. So the
      // identifier list is empty and the copy list is the whole entry: a row
      // and a column are how a lane and a step happen to be DRAWN, and the
      // axis is a rendering fact rather than a domain one.
      retired: [],
      copy: ['column', 'columns'],
    },
    {
      was: ['applies when'],
      is: ['Summary', 'paths.summary'],
      migrations: [],
      retired: [],
      copy: ['applies when'],
    },
    /*
      THE DESIGN SYSTEM'S OWN VOCABULARY, which had four words for two ideas.

      A **badge** describes the thing it sits on: one per thing, not drawn from
      a set, never interactive. A **tag** is one value out of a set, selectable
      or removable. By that split the owner control is the only real tag in the
      codebase, the divider label is a badge, and a touchpoint is a cell whose
      corner radius is a variant rather than a component of its own.

      `retired` is empty and that is the entry: no database object has ever
      been called either word, so the identifier sweep has nothing to forbid,
      and a guard that cannot fire is a comment wearing a check's clothes. What
      enforces this row is `scripts/tests/badge-and-tag.test.mjs`, whose
      subject is every NAME under `src` — a component, a prop, a constant, a
      variant string, a data attribute or a file name — plus the rule that no
      badge may grow a hover state, since a surface that repaints under the
      pointer promises a click a badge never delivers.

      `copy` is not empty, though, and it costs nothing: neither word reaches a
      reader today, and this is what keeps it that way.
    */
    {
      was: ['pill', 'chip'],
      is: ['badge', 'tag'],
      migrations: [],
      retired: [],
      copy: ['pill', 'pills', 'chip', 'chips'],
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

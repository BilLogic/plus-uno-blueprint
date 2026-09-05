/**
 * The rename map — the one list three checks agree on, and the only place the
 * map is written down.
 *
 * It used to have a documented twin. `CONTEXT.md` carried the same table in
 * prose, this file carried it in code, and `scripts/tests/retired-vocabulary.test.mjs`
 * held the two together — two lists on purpose, so that reformatting a markdown
 * table could not break a build while a drifted table could still fail one.
 * #365 made the glossary a glossary again: a document that defines terms and
 * stops. With the prose half gone there is no pair left to hold together, and
 * this file is both halves at once — the list CI acts on, and the commentary a
 * person reads to learn why a word left.
 *
 * The commentary below moved here word for word, because every paragraph of it
 * is about THESE lists: which renames are carried in the `retired` and `copy`
 * word lists, which are deliberately absent, and what enforces the absent ones
 * instead. The reasoning about words retired as IDENTIFIERS rather than as
 * words — the permanent exemption, and the narrowing of "proposition" — sits in
 * the header of `scripts/check-retired-identifiers.mjs`, beside the exemption
 * list that applies it.
 *
 * Read by:
 *   - `scripts/check-retired-identifiers.mjs`  (#145 Check A — database identifiers)
 *   - `scripts/check-database-names.mjs`       (#145 Check B — names inside strings)
 *   - `scripts/tests/retired-copy.test.mjs`    (#146 — words a person reads on screen)
 *   - `scripts/stale-prose.mjs`                (#261 — code spans in swept markdown)
 *
 * ── WHY EACH NAME WENT, AND WHICH ARE NOT IN THE WORD LISTS ─────────────────
 *
 * A domain rename landed across twelve commits during an audit, and nobody could
 * point at where the terms were defined. Here is where. **These are the current
 * names.**
 *
 * This file used to add "and the old ones survive nowhere in the schema", which
 * was never true and is the sentence that let the residue hide. `alter table …
 * rename` moves the table and the column and nothing else: the index, the
 * constraint, the policy, the trigger and the comment all keep the name they were
 * created with. Twenty-two such objects still carried retired words when
 * production was swept on 2026-08-26 (#142); `20260826110000` renames them and
 * asserts against the catalogue that none is left. Making the next rename
 * remember is #145's job, not this paragraph's.
 *
 * The reasoning, where it is worth knowing: a "tech" lane never held only
 * technology — a printed guide, a poster, a phone line and a Zoom recording were
 * all filed there, and four authored details had escaped onto Support Actions
 * cells because the name said they did not belong. A touchpoint also stopped
 * being a string: it was a name in `cells.content` whose detail lived in
 * `cells.links` under a matching label, and when the two stopped agreeing the
 * detail was simply not found — 57 of 117 were in that state. `row` and `column`
 * named how a lane and a step happen to be *drawn* today, and the axis is a rendering fact rather
 * than a domain one. "Lifecycle" was not a level above the service — it *was* the
 * service, wearing a longer name. And `enables` was left alone, because it was
 * already the plain word for what it means. A stakeholder's `note` held a
 * definition on all eighteen rows — "Who the tutoring is for", "The tutor running
 * a session" — and `summary` is this vocabulary's word for an entity's own
 * one-liner, while `note` is an author's aside about one.
 *
 * **The `stakeholders.note` row is enforced somewhere else, and it has to be.** The
 * three checks these entries feed match a retired word as a SUBSTRING of an
 * identifier, and the retired word here is `note` — which `paths.note`,
 * `cell_dependencies.note` and `findings.note` all still carry correctly, because
 * all three genuinely are asides. Enforcing `note` would fail the series on those
 * three; enforcing `stakeholders.note` would match nothing, since the identifier
 * sweep reads a bare column name and never a qualified one. So that row's
 * `retired` and `copy` lists are empty on purpose and the rename is enforced by
 * [`scripts/tests/stakeholder-summary.test.mjs`](scripts/tests/stakeholder-summary.test.mjs),
 * against the one table it concerns.
 *
 * The four `20260830190000` rows are one pass, and two rules decide all of it. **`name` is
 * for structure a reader navigates; `title` is for authored content a reader
 * reads** — which is why `slices.title` and `evidence.title` are not in the
 * table. **`summary` is the entity's own one-liner** — not an aside about it, so
 * `findings.note` was misnamed and `paths.note`, which genuinely is an aside, was
 * not. Classifiers settle on `kind`; `scenarios.view_type` is not a kind but a
 * display setting, so it is `layout` — and since `20260902120000` a setting that
 * is stored, `stacked` or `merged`, its old `single` value folded into `stacked`
 * because a one-path board was never a different board. `slices.origin` is renamed rather than
 * aligned because its vocabulary (`generated`, `customized`, `human`) answers a
 * different question from every other `origin` (`import`, `app`) — that word is
 * now free for `services`, which gained it in the same migration.
 *
 * **Four of these renames are not in the enforced map's word lists**, and the
 * reason is structural. `audit_findings` contains `findings` and
 * `business_models` contains `business_model`, so no substring distinguishes the
 * old name from the new one; `label`, `note` and `origin` all remain live,
 * correct names on other tables. Those four are held by
 * `scripts/tests/one-spelling-each.test.mjs`, which names them table-qualified.
 *
 * The three `20260830270000` rows are one pass too, and one rule decides all of
 * it: **a name says what the thing is for, not what it is made of.** `visual`
 * said the lane holds pictures, which is the least interesting thing about a row
 * sitting beside `customer_actions` and `support_actions`; `picture` said the
 * same thing one level down, about a column. So the lane is a **storyboard**, one
 * image on one cell is a **frame**, and a step's frames read across the lanes are
 * a **strip** — see `CONTEXT.md`, which is where the vocabulary lives.
 * `slice_items` named a slide by its relationship to its parent, the shape
 * `layers` had before it was `lanes`, and a slide's `caption` becomes a `title`
 * under the rule the paragraph above settles.
 *
 * **Two of that pass are not in the enforced word lists either, for the two
 * usual reasons.** `slice_items.caption` cannot be a fragment because `caption`
 * is a live, correct English word — `steps.summary` is *displayed* as one, and
 * that comment says so. And `slice_items.illustration` is not in the table at
 * all, because it was dropped rather than renamed: it held an image that
 * REPLACED a slide's strip instead of joining it, and no row ever set it. Both
 * are held by
 * [`scripts/tests/a-frame-a-strip-and-a-slide.test.mjs`](scripts/tests/a-frame-a-strip-and-a-slide.test.mjs),
 * which also holds the one thing no schema check can see — that no word on
 * screen calls a slide a frame.
 *
 * **`cells.links` is the last row, and it is not in the word lists either.**
 * `links` is an ordinary English word the sweep would hit across the tree; the
 * hand-written fallback blueprints in `src/data` still carry a `links` array and
 * must, because `cellResources.ts` and `cellTouchpoints.ts` both read it; and
 * `search_blueprint` still emits an output column of that name, because uno-bot
 * reads it by key. What retired is the ARRANGEMENT — one column holding
 * resources, touchpoint detail and provenance citations under a name describing
 * one of them — and that is held by
 * [`scripts/tests/cell-resources.test.mjs`](scripts/tests/cell-resources.test.mjs),
 * which replays the series, asserts the column is gone and the table that
 * replaced it carries its one-owner constraint, and proves each finding goes red.
 *
 * **One column is a deliberate exception.** `cells.content` keeps a word of its
 * own: a cell's text is a sentence somebody wrote about a moment, not a name for
 * the cell and not a one-line summary of something longer. The column's own
 * comment says so, and the same test asserts the comment is still there.
 *
 * **The last five rows are a different kind of row, and the table says so in the
 * left column.** Every row above renames something in the database and the
 * interface follows. These do the opposite: the column was already right, and the
 * LABEL above it was saying a word no query could find. So there is no migration —
 * `cells.content`, `cells.value_props`, `path_steps.position` and `paths.summary`
 * were all correct while the panel said Text, Value, Columns and Applies when —
 * and the `Is` column carries two things: the word a reader now sees, and the
 * column it names. They are kept in the same table as the schema→schema rows
 * rather than beside them, because a reader looking up a word should not first
 * have to know which kind of rename it was. These five are the label renames
 * [#171](https://github.com/BilLogic/plus-uno-blueprint/issues/171) asked for;
 * the MAP it asked for — every current label and the name behind it, not only the
 * ones that moved — is `docs/reference/interface-schema-map.md`.
 *
 * `column` and `applies when` are enforced as retired copy: neither is said
 * anywhere else on screen, so a reintroduction fails
 * [`scripts/tests/retired-copy.test.mjs`](scripts/tests/retired-copy.test.mjs).
 * `text` and `value` cannot be, for the reason four other rows here cannot —
 * "Text size", "Add text…" and "Delete text" on the annotation toolbar are correct
 * uses of the first, and the second is an ordinary English word the copy guard's
 * deliberately naive JSX extraction meets inside expressions. Those two are held
 * by [`scripts/tests/labels-name-their-columns.test.mjs`](scripts/tests/labels-name-their-columns.test.mjs),
 * which narrows the SUBJECT to panel labels — the `label`, `term` and `title`
 * props of the four components that put a field's name in front of a reader — and
 * is therefore narrow enough to say `Text` without saying it about "Text size".
 * The same test asserts the half no schema check can see: that the column each
 * label now names is a column the schema actually has, so a label cannot be
 * "fixed" by pointing it at a second word that is also not there.
 *
 * **The design system's own vocabulary is the last row, and it enforces from a
 * test rather than from here.** Four words had grown for two ideas. A **badge**
 * describes the thing it sits on: one per thing, not drawn from a set, never
 * interactive — the divider label, a cell's status, a lane's stakeholder. A
 * **tag** is one value out of a set, selectable or removable, and the owner
 * control is the only one in the app. "Chip" and "pill" were a third and fourth
 * name for those two, so a touchpoint is now a cell whose corner radius is a
 * variant rather than a component with a duplicate `Button` variant of its own.
 * No database object was ever called either word, so the identifier list is empty;
 * [`scripts/tests/badge-and-tag.test.mjs`](scripts/tests/badge-and-tag.test.mjs)
 * carries it, over every NAME under `src` and over one rule about behaviour —
 * **no badge changes colour or border on hover**, because a surface that repaints
 * under the pointer promises a click a badge never delivers. What a badge keeps is
 * the help cursor, the focus ring and the tooltip.
 *
 * ### A third spelling, for the fills
 *
 * `retired` is how a name is written as a database identifier and `copy` is how
 * it is written for a reader. There is a third, and a word escaped through the
 * gap before anyone named it: `frontstage_tech` became `frontstage_touchpoints`
 * in the schema, and the fill kept saying `frontstage-tech` in
 * `blueprintCellStyle.ts` and `blueprint.css` for a fortnight.
 *
 * Three guards looked straight at it and each declined for a reason correct on
 * its own. `check:identifiers` sweeps database identifiers, and a CSS attribute
 * value is not one. The identifier sweep matches substrings, and the fragment has
 * an underscore where the fill has a hyphen. `check:copy` reads what a person
 * reads, and nobody reads an attribute selector. Nothing was broken — the seam
 * was uncovered.
 *
 * `RETIRED_PRESENTATION_SPELLINGS` derives the hyphenated form from `retired`,
 * mechanically, for the same reason `copy` is derived: a hand-kept third list
 * could disagree with the first two, and a vocabulary with two spellings of one
 * word is what this whole file exists to prevent.
 * [`scripts/tests/presentation-keys.test.mjs`](scripts/tests/presentation-keys.test.mjs)
 * holds the fill vocabulary to it, and holds the stylesheet and the module to
 * each other.
 *
 * **A fill is a palette slot, not a role.** Several lane names point at one fill —
 * `Frontstage Actions` borrows `frontstage-touchpoint` in the legacy name-keyed
 * map, and `backstage_touchpoints` takes the `evidence` fill in the role-keyed
 * one. So the check asks that a fill name contains no retired word; it does not
 * ask that a fill be named after whichever role happens to use it.
 */

/**
 * One row per rename, ordered as the series landed them.
 *
 * `was` / `is` / `migrations` are the translation itself: the retired name, the
 * name it carries today, and the migration that moved it. They are the whole of
 * what the prose table used to say, which is why deleting that table cost
 * nothing.
 *
 * `retired` is what the identifier checks actually match: SUBSTRINGS, not
 * whole words. `20260821370000_the_rename_reaches_the_functions.sql` is the
 * standing proof — `\mlayer_id\M` never matched inside
 * `cells_layer_step_slot_unique` because `_` is a word constituent, and a
 * function no cell write can avoid stayed broken for a day because of it.
 * Every fragment is asserted to be a substring of one of the same row's `was`
 * entries, so the enforced words cannot wander from the names they came from.
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
      // an omission — it is the same distinction the one permanent exemption
      // in `check-retired-identifiers.mjs` makes, applied to words on screen.
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
      // one, and `check-retired-identifiers.mjs` documents it as permanent.
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
    // The five `description → summary` renames of 2026-08-20/21. Recorded
    // late (#261): the form key and two app types kept saying `description`
    // for twelve days, and the roster this file IS had no row for the rename
    // that any check could have read. Table-qualified for the same reason as
    // the row below — `description` is a live argument name elsewhere.
    {
      was: ['paths.description', 'cells.description', 'phases.description', 'scenarios.description', 'services.description'],
      is: ['paths.summary', 'cells.summary', 'phases.summary', 'scenarios.summary', 'services.summary'],
      migrations: ['20260820080000', '20260820090000', '20260820160000', '20260821350000'],
      retired: [],
      copy: [],
    },
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
    {
      was: ['cell_touchpoints.prominence', 'unplaced_touchpoint_details.prominence'],
      is: ['cell_touchpoints.role', 'unplaced_touchpoint_details.role'],
      migrations: ['20260902110000'],
      retired: ['prominence'],
      copy: ['prominence'],
    },
    {
      was: ["scenarios.layout = 'single'"],
      is: ["scenarios.layout = 'stacked'"],
      migrations: ['20260902120000'],
      retired: [],
      copy: ['single'],
    },
    /*
      VALUE ROWS. `was` is `table.column = 'value'`, and the retired word is a
      value the CHECK no longer accepts, not an identifier: `retired` is empty
      because `unhappy` is not a substring of any database name, and the sweep
      that reads these is `value-set-claims`, which holds a documented value
      list to the constraint — a list naming `unhappy` is stale whatever else
      it says. The migration is the one that rewrote the rows. `custom` is
      still a value of `slices.kind`, which is why that sweep asks WHICH
      column a list is about before it calls a word retired.
    */
    {
      was: ["paths.kind = 'unhappy'"],
      is: ["paths.kind = 'exception'"],
      migrations: ['20260821220000'],
      retired: [],
      copy: [],
    },
    {
      was: ["paths.kind = 'alternative'", "paths.kind = 'custom'"],
      is: ["paths.kind = 'variant'", "paths.kind = 'variant'"],
      migrations: ['20260821220000'],
      retired: [],
      copy: [],
    },
    {
      was: ["cell_dependencies.kind = 'trigger'", "cell_dependencies.kind = 'needs'"],
      is: ["cell_dependencies.kind = 'leads_to'", "cell_dependencies.kind = 'enables'"],
      migrations: ['20260820110000', '20260820180000'],
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
    {
      // #272. The panel used to pick ONE url to call "the design" — the
      // placement's, else a cell link whose host was figma.com — and label
      // the screenshot with it. A placement's link is a featured resource
      // since 20260902130000, every featured link is a button named by its
      // host, and the placement editor's field is plainly "Link" until #276
      // moves the column. No identifier retires: the column is still `url`.
      was: ['design link'],
      is: ['Open link', 'resources.featured'],
      migrations: [],
      retired: [],
      copy: ['design link'],
    },
    {
      // #276. A placement is summary + role. Its two URL columns —
      // `screenshot`, an image of the tool at this moment, and `url`, where
      // it lives — became a featured attachment and a featured link in
      // `resources` (20260902130000), and 20260902160000 dropped them. No
      // identifier retires: `url` is a live column on `resources` and
      // `touchpoints`, and `screenshot` stays on the unplaced queue until
      // #277 folds it in. No copy retires either — the editor's "Screenshot"
      // and "Link" fields went with the columns, and the placement list (#273)
      // is where a file or a link is added now.
      was: ['cell_touchpoints.url', 'cell_touchpoints.screenshot'],
      is: ['resources.url', 'resources.kind'],
      migrations: ['20260902160000'],
      retired: [],
      copy: [],
    },
    {
      // #277. The queue for details that named a touchpoint their cell did
      // not show. A placement can name its touchpoint by `name` alone now,
      // so the 57 folded into `cell_touchpoints` (linked where the registry
      // had the name, name-only where it did not), the table and its three
      // functions went, and the "Unplaced" count left the bar — a name-only
      // placement is drawn on the board with a dashed face, where the writing belongs.
      was: [
        'unplaced_touchpoint_details',
        'unplaced touchpoint detail',
        'place_touchpoint_detail',
        'discard_touchpoint_detail',
        'restore_touchpoint_detail',
        'unplaced',
      ],
      is: [
        'cell_touchpoints.name',
        'name-only placement',
        'set_placement_touchpoint',
        'remove_placement',
        'restore_placement',
        'name-only',
      ],
      migrations: ['20260902170000'],
      retired: ['unplaced_touchpoint_details', 'touchpoint_detail'],
      copy: ['unplaced'],
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

/**
 * Every retired identifier fragment in its PRESENTATION spelling.
 *
 * A third derivation, beside `retired` and `copy`, and it exists because a
 * word slipped through the gap between the first two. `20260830150000`
 * renamed the lane roles `frontstage_tech` / `backstage_tech`, and the fills
 * in `blueprintCellStyle.ts` and `blueprint.css` went on saying
 * `frontstage-tech` for a fortnight. Three guards looked straight at it:
 *
 *   - `check:identifiers` sweeps DATABASE identifiers. A CSS attribute value
 *     is not one.
 *   - `retiredFragmentsIn` matches substrings, and `frontstage_tech` has an
 *     underscore where the presentation spelling has a hyphen. No match.
 *   - `check:copy` reads what a person reads. An attribute selector is not
 *     read by anyone.
 *
 * So nothing was broken; the seam was simply uncovered. The derivation is
 * mechanical for the same reason `copy` is — a hand-maintained third list
 * could disagree with the first two, and a vocabulary with two spellings of
 * one word is what all of this exists to prevent.
 *
 * A fragment with no underscore derives to itself, which is correct and not a
 * duplicate: `visual` is `visual` in every spelling.
 */
export const RETIRED_PRESENTATION_SPELLINGS = Object.freeze(
  [...new Set(RETIRED_IDENTIFIER_FRAGMENTS.map((f) => f.replaceAll('_', '-')))].sort(
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
 *               permanent entry must be explained in the header of the check
 *               that applies it — see `scripts/tests/retired-vocabulary.test.mjs`.
 *
 * @typedef {{ identifier: string, because: string, until?: string }} Exemption
 */

/** True when `identifier` is covered by one of `exemptions`. */
export function isExempt(identifier, exemptions) {
  return exemptions.some((entry) => entry.identifier === identifier)
}

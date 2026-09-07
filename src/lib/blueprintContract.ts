/**
 * The cross-repo blueprint contract — CANONICAL HOME.
 *
 * uno-bot (the "le goat" Slack bot, a Cloudflare Worker in the PLUS-UNO
 * kit repo) reads this app's database and deep-links back into it. Every
 * constant both sides must agree on lives HERE and is vendored bot-ward by
 * the bot repo's scripts/sync-blueprint-contract.mjs. Two coordination
 * bugs shipped silently before this file existed (a renamed slices column
 * and a re-shaped findings column each made a bot read return empty for
 * weeks); a drifted copy now fails the bot's --check sync instead.
 *
 * Keep this module dependency-free: the bot compiles it in a Worker
 * context with no access to app imports.
 *
 * The relationship, its history and its guard: docs/connectors/plus-uno.md.
 */

export const BLUEPRINT_CONTRACT = {
  /** Query-param names the app's URL layer accepts (src/lib/urlViewState.ts). */
  urlParams: {
    cell: 'cell',
    slice: 'slice',
    mode: 'mode',
    slide: 'slide',
  },

  /** Production app origin. The bot's env var overrides; this is the shared default. */
  appUrl: 'https://uno-blueprint.netlify.app',

  /**
   * Breadcrumb format produced by the semantic view
   * (`semantic_search.blueprint_chunks_src.title`, defined in THIS repo — the
   * bot deleted its vendored DDL once the app took ownership) and parsed by
   * the bot's parseChunkTitle. Segments joined by `separator`, each
   * `<label>: <value>`; parsers ignore unknown segments, so chunks embedded
   * before the phase segment shipped still parse (minus `Phase`).
   *
   * `Phase` was added to the view on 2026-08-17 but never reached this file,
   * the canonical copy — so the canonical contract described a four-segment
   * breadcrumb while the database emitted five. Confirmed against the live
   * definition (`pg_get_viewdef`) on 2026-08-19 before correcting it here.
   */
  breadcrumb: {
    separator: ' · ',
    /** Extra labels a parser must accept for a segment, keyed by the canonical
     *  field name — `{ lane: ['layer'] }` would say the lane segment may be
     *  labelled either way.
     *
     *  EMPTY, and worth keeping empty. This is the mechanism that made the
     *  `Layer`→`Lane` crossing survivable: for the window between the view
     *  emitting the new label and the corpus being re-embedded with it, stored
     *  titles and fresh ones disagreed, and both had to parse. 20260826140000
     *  and the full re-embed closed that window (#144), so the entry went with
     *  it — an alias left behind after its crossing is indistinguishable from a
     *  label still in use. The next rename of an embedded label puts one back
     *  for exactly as long as its own re-embed takes. */
    aliases: {},
    labels: ['Phase', 'Scenario', 'Path', 'Step', 'Lane'],
  },

  /**
   * Public-read surface the bot depends on (anon SELECT via RLS policy or
   * public view). Tightening any of these breaks bot reads — the bot's
   * /health/blueprint probe checks the starred subset it actually queries.
   */
  publicReadTables: [
    'phases',
    'scenarios',
    'steps',
    'paths',
    'lanes',
    'cells',
    'cell_dependencies',
    'resources',
    'audit_findings',
    'slices',
    'slides',
    'evidence_counts',
    'touchpoints',
  ],

  /** Tables the bot actively reads (probe list for /health/blueprint). */
  botReadTables: ['cells', 'cell_dependencies', 'audit_findings', 'slices', 'touchpoints'],

  /**
   * Columns the bot names in a DIRECT PostgREST select — the reads that do not
   * go through `search_blueprint`.
   *
   * This section exists because the contract covered the RPC and the table
   * NAMES and nothing else, and on 2026-09-01 six of the bot's direct reads
   * were found asking for columns this app had renamed: `description` (now
   * `summary`) on four tables, `order_position` (now `position`),
   * `cell_dependencies.label` (now `name`), and `cells.links` and
   * `cell_dependencies.note`, both dropped. The oldest had been broken since
   * 2026-08-20. The bot's keyword fallback — its safety net for a search the
   * RPC misses — had in practice been `steps` alone for eleven days.
   *
   * Nothing caught it because nothing could. `check:contract` compares two
   * copies of this file, so a column this file never named could not drift.
   * The bot's own /health/blueprint probes restated the selects rather than
   * importing them, so they rotted alongside. And the failure is silent by
   * construction: PostgREST answers a renamed column with 400, every one of
   * those call sites logs a warning and returns an empty array, and Slack
   * reports "the blueprint has nothing on that".
   *
   * Declaring the columns here puts them where the existing machinery already
   * reaches: `check:contract:live` selects each one against the live database,
   * and the bot's `--check` sync fails when this file moves and its vendored
   * copy has not. The same header this file opens with names two earlier
   * versions of exactly this bug; this is the third, and the first one the
   * contract can see.
   *
   * A column belongs here when the bot names it in a select. Columns the RPC
   * projects belong in `searchBlueprintColumns` — a projection alias and a
   * table column are different promises, which is why `description` is correct
   * there and wrong here.
   */
  botDirectReadColumns: {
    phases: ['id', 'name', 'summary', 'position'],
    scenarios: ['id', 'name', 'summary', 'position'],
    steps: ['id', 'name'],
    paths: ['id', 'name', 'summary', 'status'],
    lanes: ['name', 'owner_team', 'kpis'],
    cells: [
      'id',
      'content',
      'summary',
      'function',
      'form',
      'value_props',
      'owner',
      'perceived_owner',
      'updated_at',
    ],
    cell_dependencies: ['source_cell_id', 'target_cell_id', 'kind', 'name'],
    resources: ['name', 'url', 'kind'],
    audit_findings: ['id', 'cell_ids', 'status'],
    slices: ['id', 'title', 'actor'],
    // The registry of the tools and surfaces the service runs through — an app
    // screen, an email, a Zoom room. Anon-readable since 20260830140000; the
    // bot reads it for "where do we use X" (plus-uno#414). Placements stay out.
    touchpoints: ['id', 'name', 'kind', 'summary', 'url'],
  },

  /**
   * PostgREST embed-hint constraint names. These are the sharpest edge in the
   * whole contract: an embed hint is a STRING inside a `select=`, so nothing
   * type-checks it on either side. Rename `cell_dependencies` without renaming its
   * constraints and the request 400s, the bot's fetchEdges logs a warning and
   * returns [], and Slack reports "no dependencies" for cells that have them —
   * the same silent-empty failure the bot already documents from the
   * `cell_id=in.(…)` era.
   */
  fkConstraints: {
    cellDependencySource: 'cell_dependencies_source_cell_id_fkey',
    cellDependencyTarget: 'cell_dependencies_target_cell_id_fkey',
    // `cells` → `lanes` has TWO foreign keys since 20260830180000 added the
    // composite `cells_path_matches_lane_fkey` beside `cells_lane_id_fkey`.
    // PostgREST refuses an unhinted `lanes(...)` embed from `cells` as
    // ambiguous (PGRST201), which is what turned the bot's keyword-fallback
    // cell read into "no cells matched" from that day (plus-uno#414 found it
    // on the live /health/blueprint probe `select_cells_spec`). The bot embeds
    // with this hint; the live check below resolves it from `cells`.
    cellLane: 'cells_lane_id_fkey',
  },

  /** RPCs the bot calls. DDL is versioned in this repo's supabase/migrations. */
  rpcs: {
    searchBlueprint: 'search_blueprint',
    matchCorpusChunks: 'semantic_search.match_corpus_chunks',
  },

  /**
   * `search_blueprint` parameter names, as sent on the wire. PostgREST binds
   * RPC arguments BY NAME, so renaming a parameter in a migration is a
   * breaking change for any caller that names it — and the caller cannot be
   * type-checked against the function signature.
   *
   * Only the ones the bot may send are listed. `filter_lane_role` was
   * `filter_layer_role` until the layers→lanes rename; listing it means a
   * rename shows up as contract drift rather than as a silent no-op filter.
   * `filter_path_kind` was `filter_path_type` until 20260830190000 renamed the
   * column it filters on, which is the same mechanism doing its job a second
   * time.
   */
  searchBlueprintParams: {
    q: 'q',
    queryEmbedding: 'query_embedding',
    matchCount: 'match_count',
    embedModel: 'embed_model',
    rrfK: 'rrf_k',
    filterPhase: 'filter_phase',
    filterScenario: 'filter_scenario',
    filterPathKind: 'filter_path_kind',
    filterLaneRole: 'filter_lane_role',
    granularity: 'granularity',
    include: 'include',
  },

  /**
   * Values `granularity` accepts, which is a different promise from the
   * parameter NAME above and was unmade until 2026-08-26.
   *
   * The layers→lanes rename moved every table, column, doc and surface to
   * `lane`, and renamed this RPC's `filter_layer_role` to `filter_lane_role`.
   * It did not reach the guard clause inside the body, so the function went on
   * rejecting `granularity => 'lane'` — the only word the rest of the model
   * uses — and accepting `'layer'`, which nothing else does. Nobody noticed
   * because a name was all this file declared: `check:contract:live` asserts
   * every declared parameter binds, and had nothing to say about values it was
   * never told (plus-uno-blueprint#144).
   *
   * The rung names double as the row `kind` each one emits — see
   * `searchBlueprintKinds`.
   *
   * `accepted` is the whole list; there is no `deprecated` beside it. `'layer'`
   * was taken on input from 20260826120000 until 20260827100000, to give
   * uno-bot's vendored copy of this file a window to sync in. It has
   * (plus-uno#257, r74), and the RPC's guard no longer accepts the word, so a
   * list of spellings-on-their-way-out would have nothing in it. When the next
   * rename needs one, add it back with an issue number attached — the value of
   * that list was always its emptiness being a decision rather than a default.
   */
  searchBlueprintGranularity: {
    accepted: ['phase', 'scenario', 'path', 'step', 'lane', 'cell'],
  },

  /**
   * `search_blueprint` OUTPUT column names the bot reads by key. Separate from
   * the underlying table columns on purpose: `cells.description` becomes
   * `cells.summary` in plan 002, but the RPC's projection is its own decision
   * and this is the name on the wire. `description` is still the right name
   * here after 20260830190000 for the same reason — it is the row's prose
   * column whatever the underlying table calls it.
   */
  searchBlueprintColumns: {
    kind: 'kind',
    id: 'id',
    title: 'title',
    snippet: 'snippet',
    description: 'description',
    lane: 'lane',
    step: 'step',
    scenario: 'scenario',
    phase: 'phase',
    path: 'path',
    links: 'links',
    updatedAt: 'updated_at',
    similarity: 'similarity',
    matchedBy: 'matched_by',
    totalMatched: 'total_matched',
  },

  /**
   * Row `kind` values `search_blueprint` tags its own results with, one per
   * granularity rung. Include rows carry their own kinds — `searchBlueprintInclude`.
   *
   * `'lane'` was `'layer'` here too, one line below the guard clause, which is
   * how a row could come back tagged `layer` beside a column called `lane`. A
   * kind has nowhere to put an alias the way `breadcrumb.aliases` does, so this
   * one flipped outright rather than accepting both.
   */
  searchBlueprintKinds: ['phase', 'scenario', 'path', 'step', 'lane', 'cell'],

  /**
   * Values `include` accepts, and the `kind` each one tags its rows with.
   * `slices` is listed because the RPC supports it — the bot deliberately does
   * NOT use it and keeps its own fetchSlices, which answers a different
   * question (title/actor ILIKE on the query text, plus an unfiltered
   * head-count). See the v5 migration header.
   *
   * `findings` stayed `findings` when the TABLE became `audit_findings`
   * (20260830190000). This is a word on the wire naming a category of result,
   * not a relation name, and the RPC's own guard clause is where that
   * vocabulary is defined. Moving it would have been a rename of something
   * that was never the table's name.
   */
  searchBlueprintInclude: {
    edges: 'edge',
    findings: 'finding',
    slices: 'slice',
  },
} as const

export type BlueprintContract = typeof BLUEPRINT_CONTRACT

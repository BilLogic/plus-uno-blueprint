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
    frame: 'frame',
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
    /** Labels a parser must accept for a segment, beyond the canonical one
     *  above. `layer` is the pre-rename spelling still present in every stored
     *  chunk title; `lane` is what the view will emit after a re-embed. Both
     *  map to the same breadcrumb field. */
    aliases: { lane: ['layer'] },
    // ⚠️ STILL 'Layer', deliberately. All 808 corpus chunks have "Layer: …"
    // baked into their stored title, and the title is part of the EMBEDDED
    // text — renaming this label strands every embedding until a full
    // re-embed. The bot's parser accepts BOTH labels (see `breadcrumbAliases`),
    // so this flips to 'Lane' in the same change that re-embeds the corpus.
    labels: ['Phase', 'Scenario', 'Path', 'Step', 'Layer'],
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
    'findings',
    'slices',
    'slice_items',
    'evidence_counts',
  ],

  /** Tables the bot actively reads (probe list for /health/blueprint). */
  botReadTables: ['cells', 'cell_dependencies', 'findings', 'slices'],

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
   */
  searchBlueprintParams: {
    q: 'q',
    queryEmbedding: 'query_embedding',
    matchCount: 'match_count',
    embedModel: 'embed_model',
    rrfK: 'rrf_k',
    filterPhase: 'filter_phase',
    filterScenario: 'filter_scenario',
    filterPathType: 'filter_path_type',
    filterLaneRole: 'filter_lane_role',
    granularity: 'granularity',
    include: 'include',
  },

  /**
   * `search_blueprint` OUTPUT column names the bot reads by key. Separate from
   * the underlying table columns on purpose: `cells.description` becomes
   * `cells.summary` in plan 002, but the RPC's projection is its own decision
   * and this is the name on the wire.
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
   * Values `include` accepts, and the `kind` each one tags its rows with.
   * `slices` is listed because the RPC supports it — the bot deliberately does
   * NOT use it and keeps its own fetchSlices, which answers a different
   * question (title/actor ILIKE on the query text, plus an unfiltered
   * head-count). See the v5 migration header.
   */
  searchBlueprintInclude: {
    edges: 'edge',
    findings: 'finding',
    slices: 'slice',
  },
} as const

export type BlueprintContract = typeof BLUEPRINT_CONTRACT

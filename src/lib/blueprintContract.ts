/**
 * The cross-repo blueprint contract — CANONICAL HOME.
 *
 * uno-bot (the "le goat" Slack bot, a Cloudflare Worker in the PLUS-UNO
 * kit repo) reads this app's database and deep-links back into it. Every
 * constant both sides must agree on lives HERE and is vendored bot-ward by
 * the bot repo's scripts/sync-blueprint-contract.mjs — the same one-way
 * pattern as scripts/sync-agent-skill.mjs (plugin → app). Two coordination
 * bugs shipped silently before this file existed (a renamed slices column
 * and a re-shaped findings column each made a bot read return empty for
 * weeks); a drifted copy now fails the bot's --check sync instead.
 *
 * Keep this module dependency-free: the bot compiles it in a Worker
 * context with no access to app imports.
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
    labels: ['Phase', 'Scenario', 'Path', 'Step', 'Layer'],
  },

  /**
   * Public-read surface the bot depends on (anon SELECT via RLS policy or
   * public view). Tightening any of these breaks bot reads — the bot's
   * /health/blueprint probe checks the starred subset it actually queries.
   */
  publicReadTables: [
    'phases',
    'service_scenarios',
    'steps',
    'paths',
    'layers',
    'cells',
    'cell_triggers',
    'findings',
    'slices',
    'slice_items',
    'evidence_counts',
  ],

  /** Tables the bot actively reads (probe list for /health/blueprint). */
  botReadTables: ['cells', 'cell_triggers', 'findings', 'slices'],

  /** RPCs the bot calls. DDL is versioned in this repo's supabase/migrations. */
  rpcs: {
    searchBlueprint: 'search_blueprint',
    matchCorpusChunks: 'semantic_search.match_corpus_chunks',
  },
} as const

export type BlueprintContract = typeof BLUEPRINT_CONTRACT

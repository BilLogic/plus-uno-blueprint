---
audience: developers
summary: Who can do what and where it is actually enforced, the schema tour, the single write path (wrappers + ledger), migrations workflow, and environments.
sources: supabase/DATABASE.md (superseded), supabase/migrations/20260805150000_service_account_tier.sql, supabase/migrations/20260805170000_service_tier_rpc_enforcement.sql, supabase/migrations/20260729120000_derived_layer.sql, supabase/migrations/20260730090000_derived_layer_grants_hardening.sql, src/contexts/SupabaseProvider.tsx, src/lib/authoringRpc.ts, src/lib/authoringSession.ts
last-reviewed: 2026-08-25
---

# Access and security

Read this before any task that writes data. The plain-language "who can
edit" table for humans is `product/01-overview.md`; this is the
enforcement view.

## The matrix: user type × capability × where it is enforced

| User type | Read | Agent chat | Blueprint writes | Deletes | Enforced where |
|---|---|---|---|---|---|
| Anonymous visitor (deployed site, anon key) | yes | no | no | no | RLS public-SELECT-only; RPC `EXECUTE` revoked from `anon`/`public`; UI hides everything (`canWrite`/`canAgent` false) |
| Signed-in viewer (`app_metadata.role` ≠ `service`) | yes (+ evidence/propositions) | yes, read-only tools | no | no | RESTRICTIVE RLS policies (`*_service_only`); tier guard inside every authoring RPC; agent roster filters write tools out |
| Service account (`app_metadata.role` = `service`) | yes | yes, full roster | yes, through wrappers only | human-only, via confirm dialogs | RLS + RPC guards pass; UI shows authoring surfaces |
| In-app agent (under any of the above) | as its session | — | as its session, minus deletes | **never** — no delete tool exists | tool roster (`specs.ts`), loop refusals, then the same server walls as its session |
| IDE agents / local dev | yes | — | as the dev auth user | discouraged; confirm with the human | dev sign-in is a real `authenticated` session — same RLS, same RPC guards |
| Mobile shell (any tier) | yes | yes, reading roster | no | no | UX gate only (`MobileShell` has no editors; agent roster whitelist) — the server walls above are what actually hold |

**State it plainly: UI gating is UX, not security.** `canWrite`,
`canAgent`, the hidden Edit switch, and the mobile view-only shell
(`src/contexts/SupabaseProvider.tsx`) only decide what renders. The walls
are server-side:

1. **RLS.** Public `SELECT` on blueprint tables; RESTRICTIVE
   `*_service_only` policies AND-ed over every write for `authenticated`
   (`20260805150000_service_account_tier.sql`). `is_service_account()`
   reads `app_metadata.role` from the **JWT** — set server-side in
   `auth.users.raw_app_meta_data`; users cannot self-assign
   (`user_metadata` is ignored on purpose).
2. **RPC tier guards.** The 21 authoring RPCs are SECURITY DEFINER and
   bypass RLS, so each body asserts `is_service_account()` itself
   (`20260805170000_service_tier_rpc_enforcement.sql` — injected by a DO
   block over `pg_proc` so no function is missed and none drifts).
3. **Grants.** Explicit, narrow: `EXECUTE` revoked from `public`/`anon` on
   every write RPC; column-scoped UPDATE grants on `findings` and cell
   text/spec columns; `TRUNCATE` revoked everywhere; storage tiered for
   `slice-illustrations` (`20260730090000`, `20260805170000`).

Roles live in the JWT minted at sign-in — a role change is invisible to a
live session until refresh (the provider refreshes once per boot).

## Schema tour

This section supersedes `supabase/DATABASE.md`. The ERD is
`docs/reference/erd.mmd`; the DDL snapshot is
`supabase/schema.reference.sql`; generated types are
`src/types/database.ts`.

**Core hierarchy** — `services` → `phases` (ordered, optional
`loops_to_phase_id`) → `scenarios` (`view_type`: single /
side-by-side / integrated — integrated is merged at runtime, each path
stored separately) → `paths` (`path_type`: happy / variant / exception — the
CHECK allows exactly those three; `unhappy` became `exception` and
`alternative`/`custom` became `variant` in
`20260821220000_three_kinds_of_route.sql`). Steps are scenario-scoped (`steps`), joined to paths
with per-path column order via `path_steps`. `lanes` are a path's rows;
`cells` sit at lane × step per path, with a trigger
(`cells_validate_path_match`) enforcing path integrity.
**Naming trap:** DB `steps` are blueprint *columns* (journey moments), not
lifecycle phases — phases live in `phases`.

**Cells** carry the grid label (`content` — never empty), `summary`,
`picture`, `links` (JSONB), and the spec columns from the derived-layer
migration: `function`, `form`, `value_props`, `owner`, `perceived_owner`.
Lanes carry `owner_team`/`kpis`/`tools`; phases carry impact/requirements.

**Edges** — `cell_dependencies`, `kind` = `leads_to` (this cell makes the
other happen; drawn as an arrow) or `enables` (the other must already be
true; panel-only), unique per (source, target, kind).

**Derived layer** (`20260729120000_derived_layer.sql`) — `slices` +
`slice_items` (stakeholder views), `evidence`, `propositions`, `findings`.
Design invariants worth knowing before touching them: derived tables
reference cells **softly** (uuid, no FK) so importer delete-and-reinsert
never cascades into user-authored content — `cell_keys` carry IR key-paths
for recovery; `evidence` has a hard `service_id` FK as its retention story;
"assumption" is a derived state (zero evidence rows), deliberately not
stored; findings may only be INSERTed as `open` (dedupe is "dismissed
stays dismissed", so a direct-status insert could silently suppress real
findings forever).

**Agent tables** — `agent_sessions` / `agent_messages`, open to all
`authenticated` (chatting is what viewers are for), no anon policies.

**`semantic_search` schema** — the retrieval index over the blueprint, and
this repo's to own: the DDL used to be vendored in the uno-bot repo, which
deleted it when the app took ownership. Additive and read-only with respect
to `public.*` — dropping the whole schema leaves the blueprint byte-for-byte
unchanged.

| Object | What it is |
| --- | --- |
| `corpus_chunks` | One row per embedded cell: breadcrumb `title`, the enriched `chunk` text, a 768-dim `embedding` (Vertex `text-embedding-005`), HNSW index. **RLS-sealed — nothing reads it directly.** |
| `blueprint_chunks_src` | Read-only view joining each non-empty cell up its hierarchy into the chunk + title. `service_role` only. |
| `index_meta` | Which model built the index. The hybrid RPC rejects a caller declaring a different one. |
| `match_corpus_chunks()` | Vector-only lookup. Legacy; the portal superseded it for the bot. |
| `prune_orphans()` | Deletes exactly the chunks whose cell no longer qualifies. Returns the count. |
| `index_health()` | Counts only — total, eligible, orphaned, stale, last embed. |
| `public.search_blueprint()` | **The portal — every consumer's one search entry point.** Three modes in one function: ranked search (vector + prose + structural-name, fused by reciprocal rank), scoped search (`filter_phase` / `filter_scenario` / `filter_path_type` / `filter_lane_role` apply to all retrievers), and filter-only predicate select (no `q`, no embedding → the COMPLETE matching set in structural order). Every row carries `matched_by` (which retrievers agreed) and `total_matched` (the corpus-wide count behind the top-k, so "113 cells mention Zoom, here are 15" is sayable). The legacy ilike function of this name and the transitional `blueprint_hybrid_search` are both gone. |

**The pattern to keep: narrow doors, not wide grants.** The table is sealed and
every capability is a `security definer` function that permits exactly one
operation. Reads go through `match_corpus_chunks` / `public.search_blueprint()`;
the one write that is not an upsert goes through `prune_orphans()`, whose
`WHERE` lives inside the definer so the caller chooses no rows. `service_role`
holds `INSERT, SELECT, UPDATE` on the table and **not** `DELETE` — it briefly
did (2026-08-19) and that was taken back once the caller moved to the function.
Mutating functions are granted to `service_role` alone; `anon` reaches only the
counting and reading ones.

Two failure modes this schema has actually produced, both worth remembering
because neither looked like a failure:

- **A missing grant that only broke the last step.** The nightly backfill's
  orphan prune 403'd for two nights while embeddings stayed current, so the
  data looked healthy and 43 chunks for hard-deleted cells kept answering
  searches. Anything derived needs a health check that is *read* somewhere —
  hence `index_health()` and the bot's `/debug/blueprint`.
- **Similarity is not a confidence score.** Measured across a 26-case set,
  questions with no answer in the blueprint scored 0.607–0.654 while genuine
  hits reached down to 0.565. No threshold separates them. Consumers judge by
  which retrievers corroborated (`matched_by`), never by score.

A change to `blueprint_chunks_src` alters chunk *text* without touching
`cells.updated_at`, so it requires a **full** re-embed — the nightly pass is
incremental and would skip every row. Run the uno-bot repo's *embed blueprint*
workflow with `full: true`.

## Authoring writes

Single owner of the write path — other docs link here.

Every **blueprint-content** write goes through one of the wrapper modules,
never a raw table write from a component, a context or a hook:

- `src/lib/authoringRpc.ts` — the structural surface; every function is a
  SECURITY DEFINER RPC. The app holds *operations*, not tables. Treat all
  of them as pessimistic: re-read after a structural write
  (`invalidateStructure()`), because cascades cannot be mirrored client-side.
- **The `src/lib/*Mutations.ts` family** — ten modules today, one per subject:
  `cellContentMutations` / `cellSpecMutations` (cell text and spec columns via
  column-level grants; optimistic, the exception), `sliceMutations` (slices and
  frames), `evidenceMutations`, `stakeholderMutations`, and the five spec
  modules `serviceSpecMutations`, `scenarioSpecMutations`, `phaseSpecMutations`,
  `laneSpecMutations`, `stepSpecMutations`. All share one shape: direct table
  write under row grants, recorded in the session ledger with a captured
  inverse.

Three modules write tables and are deliberately *not* in that set. Count them
when you count writers — there are fourteen write surfaces, not eleven:

- `src/lib/revertChange.ts` — the ledger's own inverse-applier. It cannot
  record a change; recording one is what it undoes.
- `src/lib/agent/persistence.ts` — `agent_sessions` / `agent_messages`. Agent
  transcript, not blueprint data; nothing in it is revertable.
- `src/lib/agent/tools/registry.ts` (`create_finding` / `update_finding`) —
  writes `findings` directly, with no ledger entry and no captured inverse.
  Unlike the two above this is **not** clearly intended: `src/lib/writeBoundaryContract.test.ts`
  scans only `components/`, `contexts/` and `hooks/`, so a write from `src/lib`
  passes unseen. Treat it as an open question, not a pattern.

What the wrappers buy, and why bypassing them is never acceptable:

- **The session ledger** (`src/lib/authoringSession.ts`): every write is
  recorded with args and, where capturable, an inverse (`RevertSpec`) —
  addressable per-row revert, not a positional undo stack. `WriteFn` is a
  closed union so adding an operation without teaching `describeChange`
  is a compile error, not a mislabeled row.
- **Zero-row writes are failures.** A write that matches no rows resolves
  successfully at the client level while changing nothing —
  `requireRowsWritten` (`src/lib/optimisticConcurrency.ts`) turns that
  into an error. Keep it on any new mutation.
- **Reverts are identity-keyed** and pass `record: false` so undoing an
  edit never logs a new edit. Read `authoringSession.ts` and
  `revertChange.ts` before touching reverts or deletes.
- **A failed write is said out loud.** `reportWriteFailure`
  (`src/lib/writeFailures.ts`) is the one surface for a failure whose
  control is already gone — a cell delete closes its own menu, ⌘Z has no
  control at all. A path that still has its form or dialog on screen keeps
  reporting there (`CreatePhaseDialog` is the pattern). Neither channel is
  the console: a write that only logs reads to the user as a success.
- **Deletes are human-only.** The agent tool surface contains no delete;
  the UI routes deletes through impact preview (`deletionImpact()` in
  `authoringRpc.ts`, via `deletionSafety.ts`) and a confirm dialog. The agent's
  read-only counterpart is `measure_deletion_impact`. Never automate one.

The non-negotiable invariants are inline in `AGENTS.md` — they hold even
if this doc is never read.

## Migrations workflow

Append-only timestamped SQL in `supabase/migrations/` — never edit an
applied migration. Locally: `npm run supabase:reset` replays migrations +
seed. Hosted: `supabase link` once, then `supabase db push`. After any
schema change regenerate types (`npm run supabase:types` hosted /
`supabase:types:local`) and refresh `supabase/schema.reference.sql` if the
DDL shape moved. New RPCs must follow the house pattern: SECURITY DEFINER,
pinned `search_path`, `EXECUTE` revoked from `public`/`anon`, and the
`is_service_account()` guard first in the body.

## Environments

Single owner of environment facts — operations links back here.

- **Local**: Docker Supabase (`npm run supabase:start`); URL + anon key
  from the CLI output into `.env`.
- **Hosted**: one project; values from the dashboard. The deployed site
  ships only the anon key and has no sign-in UI — visitors are read-only
  by construction.
- **Local authoring** = dev sign-in: real credentials for a dev auth user
  in `.env.local` (see `.env.example` for the variable names), auto
  sign-in on boot. A real session through the front door — RLS sees
  `authenticated` exactly as designed. **Never author with the
  service-role key**; it bypasses policy and belongs in no browser bundle.
- Secrets live only in gitignored `.env`/`.env.local` or browser
  localStorage — never in committable files, chat, or the deploy
  environment. Never write actual key values into docs.

Inviting people and flagging service accounts is an operations task —
see [operations](operations.md#inviting-people).

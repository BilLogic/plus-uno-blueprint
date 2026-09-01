---
audience: developers
summary: Who can do what and where it is actually enforced, the schema tour, the single write path (wrappers + ledger), migrations workflow, and environments.
sources: supabase/DATABASE.md (superseded), supabase/migrations/20260805150000_service_account_tier.sql, supabase/migrations/20260805170000_service_tier_rpc_enforcement.sql, supabase/migrations/20260729120000_derived_layer.sql, supabase/migrations/20260730090000_derived_layer_grants_hardening.sql, src/contexts/SupabaseProvider.tsx, src/lib/authoringRpc.ts, src/lib/authoringSession.ts, src/lib/authoringLog.ts, supabase/migrations/20260830200000_every_authoring_write_leaves_a_record.sql, src/lib/findingMutations.ts, src/lib/writeBoundaryContract.test.ts, supabase/migrations/20260805120000_findings_canvas_writes.sql, supabase/migrations/20260830290000_a_panel_writes_its_own_columns.sql, scripts/check-rls-posture.mjs
last-reviewed: 2026-08-31
---

# Access and security

Read this before any task that writes data. The plain-language "who can
edit" table for humans is `product/01-overview.md`; this is the
enforcement view.

## The matrix: user type × capability × where it is enforced

| User type | Read | Agent chat | Blueprint writes | Deletes | Enforced where |
|---|---|---|---|---|---|
| Anonymous visitor (deployed site, anon key) | yes | no | no | no | RLS public-SELECT-only; RPC `EXECUTE` revoked from `anon`/`public`; UI hides everything (`canWrite`/`canAgent` false) |
| Signed-in viewer (`app_metadata.role` ≠ `service`) | yes (+ evidence/business model) | yes, read-only tools | no | no | RESTRICTIVE RLS policies (`*_service_only`); tier guard inside every authoring RPC; agent roster filters write tools out |
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
   (`user_metadata` is ignored on purpose). The two agent tables use
   neither, gating per user instead (see the schema tour); that exception
   is asserted rather than granted. `stakeholders` was a third shape until
   #174 — no companion, the call inside the permissive policy — which was
   equally closed and stopped being closed the moment anyone added a
   second permissive policy beside it, because permissive policies OR and
   restrictive ones AND. `20260830180000` gave it the pair every other
   table has; the effect is identical and the algebra is not.
   `scripts/check-rls-posture.mjs` still recognises the companion-less
   shape, because recognising it is what stops the check reporting three
   false findings against a table that is correctly locked.
2. **RPC tier guards.** The 21 authoring RPCs are SECURITY DEFINER and
   bypass RLS, so each body asserts `is_service_account()` itself
   (`20260805170000_service_tier_rpc_enforcement.sql` — injected by a DO
   block over `pg_proc` so no function is missed and none drifts).
3. **Grants — the only thing in Postgres that speaks about columns.**
   RLS decides *who* may write and is silent on *which columns*, and the
   app runs as exactly the role the restrictive policy admits. So the
   grant is the whole of the write boundary between a panel and an RPC.
   `EXECUTE` is revoked from `public`/`anon` on every write RPC; storage
   is tiered for `slice-illustrations` (`20260730090000`,
   `20260805170000`). `anon` holds no INSERT/UPDATE/DELETE/TRUNCATE
   anywhere in `public` since `20260828121000` — it had them on twelve
   tables, unreachable only because no permissive write policy named
   `anon`, which is the shape a one-word policy edit turns into an open
   write.

   **Every `authenticated` UPDATE is column-scoped since
   `20260830290000`.** Before it, thirteen tables held a TABLE-level
   UPDATE — which covers every column, foreign keys included — so a
   service account could reparent a path with a plain update and
   `authoring_changes` recorded nothing. A column grant does not narrow a
   table grant, it widens an empty one, so the careful lists beside those
   thirteen were decoration; the fix is a REVOKE first and the grant
   second. Not a public exposure, an integrity boundary between the app's
   own two write paths. **UPDATE only, deliberately**: a row names its
   parent when it is created, so INSERT has to reach the foreign keys.
   Identity is chosen once and never changed, which is what makes UPDATE
   the privilege that reparents.

   Three key columns stay UPDATE-able and each is asserted rather than
   allowed (`IDENTITY_GRANTS` in `scripts/check-rls-posture.mjs`):
   `lanes.stakeholder_id`, an association that moves no lane; and
   `agent_sessions.id` / `agent_messages.session_id`, which PostgREST
   names in the `ON CONFLICT DO UPDATE` set list of the upsert the chat
   saves through.

   Two grants are load-bearing in a way that is easy to mistake for
   dead weight. `update (updated_at)` on `touchpoints` and
   `cell_touchpoints` exists because `sync_cell_touchpoints`,
   `restore_cell_touchpoints`, `place_touchpoint_detail`,
   `restore_touchpoint_detail` and `sync_cell_resources` are **SECURITY
   INVOKER** — they write under the caller's grants, and a column
   privilege is checked against the statement's SET LIST rather than
   against what it changes. The `updated_at = now()` stamps in those
   bodies are why. Anything SECURITY DEFINER bypasses grants entirely
   and needs no column here at all.

   **`TRUNCATE` is NOT revoked everywhere**, whatever this section used to
   say: `authenticated` still holds it on nine tables, both agent tables
   included. TRUNCATE bypasses RLS, so there the grant is the only gate.
   PostgREST cannot issue it, which is why it has been survivable; it is
   named in `scripts/check-rls-posture.mjs` under what that check
   deliberately does not assert, and closing it is its own change.
4. **A check that fails.** `npm run check:rls-posture:live` asks the
   database, not the files. Seven assertions: RLS on for every base
   table, no permissive write policy to `anon`/`public`, no anon write
   grant, every reachable authenticated write either service-gated or
   holding a documented exemption that must prove its substitute gate,
   no table-level UPDATE for `authenticated` anywhere, every UPDATE-able
   column named in `PANEL_COLUMNS`, and no primary or foreign key
   UPDATE-able outside `IDENTITY_GRANTS`. It needs `SUPABASE_DB_URL`, so
   like `check:contract:live` and `check:identifiers:live` it is
   manual — a privileged database credential does not belong in this
   repository's CI. `scripts/tests/rls-posture.test.mjs` is what runs on
   every PR, and it exists because green against production and green
   against nothing look the same: it shows the check going RED on each
   shape it exists for, including a table granting a column outside its
   panel's set and a table granting a foreign key.

5. **A check on the front door.** `npm run check:auth-posture` asks
   GoTrue whether a stranger can mint an `authenticated` token: public
   sign-up off, anonymous sign-in off, no external provider enabled.
   Everything in point 4 is about what that role may write; this is
   about who may become it, and until #60 is closed **the answer is
   anyone** — `disable_signup` is `false` on the production project.

   It is the one live posture check that needs no privileged
   credential. GoTrue publishes its configuration to the anon key, and
   the anon key already ships in the deployed bundle, so this check is
   not condemned to be manual the way `check:rls-posture:live` is. It
   runs in `gates.yml` from repository variables.

   It is **advisory there** (`continue-on-error`) only because it is
   currently red and a hard failure would block every pull request on a
   dashboard toggle no contributor can reach. That line comes out when
   #60 closes; the workflow says so where it sits.

   `mailer_autoconfirm` is deliberately not asserted. Requiring email
   confirmation raises the cost of self-provisioning to owning a
   mailbox, which an attacker does — a speed bump, not a gate, and
   asserting it would let someone satisfy the check by tightening the
   wrong thing.

Roles live in the JWT minted at sign-in — a role change is invisible to a
live session until refresh (the provider refreshes once per boot).

## Schema tour

This section supersedes `supabase/DATABASE.md`. The ERD is
`docs/reference/erd.mmd`; the DDL snapshot is
`supabase/schema.reference.sql`; generated types are
`src/types/database.ts`.

**Core hierarchy** — `services` → `phases` (ordered, optional
`loops_to_phase_id`) → `scenarios` (`layout`: single / stacked —
merged is a session-only display, never stored; each path is stored
separately) → `paths` (`kind`: happy / variant / exception — the
CHECK allows exactly those three; `unhappy` became `exception` and
`alternative`/`custom` became `variant` in
`20260821220000_three_kinds_of_route.sql`). Steps are scenario-scoped (`steps`), joined to paths
with per-path column order via `path_steps`. `lanes` are a path's rows;
`cells` sit at lane × step per path, with a trigger
(`cells_validate_path_match`) enforcing path integrity.
**Naming trap:** DB `steps` are blueprint *columns* (journey moments), not
service phases — phases live in `phases`.

**Cells** carry the grid label (`content` — never empty), `summary`,
`frame` (one image on one cell), and the spec columns that shipped in
`20260729120000`: `function`, `form`, `value_props`, `owner`,
`perceived_owner`.
Lanes carry `owner_team`/`kpis`/`tools`; phases carry impact/requirements.

**Resources** — `resources`, one row per thing a cell points at. It replaced
`cells.links` (a JSONB array) in `20260830280000`, which held three unrelated
things at once: resources, touchpoint detail and provenance citations. Each
row attaches to a cell **or** to one `cell_touchpoints` placement and never
both, enforced by `num_nonnulls(cell_id, cell_touchpoint_id) = 1`. Writes go
through `sync_cell_resources`, which replaces a cell's list in one
transaction — the position constraint is deferrable and a statement per row
would trip it on a reorder.

**Edges** — `cell_dependencies`, `kind` = `leads_to` (this cell makes the
other happen; drawn as an arrow) or `enables` (the other must already be
true; panel-only), unique per (source, target, kind).

**About the board, not part of it** (`20260729120000_derived_layer.sql` — the
filename is where the retired name "derived layer" survives) — `slices` +
`slides` (stakeholder views), `evidence`, `audit_findings`. Each has an owner
named by the write surface — the slice, the audit, and evidence which is
nobody's; see CONTEXT.md, which records why two attempts at a collective noun
were both wrong of half the set. `business_models` is not among
them — it is the service's spec row.
Design invariants worth knowing before touching them: all four
reference cells **softly** (uuid, no FK) so importer delete-and-reinsert
never cascades into user-authored content — `cell_keys` carry IR key-paths
for recovery; `evidence` has a hard `service_id` FK as its retention story;
"assumption" is a derived state (zero evidence rows), deliberately not
stored; findings may only be INSERTed as `open` (dedupe is "dismissed
stays dismissed", so a direct-status insert could silently suppress real
findings forever).

**Agent tables** — `agent_sessions` / `agent_messages`, gated PER USER, not
per tier. Chatting is what a viewer account is for, so a service gate here
would close a confidentiality hole by deleting the feature; the gate is
`agent_sessions.user_id` instead, reached through `session_id` for messages,
via `public.owns_agent_session(uuid)`. No anon policies. A NULL `user_id` means
the row predates ownership (2026-08-28) and is readable by service accounts
only — 33 sessions and 340 messages are in that state, deliberately not
backfilled because nothing in either table records who wrote it. New rows
cannot join them: the insert policy is the strict `user_id = auth.uid()`.
Before `20260828120000` there was one blanket `for all to authenticated using
(true)` policy per table and any signed-in account could read, edit or delete
everybody's transcript (#60, #136).

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
| `public.search_blueprint()` | **The portal — every consumer's one search entry point.** Three modes in one function: ranked search (vector + prose + structural-name, fused by reciprocal rank), scoped search (`filter_phase` / `filter_scenario` / `filter_path_kind` / `filter_lane_role` apply to all retrievers), and filter-only predicate select (no `q`, no embedding → the COMPLETE matching set in structural order). Every row carries `matched_by` (which retrievers agreed) and `total_matched` (the corpus-wide count behind the top-k, so "113 cells mention Zoom, here are 15" is sayable). The legacy ilike function of this name and the transitional `blueprint_hybrid_search` are both gone. |

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
- **The `src/lib/*Mutations.ts` family** — thirteen modules today, one per
  subject: `cellContentMutations` / `cellSpecMutations` (cell text and spec
  columns via column-level grants; optimistic, the exception), `sliceMutations`
  (slices and frames), `evidenceMutations`, `findingMutations`,
  `stakeholderMutations`, `touchpointMutations` (a catalog rename, which is one
  RPC because both halves have to move together), `unplacedTouchpointMutations`
  (placing or discarding a detail that names nothing its cell shows, both RPCs
  for the same reason), and the five spec modules `serviceSpecMutations`,
  `scenarioSpecMutations`, `phaseSpecMutations`, `laneSpecMutations`,
  `stepSpecMutations`. All share one shape: a write under row grants — direct
  or through one RPC — recorded in the session ledger with a captured inverse.

Two modules write tables and are deliberately *not* in that set. Count them
when you count writers — there are sixteen write surfaces, not fourteen:

- `src/lib/revertChange.ts` — the ledger's own inverse-applier. It cannot
  record a change; recording one is what it undoes.
- `src/lib/agent/persistence.ts` — `agent_sessions` / `agent_messages`. Agent
  transcript, not blueprint data; nothing in it is revertable.

`src/lib/agent/tools/registry.ts` used to be a third, and was the one entry
here marked as an open question rather than a decision: `create_finding` and
`update_finding` wrote `audit_findings` from the dispatcher, with no ledger entry and
no captured inverse, because `writeBoundaryContract.test.ts` scanned only
`components/`, `contexts/` and `hooks/` and a write from `src/lib` passed
unseen. Both now go through `findingMutations.ts`, and the guard walks all of
`src/` with its exemptions named one by one.

**A created finding is the one write with no revert, and the reason is a
grant.** DELETE on `audit_findings` is revoked from `authenticated` and `anon` with
no policy to reach it — supersede and triage are status flips. `resolved` and
`dismissed` are the only states that quiet a finding and both are human
judgements, `dismissed` permanently so (the dedupe rule is "dismissed stays
dismissed", which is why `audit_findings_insert_auth` refuses an insert that is not
`open`). So the insert records a ledger entry with no revert control, which is
the honest shape; every `audit_findings` *update* captures the prior value of exactly
the columns it wrote.

What the wrappers buy, and why bypassing them is never acceptable:

- **The session ledger** (`src/lib/authoringSession.ts`): every write is
  recorded with args and, where capturable, an inverse (`RevertSpec`) —
  addressable per-row revert, not a positional undo stack. `WriteFn` is a
  closed union so adding an operation without teaching `describeChange`
  is a compile error, not a mislabeled row.
- **The durable change log** (`public.authoring_changes`, appended through
  `src/lib/authoringLog.ts`): the same entry, written to the database, so
  closing the tab stops erasing the record of what changed. It carries the
  operation, its arguments, its inverse, the author, and the agent session
  when an agent made the write. **Audit-only** — nothing replays the stored
  inverse; the ledger above is still what undo reads. The log has two writers
  and they must not overlap: the five delete RPCs and `remove_lanes` archive
  their own row, payload included, inside the transaction that destroys the
  rows, and the client skips its append for exactly those six
  (`ARCHIVED_BY_THE_DATABASE`). `scripts/tests/authoring-log.test.mjs` holds
  that set to the functions the migrations actually define.
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
applied migration, applied with
`npm run apply:pending -- --from=<version> --apply`, which writes the ledger
row inside the same transaction. Neither `supabase db reset` nor `db push`
works here — see
[ADR 0009](../adr/0009-the-migration-series-is-a-narrative.md). After any
schema change edit `src/types/database.ts` to match and refresh
`supabase/schema.reference.sql` if the DDL shape moved. New RPCs must follow the house pattern: SECURITY DEFINER,
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

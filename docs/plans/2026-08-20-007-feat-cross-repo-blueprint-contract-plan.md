---
title: "The cross-repo contract — switch uno-bot to `include`, and stop the renames breaking it"
type: feat
status: active
date: 2026-08-20
repos: uno-blueprint, plus-uno
brief: docs/plans/2026-08-20-001-spec-layer-brief.md
related: docs/plans/2026-08-20-002-refactor-database-vocabulary-plan.md
---

# Cross-repo contract

Two asks landed together — *switch uno-bot to `search_blueprint`'s new
`include` parameter*, and *rename `filter_layer_role` across both repos in one
window*. Reading both repos turned up **one of those is not a risk at all, and
a different rename is.** This plan covers what is actually true.

> **Where uno-bot lives.** `plus-uno` repo →
> `plus-vibe-coding-starting-kit/agents/uno-bot`. A Cloudflare Worker. It reads
> this app's Supabase directly with the anon key.

---

## What the audit found

### ✅ 1. `filter_layer_role` is not a cross-repo risk

Grepped the **entire** `plus-vibe-coding-starting-kit` tree — every `.ts`,
`.js`, `.json`, `.md`, excluding `node_modules`. `filter_layer_role` appears
**once**, and it is prose:

```ts
// agents/uno-bot/src/integrations/blueprint.ts:493
// filter_layer_role), a filter-only predicate mode, and total_matched — the
```

The bot never passes it. `tryHybrid` sends exactly four keys —
`q`, `query_embedding`, `match_count`, `embed_model`
(`blueprint.ts:509-521`) — and `tryRpc` sends one, `{ q }` (`:644-648`).

**So [plan 002](2026-08-20-002-refactor-database-vocabulary-plan.md)'s risk
table is wrong.** It rates *"`filter_layer_role` rename breaks uno-bot"* as
**High — cross-repo** and proposes keeping the old parameter name forever to
avoid it. Neither is needed. Renaming it to `filter_lane_role` costs one
comment edit in the bot. **Corrected in that plan by this one.**

### 🔴 2. `cell_triggers` → `cell_links` *is* the cross-repo break

Plan 002 Phase 2 calls this *"lower risk."* It is the highest risk in the
whole rename, because uno-bot reads the table three different ways:

```ts
// agents/uno-bot/src/integrations/blueprint.ts:914-920
const select =
  "source_cell_id,target_cell_id,kind,label,note," +
  "source:cells!cell_triggers_source_cell_id_fkey(content)," +   // ← FK NAME
  "target:cells!cell_triggers_target_cell_id_fkey(content)";
const url = `${base}/rest/v1/cell_triggers` + …                  // ← TABLE NAME
```

```ts
// agents/uno-bot/src/generated/blueprint-contract.ts:52-67
publicReadTables: [… 'cell_triggers' …],                          // ← RLS probe
botReadTables:    ['cells', 'cell_triggers', 'findings', 'slices'],// ← /health probe
```

Three failure surfaces, and **only the third fails loudly**. The embed hint is
a PostgREST *string*: rename the table without renaming the FK constraints and
the request 400s at runtime, `fetchEdges` logs a warning and returns `[]`
(`:923-926`) — and the bot reports "no dependencies" for cells that have them.

That is not hypothetical. `blueprint.ts:1005-1013` documents the exact same bug
happening before: *"The old `cell_id=in.(…)` filter asked for a column that does
not exist: PostgREST 400s, fetchRows logs a warning and returns [], and the tool
reported 'no findings' for cells that had them."*

### 🔴 3. The RPC's output column names are the bot's wire format

`search_blueprint` returns a column literally named `description`
(`RETURNS TABLE(… description text …)`), and the bot reads it by that name:

```ts
// agents/uno-bot/src/integrations/blueprint.ts:539
description: str(r.description),
```

Plan 002 Phase 4 renames `cells.description` → `cells.summary`. **The column
rename is safe; renaming the RPC's *output* column is not.** Decide explicitly
which happens, because the RPC's projection is a separate choice from the
table's column name.

### 🟡 4. `include` is not a drop-in for what the bot does today

The parameter shipped and works, but reading its body against the bot's three
reads shows two gaps and one genuine mismatch.

| Bot read | `include` equivalent | Verdict |
|---|---|---|
| `fetchEdges` (`:908`) | `include:edges` | ⚠️ **gap** — the RPC emits raw uuids |
| `fetchFindings` (`:1005`) | `include:findings` | ⚠️ **gap** — no status filter |
| `fetchSlices` (`:1029`) | `include:slices` | ❌ **different question** — keep the bot's |

**Gap A — edges lose their text.** The RPC builds its snippet from ids:

```sql
t.source_cell_id::text || ' --' || coalesce(t.kind,'trigger') ||
  '--> ' || t.target_cell_id::text || coalesce(' "' || t.label || '"', '')
```

The bot resolves both ends to cell **content** and hands the model
`"Enters the breakout room" --trigger--> "Greets the student"`
(`blueprint.ts:930-950`). Switching as-is would replace readable prose with
`8f2c…-…-… --trigger--> 41ab…-…-…`, which no model can cite. **The RPC must
join `cells` for source and target content first.**

**Gap B — findings lose the triage invariant.** The RPC's findings branch has
no status predicate; the bot filters deliberately:

```ts
// agents/uno-bot/src/integrations/blueprint.ts:1012-1019
// Open findings only: the app's triage invariant is "dismissed stays
// dismissed" — re-surfacing closed findings in Slack re-litigates a call
// the team already made in-app…
`cell_ids=ov.{…}&status=eq.open`
```

All 5 findings are `open` today, so nothing would visibly break — and that is
exactly why it must be fixed before the first dismissal, not after.

**Mismatch C — slices are answering a different question.** The RPC includes a
slice when one of its `slice_items` overlaps a hit cell. The bot matches
`title`/`actor` ILIKE against the **query text** and adds an unfiltered
head-count so *"the blueprint has N slices"* stays true (`:1042-1052`). Those
are not the same retrieval. **Leave `fetchSlices` alone.**

---

## The call arithmetic, exactly

`agents/uno-bot/src/tools/blueprint-search.ts:99-103` fires each read
separately. External subrequests per grounded search, with
`include=[edges,findings,slices]`:

| | Today | After |
|---|---|---|
| `embedText` (Vertex) | 1 | 1 |
| `search_blueprint` RPC | 1 | 1 |
| `fetchEdges` | 1 | **0** |
| `fetchFindings` | 1 | **0** |
| `fetchSlices` (+head-count when the query has words) | 1–2 | 1–2 |
| **total** | **5–6** | **3–4** |

This matters because of a hard ceiling the Worker already meters:

> `agents/uno-bot/src/net.ts:3` — *"Cloudflare's free plan caps ONE Worker
> invocation at 50 EXTERNAL subrequests."*

Two fewer per search, on a budget that also has to pay for Slack, Notion,
GitHub and delivery in the same invocation.

---

## Proposed solution

### Phase 1 — fix the RPC (uno-blueprint only, ships alone, breaks nothing)

Additive migration. `include` defaults to `'{}'`, so no existing caller sees
any change.

```sql
-- supabase/migrations/*_search_blueprint_include_fidelity.sql
-- edges: carry the endpoints' text, not their ids
… join public.cells sc on sc.id = t.source_cell_id
  join public.cells tc on tc.id = t.target_cell_id
  -- snippet becomes:
  --   left(sc.content,120) || ' --' || kind || '--> ' || left(tc.content,120)
  -- and lnk gains 'source_content' / 'target_content'

-- findings: honour the triage invariant
… where 'findings' = any(inc)
    and f.status = 'open'
    and f.cell_ids && array(select rid from hit_cells)
```

- [ ] Edge rows carry source and target **content**, capped at 120 chars each —
      the same cap `blueprint.ts:929` already applies
- [ ] Findings rows are **open only**
- [ ] `slices` is left exactly as it is — nothing switches to it
- [ ] A read-back test proves an edge row's snippet contains no `-` uuid shape

### Phase 2 — teach the contract to carry parameter names

The mechanism to prevent all of this **already exists and is one field short.**

```
uno-blueprint  src/lib/blueprintContract.ts          ← CANONICAL, 76 lines
                    │  vendored one-way by
                    ▼
plus-uno       agents/uno-bot/scripts/sync-blueprint-contract.mjs --check
               agents/uno-bot/src/generated/blueprint-contract.ts
```

Its own header says why it exists:

> *"Two coordination bugs shipped silently before this file existed (a renamed
> slices column and a re-shaped findings column each made a bot read return
> empty for weeks); a drifted copy now fails the bot's `--check` sync."*

It carries `rpcs.searchBlueprint`, `publicReadTables`, `botReadTables` — but
**not the RPC's parameter names or its output column names**, which is the
exact surface plan 002 is about to move.

- [ ] Add `rpcParams.searchBlueprint` — every parameter the bot may pass
- [ ] Add `rpcColumns.searchBlueprint` — the output columns the bot reads by
      name, `description` first among them
- [ ] Add `fkConstraints` — the embed-hint names
      (`cell_triggers_source_cell_id_fkey`, `…_target_…`), because a PostgREST
      embed hint is a string and nothing else type-checks it
- [ ] The bot **uses** these constants instead of string literals, so a drifted
      copy is a compile error rather than a runtime 400

Do this **before** plan 002 Phase 1. It is the only thing that turns the next
rename from a coordination exercise into a failing check.

### Phase 3 — switch the bot (plus-uno)

```ts
// agents/uno-bot/src/tools/blueprint-search.ts
// the tool ALREADY has an `include` concept — pass it through
const rpcInclude = include.filter((i) => i === "edges" || i === "findings");
// …edges and findings now arrive inside the search result rows,
//   partitioned by row.kind === 'edge' | 'finding'
const sliceRead = await optional(include.includes("slices"),
  () => fetchSlices(env, query), "slices");   // unchanged
```

- [ ] `searchBlueprint` passes `include` through to the RPC
- [ ] Result rows are partitioned on `kind`: `cell` → hits, `edge` → edges,
      `finding` → findings
- [ ] `fetchEdges` and `fetchFindings` are **kept, not deleted** — they remain
      the fallback when the RPC 404s (`PGRST202`), which `tryHybrid:557-560`
      already handles for the whole function
- [ ] `fetchSlices` untouched
- [ ] The stale comment at `blueprint.ts:493` is corrected

### Phase 4 — the renames, in the window the contract now protects

- [ ] `filter_layer_role` → `filter_lane_role` — app side, plus one bot comment
- [ ] `cell_triggers` → `cell_links` **and its two FK constraints**, in one
      migration. Then the bot's URL, embed hints and both contract lists
- [ ] Decide `search_blueprint`'s output column: keep `description`, or rename
      to `summary` and ship the bot in the same window

---

## System-wide impact

**Interaction graph.** A Slack mention → `agent-runner` → the blueprint tool →
`searchBlueprint` → `embedText` (Vertex, service-account auth) → the RPC.
Every outbound call passes `countedFetch`, which meters against the 50-cap and
**throws** `SubrequestBudgetError` rather than silently truncating
(`src/net.ts:48-62`). Removing two calls per search widens the margin for the
delivery half of the turn, which runs unmetered.

**Error propagation.** Three distinct failure modes, and they must stay
distinct:

| Failure | Today | Must stay |
|---|---|---|
| RPC absent (`404` / `PGRST202`) | fall back to the ladder | fall back — never fail the search |
| Table/embed wrong (`400`) | warn + `[]` | ⚠️ **this is the silent one.** Phase 2's constants are the fix |
| Any other status | throw | throw |

**State lifecycle.** All reads. Nothing persists, so no partial-failure
cleanup — the only "state" is the blueprint index cache, which
`blueprint.ts:813` documents as deliberately not busted by `searchBlueprint`.

**API surface parity.** The canvas agent reads the same RPC through
`src/lib/agent/tools/read.ts`. It does **not** use `include` — it has
`list_cell_links` and `list_findings` as first-class tools. Phase 1's edge
content change improves both callers; Phase 1's open-only findings filter must
be checked against the canvas agent's expectations before it lands.

**Integration scenarios unit tests will not catch:**

1. Rename `cell_triggers` without the FK constraints → the bot returns `[]` and
   says "no dependencies." Only a live request catches it.
2. A finding is dismissed in-app → it must stop appearing in Slack. Impossible
   to test today: all 5 rows are `open`. **Insert a closed row in a test.**
3. `include:edges` on a query whose hits have no edges → must return the cell
   rows unchanged, not an empty result.
4. RPC returns `PGRST202` mid-rollout → the bot must fall back to `fetchEdges`,
   not lose edges.

---

## Acceptance criteria

- [ ] `include:edges` rows carry readable source and target text
- [ ] `include:findings` returns open findings only, proven with a closed row
- [ ] `fetchSlices` is byte-identical to today
- [ ] `blueprintContract.ts` carries RPC parameter names, output column names
      and FK constraint names; the bot references them instead of literals
- [ ] `npm run check:contract` fails on a hand-edited vendored copy
- [ ] External subrequests per grounded search drop from 5–6 to 3–4, measured
      by the existing meter, not estimated
- [ ] `filter_layer_role` appears nowhere in either repo
- [ ] `/health/blueprint` probes pass against the renamed tables
- [ ] Retrieval evals stay 26/26

## Success metrics

| | Now | After |
|---|---|---|
| Subrequests per grounded search | 5–6 | **3–4** |
| Cross-repo identifiers checked by CI | tables + RPC name | **+ params, output columns, FK names** |
| Ways `cell_triggers` → `cell_links` can break silently | 3 | **0** |

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| FK constraints renamed but embed hints missed | **Critical** — fails silently, returns `[]` | Phase 2's `fkConstraints` constant + a live smoke request per embed |
| RPC output column renamed under the bot | High | It is a separate decision from the table column; make it explicitly |
| `include` ships before the fidelity fix | High | Phase 1 precedes Phase 3; edges would degrade to uuids |
| Closed findings resurface in Slack | Medium — invisible today | Test with a closed row, not with production data |
| Deploy skew mid-window | Medium | Both fallbacks stay; the bot degrades, never fails |

## Sources

- `agents/uno-bot/src/integrations/blueprint.ts` — `:493` the stale comment,
  `:499-560` `tryHybrid`, `:637-655` `tryRpc`, `:908-951` `fetchEdges`,
  `:961-999` `fetchRows`, `:1005-1027` `fetchFindings`, `:1029-1057` `fetchSlices`
- `agents/uno-bot/src/tools/blueprint-search.ts:99-103` — the three separate reads
- `agents/uno-bot/src/net.ts:1-30` — the 50-subrequest meter
- `agents/uno-bot/src/generated/blueprint-contract.ts` + `scripts/sync-blueprint-contract.mjs`
- `src/lib/blueprintContract.ts` — canonical, 76 lines
- `search_blueprint` signature and body read from the live database on 2026-08-20

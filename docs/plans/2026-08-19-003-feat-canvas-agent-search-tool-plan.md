---
title: "Give the canvas agent the search portal — one name, on a trigger"
type: feat
status: ready-not-authorized
date: 2026-08-19
repos: uno-blueprint (agent harness), plus-uno (uno-bot parity)
depends-on: public.search_blueprint portal (shipped 2026-08-19, PR #53)
---

# The canvas agent's door to `search_blueprint`

> **STATUS: READY, DELIBERATELY NOT AUTHORIZED.** The design below is complete
> and the backend already exists. It should **not** be built until the trigger
> in [§ Build trigger](#build-trigger) fires. Four independent reviews reached
> that conclusion on evidence; this plan records the design so the work is a
> half-day when demand appears, instead of a redesign.

## Overview

`public.search_blueprint` is now the blueprint's one search portal — ranked
fusion (vector + prose + structural-name), scope filters, a filter-only
predicate mode, and `total_matched`. It is granted to `anon`, `authenticated`
and `service_role`, so the canvas agent can already reach it. It has exactly
**one consumer**: uno-bot.

This plan defines the canvas agent's tool over that portal, the harness changes
to support it, and — as importantly — where the skill playbooks must forbid its
use.

## Problem statement

**P1 — Navigation already works for the top two levels; the bottom three are
the gap.** An earlier draft claimed the agent "cannot find anything." Wrong, and
worth stating precisely, because it changes what this tool is for.

`list_scenarios` returns **all 6 phases and 22 scenarios with ids and
descriptions for ~1,100 tokens** — a complete structural index. So "take me to
the Warm-Up scenario" resolves cleanly: list → match the name → `open_scenario(id)`.
That is why all 46 observed user turns succeeded.

What it does NOT cover:

| Level | Findable by name today? |
|---|---|
| Phase (6), Scenario (22) | ✅ `list_scenarios`, ~1.1k tokens |
| **Path (38)** | ⚠️ only inside `get_blueprint`, which needs the scenario you are trying to find |
| **Step, Lane** | ⚠️ same |
| **Cell, by content** | ❌ nothing |

`focus_cell`, `open_cell_panel` and `annotate_cells` all take cell IDs the agent
can only obtain by loading a whole scenario it must already have identified.

**P2 — "Does this exist?" is unanswerable, and the product doc makes it
load-bearing.** `docs/product/06-product-design-on-blueprints.md`: *"If the cell
you need doesn't exist, that is itself a discovery… designing against an
unmapped moment is designing against a guess."* Today that instruction can only
be followed by someone who already knows which scenario to open.

**P3 — One portal, one consumer.** The 2026-08-07 proposal asked who should own
fusion and answered: the database, *"so every consumer — app, IDE, bot — gets
the same relevance."* Two of three consumers don't call it.

**What is NOT the problem — and this is the correction that shapes the plan:**
context pressure. An earlier draft justified this with "the largest scenario is
~41k tokens." That was wrong by 4×. `getBlueprint`
(`src/lib/agent/tools/read.ts:115-159`) returns a formatted string of
`[step N] "content" (uuid)` — content and id only, never description, function,
form, links or picture. Measured properly, **Goal Setting is ~10,098 tokens**
and the whole blueprint ~22ms/955 rows to select. Nothing here is a context fix.

## Build trigger

Do not start until **one** of these is true:

1. **A session transcript shows the agent failing** at something search solves —
   the user asks "where do we handle X" and the agent enumerates, guesses, or
   says it cannot.
2. **A second consumer needs it** — CLI/IDE tooling or a third surface, making
   "one contract" a live coordination cost rather than a principle.
3. **The blueprint outgrows enumeration** — >3,000 cells or >100 paths, where
   `list_scenarios` + `get_blueprint` stops being a viable way to look around.

**Why gated.** Measured usage: **30 sessions, 46 user turns, 6 active days, one
person** (`agent_sessions` / `agent_messages`, 2026-08-04 → 08-18). Every
observed request was structural — *"take me to the Warm-Up scenario," "open the
1st cell."* **Zero** search-shaped requests across the tool's entire lifetime.
The structural navigation has served 100% of real traffic.

## Proposed solution

One read tool, `search_blueprint`, wrapping the portal. Two modes in one call,
mirroring the portal itself.

### Capability boundary — the constraint that shapes the spec

The canvas agent runs **in the browser on user-supplied chat keys**, and
`src/lib/agent/providers/models.ts:43` explicitly filters embedding models out
of the provider list. **It cannot embed a query.**

So it gets `keyword + structural + filter`, never `vector`. Consequence,
measured: a pure paraphrase with no embedding returns **0 rows** — the portal
declines rather than guessing.

That is a real capability difference from uno-bot and must be stated in the
tool description, or the model will read an empty result as "the blueprint has
nothing about this" when the truth is "your phrasing shares no words with it."

| Consumer | vector | keyword | structural | filter |
|---|---|---|---|---|
| uno-bot (Worker, Vertex SA) | ✅ | ✅ | ✅ | ✅ |
| **canvas agent (browser)** | ❌ | ✅ | ✅ | ✅ |
| CLI/IDE (service key available) | ✅ | ✅ | ✅ | ✅ |

### Tool spec — `src/lib/agent/tools/specs.ts`

```ts
{
  name: 'search_blueprint',
  description:
    'Find cells by what they SAY or where they SIT, when you do not already ' +
    'know which scenario holds them. Two modes. (1) Give `query` to search ' +
    'wording and breadcrumb names — good for "which cells mention Workday", ' +
    '"the Prototype swap path". (2) Give only filters and NO query to get the ' +
    'COMPLETE set at that scope, in journey order — that is the only way to ' +
    'honestly say "every X". Every row reports `matched_by` (keyword | ' +
    'structural | keyword+structural | filter) and every result reports ' +
    '`total_matched`, the number of cells that matched corpus-wide — say that ' +
    'number when you show a subset. ' +
    'IMPORTANT: this matches WORDS, not meaning. A question phrased in ' +
    'different words than the blueprint uses can return nothing even though ' +
    'the moment IS mapped — zero rows means "no cell uses these words", NEVER ' +
    '"the blueprint does not cover this". Re-search with the board\'s own ' +
    'vocabulary before reporting an absence. ' +
    'Do NOT use this to assemble a journey slice (those are arrow-derived — ' +
    'see the slice playbook) or to run an audit check (those read a frozen ' +
    'scoped export). Use get_blueprint when you already know the scenario.',
  parameters: {
    type: 'object',
    properties: {
      query:      { type: 'string', description: 'Words to match in cell prose or breadcrumb names. Omit for a filter-only complete set.' },
      phase:      { type: 'string', description: 'Restrict to a phase, e.g. "In-session".' },
      scenario:   { type: 'string', description: 'Restrict to a scenario, e.g. "Warm-Up".' },
      path_type:  { type: 'string', description: 'happy | alternative | unhappy | exception | named' },
      layer_role: { type: 'string', description: 'frontstage_actions | frontstage_tech | backstage_actions | backstage_tech | visual' },
      limit:      { type: 'number', description: 'Max rows (default 15, max 100). total_matched still reports the true count.' },
    },
  },
}
```

Roster decisions: **read tool** (absent from `WRITE_TOOL_NAMES`), and **absent
from `MOBILE_READ_TOOL_NAMES`** — mobile is a view-only reading surface
(`specs.ts:16`) and search is an authoring/investigation affordance.

### Dispatch — `src/lib/agent/tools/registry.ts`

```ts
case 'search_blueprint':
  return searchCells(client, {
    query:      s(args, 'query'),
    phase:      s(args, 'phase'),
    scenario:   s(args, 'scenario'),
    pathType:   s(args, 'path_type'),
    layerRole:  s(args, 'layer_role'),
    limit:      Math.min(n(args, 'limit') ?? 15, 100),
  })
```

### Reader — `src/lib/agent/tools/read.ts`

Calls `client.rpc('search_blueprint', {...})` — the tool and the RPC share a name **on purpose**: one capability, one word, whatever surface you are on and renders the same
`[step N] "content" (uuid)` line shape `getBlueprint` already uses, so the model
sees one consistent cell vocabulary. Header carries the honesty numbers:

```
14 of 116 cells matching "zoom" (keyword+structural)
Phase: In-session · Scenario: Warm-Up · Path: Happy Path (happy)
  [step 3] "Zoom/Pencil" (a0000000-…-000000040506)  [keyword]
  …
```

Filter-only mode renders `146 of 146 cells (filter)` — the complete-set signal.

### Edges: deferred, deliberately

Measured on a realistic set (`In-session` × `frontstage_tech`): **0 edges inside
the 146-cell result, 106 crossing its boundary, 100 neighbours outside.** A
lane-filtered set is a horizontal cut through a vertical graph, so a bare set
discards its own relational meaning.

But the canvas agent has `get_blueprint` (which already returns triggers via
`PATH_BLUEPRINT_SELECT`) and the user is looking at the arrows on screen.
Ship without edges; add `include_edges` only if a transcript shows the agent
reasoning about relationships it cannot see. Recorded so the omission is a
decision, not an oversight.

## Alternatives considered

**A. Do nothing.** The current recommendation until the trigger fires. Cost of
being wrong: the agent occasionally can't find something and the user navigates
manually — which is what happens today, apparently without complaint.

**B. Build search into the canvas UI instead.** Strong option, arguably stronger
than the tool. There is no search/filter UI today (verified), but
`MarqueeSelection.tsx` and `CanvasSelectionProvider.tsx` mean users can already
select cells manually — they just can't select *by predicate*. A filter control
is instant, inspectable, cannot hallucinate, and serves the human directly.
**Not either/or**: both would call the same portal. If only one gets built,
evidence favours the UI.

**C. Field projection on `get_blueprint`.** Rejected on measurement and on
review. The 41k figure was wrong (real: ~10k), `getBlueprint` already projects
to content+id, and five of seven audit checks need fields projection would strip
— `check-gap-sweep.md` requires *"only flag silence that the surrounding cells'
content CONTRADICTS"*, and `audit-playbook.md` §1.5 calls fee-visibility *"a
CONTENT SCAN, not a column test."*

**D. Expose the portal's vector mode to the browser.** Would need a server-side
embedding endpoint and a second home for a Vertex credential, against
`AGENTS.md`'s keys-in-one-place rule. Out of scope; the keyword+structural half
covers the "find by words" job that P1/P2 describe.

### Granularity — and why a MIX is the right default

The portal returns only `kind='cell'`. The function it replaced returned mixed
kinds (`cell|step|path|scenario|phase`). **That is a regression this work
introduced and none of the 26 eval cases caught**, because every case asserts on
cells (or on the `path` field *of* cell rows).

Restoring it as an explicit `granularity` parameter beats the old implicit mix,
because the same match set answers different questions depending on how the
asker meant it. Measured, one query, three projections:

| `granularity` | Rows for "Zoom" | What it tells you |
|---|---|---|
| `cell` (today) | 15 of 116 | fifteen breadcrumbs to read |
| `scenario` | 11 | Goal Setting **48**, Before Students Join 19, Warm-Up 18 — where Zoom lives |
| `lane` | 8 | **Front Stage Tech 88 of 116** — Zoom is a front-stage touchpoint, in one line |

The `lane` rollup answers a service-design question that fifteen cells would not.

**Accept an ARRAY, not a single value** — `granularity: ['scenario','cell']`.
A search question rarely has one right granularity: "where do we handle
call-offs" wants the scenario *and* the cells that justify it. The old
function's mixed return was correct in instinct and wrong only in being
unchooseable. The caller knows how they meant the question; the function should
not guess.

Shape: `kind` becomes each row's granularity. Non-cell rows carry an identity, a
breadcrumb and `match_count`. `total_matched` stays the **cell** count so it is
comparable across granularities. Cost is one `GROUP BY` over an already-computed
match set — no new matching logic.

**Ship `granularity` in the portal, not in this tool.** Every consumer wants it
(uno-bot's "which scenario covers X" answers improve identically), and adding it
to one consumer would re-fragment what was just unified. This plan then consumes
it.

### Naming: one capability, one name

An earlier draft called this tool `search_cells`, which would have made **three
names for one thing**: the RPC `search_blueprint`, uno-bot's tool
`blueprint_search`, and a new `search_cells`. That is exactly the fragmentation
the portal was built to end.

The canvas tool is therefore named **`search_blueprint`**, matching the RPC it
calls. A reader who sees the tool name, the RPC name, the migration name and
the docs sees one word.

**Optional follow-up, not required by this plan:** uno-bot's tool is
`blueprint_search` (`agents/uno-bot/tool-definitions.json`). Renaming it to
`search_blueprint` would complete the convergence. It touches `AGENT.md`,
`docs/conventions/blueprint-navigation.md` and eval scenario text, and tool
names are internal (AGENT.md forbids speaking them aloud to users), so the risk
is churn rather than breakage. Worth doing when that file is next open; not
worth a dedicated change.

## Harness changes

### The documented four-step process is stale — fix it

`docs/engineering/agent-tools.md` § "Adding a tool" says step 3 is a **harness
mirror** in `scripts/agent-harness/run.mjs`. That is no longer true: the harness
**one-sources** the specs — rolldown bundles `specs.ts` at startup and `run.mjs`
destructures `{ TOOL_SPECS, WRITE_TOOL_NAMES, MOBILE_READ_TOOL_NAMES }`
(`run.mjs:133-153`), and `toolParity.test.mjs` actively asserts no fork has
crept back.

For a **read** tool the real process is two steps plus a case:

1. Spec in `specs.ts` (+ roster decisions)
2. Dispatch case in `registry.ts`
3. An eval case in `scripts/agent-harness/cases.mjs`
4. ~~Harness mirror~~ — automatic
5. ~~`cases.mjs` WRITES~~ — writes only

**Deliverable: correct the doc.** A stale process doc costs every future tool
author the same rediscovery.

### A parity gap this surfaces

`toolParity.test.mjs` asserts *"every write tool is dispatchable"* — there is
**no equivalent for read tools**. A read spec with no `case` in `registry.ts`
ships green and fails at runtime, in front of a user.

**Deliverable, independent of this feature:** extend the test to assert every
`TOOL_SPECS` name has a dispatch case. It would have caught this class of bug
for all 37 existing tools, and it is ~5 lines.

```js
test('every declared tool is dispatchable', () => {
  for (const name of [...specs.matchAll(/name: '([a-z_]+)'/g)].map((m) => m[1])) {
    assert.ok(registry.includes(`case '${name}':`), `${name} has no dispatch case`)
  }
})
```

### Eval cases — `scripts/agent-harness/cases.mjs`

Reads are REAL against Supabase anon in this harness (`run.mjs` reality
contract), so these exercise the live portal:

| Case | Asserts |
|---|---|
| `search-finds-by-term` | "Workday" returns Tech Setup cells; `total_matched` present |
| `search-filter-only-complete` | filters, no query → `total_matched` equals row count |
| `search-zero-rows-is-not-absence` | a paraphrase returns 0 rows and the agent does **not** claim the blueprint lacks it |
| `search-not-used-for-slices` | "make me a journey slice of X" routes to the slice flow, not `search_blueprint` |
| `search-honours-total` | showing 15 of 116, the reply cites 116 |

The third is the one that matters: it pins the failure mode the capability
boundary creates.

## Skill playbook guidance

Search must be **forbidden** in two places, both already specified:

**1. Journey slice selection.** `slice-playbook.md`: *"Journey selection is
arrow-derived, not adjacency-derived. Do not add a cell because it 'seems
related', sits nearby, or is on a tech lane."* A relevance-ranked list is a
temptation engine for exactly that. Note the rule names the **journey** type —
`custom` slices ("the user chose the cells") are the one place a predicate
selection is a legitimate *input*, still human-curated.

**2. Audit check execution.** `audit-playbook.md` §1: auditors read a frozen
`audit/export-<scenario>.json` *"never the live IR, so mid-run edits cannot
split the checks across two realities."* Live search mid-audit breaks that by
design.

**One legitimate audit use**, at the **roster** stage (which runs at dispatch,
before the export freezes): fee-visibility's skip decision is a content scan,
and §1.5 warns *"beware substring false positives: 'fee' in 'feedback'."*
Measured: `ilike '%fee%'` → **23 hits, all false positives**; FTS → **0**. The
portal makes the documented trap structurally impossible.

## System-wide impact

**Interaction graph.** `search_blueprint` → `registry.ts` dispatch → `searchCells`
→ `client.rpc('search_blueprint')` → the portal's three CTEs → `cells` +
`corpus_chunks`. Results reach the model as text; the model then typically calls
`focus_cell` / `open_cell_panel` (UI bridge, camera move) or `annotate_cells`
(a write, batch-etiquette gated). **Search is the front half of an action
chain**, which is why row IDs matter more than row content.

**Error propagation.** The portal raises on embedding-model mismatch — not
reachable from the browser (no embedding sent), but the reader must surface an
RPC error as a tool failure, never as zero rows. Zero-rows-as-failure is the
same false-absence class the tool description guards against.

**State lifecycle.** None. Read-only, `stable`, no writes, no cache.

**API surface parity.** uno-bot already consumes the portal (r71). Adding this
consumer changes no signature. If `include_edges` is added later it must land in
the portal, not in one consumer, or the "one contract" property is lost.

**Integration scenarios.** (1) paraphrase → 0 rows → agent must not assert
absence. (2) filter-only over the whole blueprint → 955 rows → agent must
summarise, not dump. (3) search then `annotate_cells` on the results → batch
caps apply. (4) search during an audit → must be refused per playbook. (5) two
consumers, same query, same relevance.

## Acceptance criteria

- [ ] `search_blueprint` in `specs.ts`; not in `WRITE_TOOL_NAMES`; not in `MOBILE_READ_TOOL_NAMES`
- [ ] Dispatch case in `registry.ts`; `searchCells` in `read.ts` calling `search_blueprint`
- [ ] Filter-only mode returns the complete set and says so
- [ ] `total_matched` and `matched_by` surfaced in the rendered output
- [ ] Tool description states the words-not-meaning boundary explicitly
- [ ] 5 eval cases in `cases.mjs`, including zero-rows-is-not-absence
- [ ] Parity test extended to all declared tools, not just writes
- [ ] `docs/engineering/agent-tools.md` "Adding a tool" corrected (harness is one-sourced)
- [ ] Slice and audit playbooks carry the do-not-use guidance
- [ ] `npm test` (446+), `npm run lint` at zero, `npx tsc -p tsconfig.app.json --noEmit` clean

## Success metrics

| Metric | Target |
|---|---|
| Sessions where `search_blueprint` is called | >0 within 2 weeks, else the trigger was misread |
| Zero-row results followed by a false absence claim | **0** — the failure mode this design exists to prevent |
| Search used for journey-slice selection | **0** — playbook violation |
| Portal latency, canvas modes | <100ms (measured today: 22ms filter, 55ms keyword) |
| Consumers on one contract | 2 of 3 (bot + canvas), CLI when it needs live reads |

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Agent reads 0 rows as "not in the blueprint" | **High** — it is the fabrication class the whole bot is built around | Explicit in the description; a dedicated eval case; the reader prints `0 of 0 matching "<query>" — no cell uses these words` rather than an empty list |
| Agent uses search where enumeration is required | Medium | Playbook prohibitions + eval case |
| A 38th tool dilutes tool choice | Medium | `role.md` already says *"Prefer the fewest reads that answer the question"*; description says when NOT to call |
| Built with no demand | Medium | The build trigger exists for this |
| Filter-only returns 955 rows | Low | `limit` caps rows; `total_matched` still tells the truth |

## Review findings folded in

Four independent reviews (context-engineering, measurement audit, service-design,
YAGNI) ran against an earlier draft. What survived, including where they
corrected me and where one was wrong.

### Corrected figures

| Claim in earlier drafts | Correct |
|---|---|
| Whole blueprint ~90k tokens | **~101k** under the same (already-wrong) estimator |
| 481 cells in duplicate-body groups | **499** (61.8% of the 808 content-bearing) |
| Zoom baseline "29 of 95" | **29 of 113** — the 95 counted one field, the 29 counted six. The real gap was worse than stated |
| Goal Setting ~41k tokens to read | **~10,098** — `getBlueprint` returns content+id only |

### Three of seven audit checks can never fire on this data

Measured across all 955 cells: `owner` **0**, `perceived_owner` **0**,
lanes with `kpis` **0**, `value_props` **11**.

So `perceived-owner`, `kpi-alignment` and `value-ledger` are permanently
wave-2 skips. The audit suite has only ever exercised **4 of 7 checks**. That
is correct behaviour per `audit-playbook.md` §1.5 — but it means "the audit
passed" currently carries less coverage than it sounds like, and any claim
about audit quality should say 4/7. Unrelated to search; worth knowing.

### The canvas audit does NOT use a frozen export — and that is deliberate

The service-design review suspected canvas audits bypass `audit-playbook` §1's
scoped blind dispatch. Verified: they do, and it is **documented, intentional
translation**, not drift. `canvas-adapter.md` § "Canvas audit run" specifies a
live in-conversation run — roster → read all check docs in one round → record
findings as you go — and the adapter is binding on the canvas.

One consequence worth stating plainly: the IDE route gives each check its own
blind context so checks cannot contaminate each other; the canvas route shares
one context across all checks. That is a real quality difference between the
two routes, out of scope here, but it should be a known property rather than a
surprise.

**Corollary for this plan:** because the canvas audit reads live, the
roster-stage content scan (fee-visibility's skip decision) is the one place
`search_blueprint` genuinely helps an audit — and §1.5 already documents the trap
it fixes.

### Audit export cost is a different codebase

The YAGNI review traced the "audits blow context" concern to the audit
**skill's** `audit/export-<scenario>.json` generation — a vendored plugin,
outside `src/lib/agent/`. Projecting fields on the canvas agent's
`get_blueprint` would not have touched it. If export cost ever matters, the fix
is scoping that export per check-doc's stated needs. Recorded so nobody
re-derives it.

### The idea worth more than this plan: finding → action

The service-design review's strongest point, and none of the options here
address it: **every proposal stops at "here's what I found."** The documented
loop is map → compare → audit → slice, and both `04-the-assistant-and-audits.md`
and `06-product-design-on-blueprints.md` treat surfacing an issue as half the
job — an unmapped moment must "get it mapped… before building on it."

Concretely missing today:

- a gap-sweep finding that offers **"open in map and create this cell"**
- a jargon-lint finding that offers a **drafted rewrite routed through map**
  (proposed, never auto-applied — the edit/undo discipline still binds)
- a predicate-selected set that one action turns into a **`custom` slice draft**
  citing exactly those cells

That last one is where search and the action bridge meet, and it is the only
place in this whole investigation where a search primitive has a *documented*
user workflow waiting for it. **If effort is available for one thing, it is
probably this, not `search_blueprint` on its own.** Deserves its own plan.

### A cheaper payload idea, deferred

The context-engineering review noted that `links` (55,975 chars) and repeated
UUIDs (53,424 chars) are ~75% of a full cell read — so if payload ever does
matter, the lever is a **compact envelope** (short session-local cell codes
instead of four repeated UUIDs, `links` as `{count}` with a separate fetch),
not field projection. Not needed at ~10k tokens/scenario; recorded because it
is the right answer to a question that may return.

## Future considerations

- **`include_edges`** — add to the portal when a transcript shows the need
- **Canvas filter UI** — arguably higher value than the tool; same portal
- **CLI/IDE** — the third consumer; keeps its frozen-export discipline for audits
- **Vector for the browser** — only if a server-side embed endpoint appears for other reasons

## Sources

**Portal:** `supabase/migrations/20260820014607_search_blueprint_portal_param_names.sql`;
PR [#53](https://github.com/BilLogic/plus-uno-blueprint/pull/53)

**Harness:** `src/lib/agent/tools/specs.ts`, `registry.ts`,
`read.ts:115-159` (`getBlueprint` already projects),
`providers/models.ts:43` (embeddings filtered out),
`scripts/agent-harness/run.mjs:133-153` (one-sourced),
`scripts/tests/toolParity.test.mjs`

**Playbooks:** `slice-playbook.md` (arrow-derived), `audit-playbook.md` §1 and
§1.5 (frozen export; fee-visibility content scan), `check-gap-sweep.md`
(content contradiction rule), `role.md` (fewest reads)

**Product:** `docs/product/06-product-design-on-blueprints.md` (existence as discovery)

**Evidence:** `agent_sessions` / `agent_messages` (30 sessions, 46 turns, one
user, zero search requests); uno-bot retrieval eval run 32322460752 (26/26 at
r71); portal `EXPLAIN ANALYZE` 22ms/55ms/89ms by mode

---
title: "Make the database say what the product says"
type: refactor
status: active
date: 2026-08-20
repos: uno-blueprint
brief: docs/plans/2026-08-20-001-spec-layer-brief.md
---

# Database vocabulary

Audited every table and column in `public` against the word the product
actually uses. Eight divergences, one dead table, and a position-column family
that names the rendering instead of the domain.

The test applied: **would a user recognise this word?** Not "is it defensible"
— `layers` is defensible, and nobody says it.

---

## The audit

### 🔴 Rename — the product says something else

| Table / column | Product says | Evidence |
|---|---|---|
| `layers` | **lane** | `layer-roles.md` has to teach the split; `BlueprintLabelRail.tsx:75` says "swim-lane grid row"; `remove_lane` is already named lane |
| `layers.layer_role` | lane role | same |
| `cells.layer_id` | lane | `upsert_cell`'s own spec says *"lane id from get_blueprint (parameter named layer_id **for historical reasons**)"* — the code apologises for it |
| `cell_triggers` | dependency / link | stores `kind in ('trigger','needs')`, so the name covers **half its contents**. The panel tab says "Dependencies"; the agent tools already say `create_cell_link` / `list_cell_links` |
| `propositions` | business model | one word from `cells.value_props`, means the opposite scope |
| `cells.description` | **summary** | `CellPanelEditor.tsx:413` carries the comment `{/* "Summary", not "Description": it is the tl;dr … */}` and renders `<Field label="Summary">`. `getCell` relabels it on the way out: `['summary', data.description]` |
| `paths.description` | **summary** | same word, same reason, same level of the tree as `cells.description`. [Plan 006](2026-08-20-006-design-data-model.md) defines it as *when this route applies*, with `note` as the author's aside |
| the `Visual` lane label | **Storyboard** | a **label**, not a column. "Visual" names a medium; the row holds the step's storyboard frame and its one-line description. `layer_role` stays `visual` — it is the semantic key and every importer writes it |

**`cells.content` is deliberately absent from this table.** `moment` and
`preview` were both considered and rejected — see
[plan 006](2026-08-20-006-design-data-model.md). It has the widest blast radius
of any rename here and the smallest gain.

`cells.layer_id` and `cells.description` are the two where the codebase has
**already written down that the name is wrong** and worked around it. Those are
not opinions, they are documented debt.

### 🔴 "Lifecycle" should not exist — and `services` is a dead table

Asked whether a service can contain several lifecycles. It cannot, and the
answer is stronger than 1:1 — **there is no relationship at all.**

```
services            id, name, description, slug        1 row: "Example API"
service_lifecycles  id, name, description              1 row: "PLUS Application"
```

Checked `pg_constraint` for a foreign key in either direction: **none exists.**
`service_lifecycles` has no `service_id` column. The two tables are unrelated.

- `services` holds one placeholder row named **"Example API"** — scaffolding
  from the original template import (`9aabdf0`). Grepped the whole app:
  **no reader.** Not a query, not a hook, not a component.
- `service_lifecycles` is the real root. Its own comment says
  `'End-to-end service journey'`, and every root table hangs off it —
  `phases`, `evidence`, `findings`, `slices`, `propositions`.

So "lifecycle" is not a level in the hierarchy. It **is** the service, wearing
a word nobody uses.

**Proposal:**

```sql
drop table public.services;                              -- 1 placeholder, 0 readers
alter table public.service_lifecycles rename to services;
-- then, on all five children:
alter table public.<child> rename column service_lifecycle_id to service_id;
```

Result: one root table, named what it is, and the word "lifecycle" leaves the
schema. `service_scenarios` also stops being confusing — the `service_` family
becomes `services` → `service_scenarios`, two members, both real.

**~~Check before dropping `services`~~ — checked, nothing to preserve.** The
row reads:

```
name         "Example API"
slug         "example-api"
description  "Placeholder service entry for local development"
```

`slug` was template scaffolding from the original import, not a designed
multi-service URL scheme — the description says so in its own words. **Drop the
table.** Recorded so this does not get re-litigated at migration time.

### 🔴 Row and column are rendering words; lane and step are the domain

| Now | Proposed | Why |
|---|---|---|
| `layers.row_position` | `lanes.lane_position` | a lane renders as a row *today*. The lane is the thing; the row is how it happens to be drawn |
| `path_steps.column_position` | `path_steps.step_position` | same — a step is a step whether it is drawn as a column, a card, or a list item |
| `cells.slot_position` | `cells.position` | its order within a (lane, step) slot; nothing else to call it |
| `phases.order_position` | `phases.position` | |
| `service_scenarios.order_position` | `service_scenarios.position` | |
| `slices.position` · `slice_items.position` | unchanged | already right |

This supersedes the earlier suggestion to keep `row_position` and
`column_position` "because the axis is information." The axis is a **rendering**
fact — the compare view already draws the same lanes in a different geometry —
and the whole point of this plan is that the database says the domain word.

### ✅ Keep — checked and correct

| Name | Why it stays |
|---|---|
| `service_scenarios` | Once `service_lifecycles` becomes `services`, the family is `services` → `service_scenarios` — two members, both real. The agent layer already exposes it as `scenario` (`filter_scenario`), so no user sees the prefix |
| `paths.path_type` | matches the UI's Happy / Alternate / Unhappy vocabulary |
| `cells.function` / `form` / `value_props` | the panel labels them Function / Form / Value |
| `deleted_structure` | internal; never surfaced |
| `origin` (`import` \| `app`) | internal provenance |
| `evidence` · `findings` · `slices` | the product says exactly these |

### ⚠️ Not a rename, but flagged

- ~~`paths.description` **and** `paths.note` — no documented difference.~~
  **Resolved** in [plan 006](2026-08-20-006-design-data-model.md): `description`
  → `summary`, meaning *the condition that puts someone on this route*; `note`
  stays, meaning *the author's aside* — open questions, provenance, working
  state. The scenario panel labels them **Route** and **Author note**, and
  renders the note muted so the difference is visible without reading a hint.
- `evidence.added_by` **and** `created_by` — two attribution columns. `added_by`
  is documented (*"Agent name or participant-coded author. Never the
  interviewee."*); `created_by` is not.

---

## 🔴 The trap that governs every rename here

**`alter table ... rename column` does not touch plpgsql function bodies.**
Views and constraints track their dependencies by OID and follow a rename
automatically. A plpgsql body is stored as **text** and resolved at *execution*
time — so a renamed column leaves every function that names it syntactically
intact, deployable, and broken on the next call.

Measured on production, 2026-08-20, across the 36 functions in `public` +
`semantic_search`:

| Identifier | Functions naming it |
|---|---|
| `layers` | **14** |
| `layer_id` | **9** |
| `cell_triggers` | **8** |
| `layer_role` | **6** |
| `paths.description` | 4 |

**So each phase below is "rename the column, then rewrite N function bodies",
not "rename the column."** The rewrite is the work; the `alter table` is the
easy line. Nothing in CI catches a missed one — the function still compiles,
and the failure surfaces as a runtime error the first time that path runs,
which for the rarer RPCs could be weeks.

**Technique that worked** (used for `search_blueprint` v5 and the `view_type`
collapse): fetch `pg_get_functiondef`, `replace()` the exact fragment, assert
the length changed, then `execute`. It preserves the rest of the body verbatim
and aborts loudly if the anchor moved. Hand-retyping a body is how
`create_scenario` nearly shipped with the wrong return type — Postgres caught
that one only because the signature changed too. A body change would not have
been caught.

**Acceptance for every rename phase:** after the migration, assert that **zero**
functions still name the old identifier:

```sql
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','semantic_search') and p.prokind = 'f'
  and pg_get_functiondef(p.oid) ~* '\mlayer_id\M';   -- must return 0 rows
```

---

## Order of work

**This must land after `refactor/agent-tool-surface` merges.** That branch
just rewrote `search_blueprint`, `deletion_impact`, `remove_lane` and
`PATH_BLUEPRINT_SELECT` — every one of which names `layers`. Renaming into an
unmerged branch means resolving the same conflict twice.

### Phase 1 — `layers` → `lanes`

```sql
alter table public.layers rename to lanes;
alter table public.lanes rename column layer_role to lane_role;
alter table public.cells rename column layer_id to lane_id;
```

Then the sweep. Known call sites:

- `PATH_BLUEPRINT_SELECT` (`src/lib/workflowQueries.ts`) — a PostgREST embed, so
  the **relation name is the wire format**
- `public.search_blueprint` — `scoped`, `structural`, the count query
- `public.deletion_impact` — the `lane` branch added in `20260820030000`
- `public.remove_lane`, `public.add_lane` — bodies, not the function names
  (`add_lane` is an RPC name; the tool that calls it is `create_layer` and
  becomes `create_lane`)
- `src/lib/layerRoles.ts` → `laneRoles.ts`, `src/lib/blueprintLayout.ts`
- `src/types/database.ts` (regenerate)
- Agent surface: `create_layer` → `create_lane`, `list_layers` → `list_lanes`,
  `filter_layer_role` → `filter_lane_role`

**~~Trap:~~ corrected.** An earlier draft said `filter_layer_role` is passed
by uno-bot and rated the rename **High / cross-repo**. **It is not.** Grepping
the whole `plus-vibe-coding-starting-kit` tree finds the string exactly once,
in a prose comment (`agents/uno-bot/src/integrations/blueprint.ts:493`).
`tryHybrid` sends four keys, `tryRpc` sends one, and neither is a filter. The
rename costs one comment edit in the bot. Full evidence in
[plan 007](2026-08-20-007-feat-cross-repo-blueprint-contract-plan.md).

### Phase 2 — `cell_triggers` → `cell_links`

> 🔴 **This is the real cross-repo break, not `filter_layer_role`.** uno-bot
> reads the table by URL (`/rest/v1/cell_triggers`), by **FK constraint name**
> inside two PostgREST embed hints, and lists it in both contract table arrays.
> The embed hint is a string: rename the table without renaming the
> constraints and the request 400s, `fetchEdges` logs a warning and returns
> `[]`, and the bot reports "no dependencies" for cells that have them —
> the exact silent-empty failure `blueprint.ts:1005-1013` documents from last
> time. **Rename the constraints in the same migration**, and land
> [plan 007](2026-08-20-007-feat-cross-repo-blueprint-contract-plan.md)
> Phase 2 first so a drifted copy fails `check:contract` instead of a request.

In-repo, no PostgREST embed depends on it by name except
`outgoing:cell_triggers!cell_triggers_source_cell_id_fkey` in
`PATH_BLUEPRINT_SELECT`, where **the constraint name is part of the syntax** —
so the FK constraint has to be renamed too, or the embed hint updated.

### Phase 3 — `propositions` → `business_model` · 📌 **PINNED**

> Service-tier naming, parked with the rest of it. Zero rows and one reader, so
> nothing downstream waits on it.

Smallest: 0 rows, 1 reader (`get_proposition`, added on this branch), 2 skill
docs. `evidence.proposition_question_key` keeps its name — renaming it would
have to move the CHECK constraint for nothing.

### Phase 4 — `description` → `summary` on cells **and** paths

```sql
alter table public.cells rename column description to summary;
alter table public.paths rename column description to summary;
```

Do this one **only with Phase 1**, not alone. It touches `getCell`,
`CellPanelEditor`, `search_blueprint`'s projection, `PATH_BLUEPRINT_SELECT` and
the compare model. Worth it because the workaround comment is in the code
today, but not worth its own migration window.

⚠️ **Correction — `paths.description` is read in at least six places.** An
earlier draft of this plan claimed it "has no UI reader at all today," which is
wrong. Grepped: `SlideStickyHeader.tsx:42,69`, `MergedCompareGrid.tsx:450,669`,
`WalkthroughPathSelect.tsx:39,89`, `PathMultiSelect.tsx:102,134,192`,
`ServiceBlueprintGrid.tsx:183,194`, `BlueprintPathBand.tsx:404` — plus
`PATH_LIST_SELECT` and `PATH_BLUEPRINT_SELECT`, the `BlueprintPath` type, and
**four database functions** (`duplicate_path`, `duplicate_scenario`,
`search_blueprint`).

What remains true is that there is no **editing** surface — which is what
[plan 003](2026-08-20-003-feat-entity-detail-panels-plan.md)'s scenario panel
adds. The rename is still worth doing before that panel is written, so it is
written against the final name; it is just not free.

Component **props** named `description` stay as they are: those are display
APIs, not column names. Only field access (`path.description` → `path.summary`)
moves.

### Phase 5 — positions (optional)

`order_position` / `slot_position` / `position` → `position`. Skip unless
Phases 1–4 are already touching the same files.

### Phase 6 — retire "lifecycle" · 📌 **PINNED**

> This renames the root table and a column on five children. It is the service
> tier's foundation and is parked with it.
>
> **What that costs the phases that are still moving: nothing.** Phases 1, 2, 4,
> 5, 7 and 8 touch lanes, links, `description` columns, positions, schema assets
> and `view_type` — none of them name the root table. The one consequence is
> that `service_lifecycles` stays the root for now, so any new foreign key
> written before this phase (notably
> [plan 009](2026-08-20-009-feat-stakeholder-registry-plan.md)'s `service_id`)
> must reference `public.service_lifecycles(id)` and be renamed with everything
> else when this phase runs.

Do this **last**: it renames a column on five tables and drops one.

```sql
drop table public.services;                                -- placeholder, 0 readers
alter table public.service_lifecycles rename to services;
alter table public.phases        rename column service_lifecycle_id to service_id;
alter table public.evidence      rename column service_lifecycle_id to service_id;
alter table public.findings      rename column service_lifecycle_id to service_id;
alter table public.slices        rename column service_lifecycle_id to service_id;
alter table public.business_model rename column service_lifecycle_id to service_id;
```

Then: `resolveFirstLifecycleId` → `resolveFirstServiceId`, `src/lib/lifecycle.ts`
→ `src/lib/service.ts`, `useLifecyclePhases` → `useServicePhases`, and the
`lifecycleId` helper in `registry.ts:96`.

**Sequencing note for [plan 004](2026-08-20-004-feat-multi-service-support-plan.md):**
this rename makes multi-service *easier*, not harder — `service_id` is exactly
the predicate every RLS policy will need, and it will already be named right.

---

> **Running order while Phase 6 is pinned:** 1 → 2 → 4 → 5 → 8 → 7. Phase 7
> regenerates the schema assets and must come after every rename that is
> actually shipping, or it captures a half-renamed schema.

### Phase 7 — the schema assets, which are already stale

The rename is not the only reason to touch these. **Both machine-readable
schema assets predate the derived layer by a month** — neither
`evidence`, `findings`, `slices` nor `propositions` appears in either,
though they shipped on 2026-07-29 in `f65efcf`:

| Asset | Lines | Has derived layer? | Needs |
|---|---|---|---|
| `docs/reference/erd.mmd` | 97 | ❌ **no** | regenerate — its own header says *"verified through 20260716120000_layer_role.sql"*, five weeks and eleven migrations ago |
| `supabase/schema.reference.sql` | 104 | ❌ **no** | regenerate |
| `supabase/DATABASE.md` | 5 | — | a pointer file; check it points somewhere true |
| `docs/reference/authored-fields.json` | — | ? | names columns; verify against the rename |
| `docs/reference/seed-verification.sql` | — | ? | names tables; verify |
| `docs/engineering/access-and-security.md` | — | — | describes grants and policies by table name |

A July plan already flagged both as stale
(`2026-07-16-001-…-plan.md:183`) and asked for them to be **generated from
the migrations so they cannot drift again**. They drifted again. That is the
argument for generating rather than hand-editing them in this pass.

- [ ] Regenerate `erd.mmd` from the live schema, including the derived layer
- [ ] Regenerate `schema.reference.sql`
- [ ] Sweep the three reference files for renamed identifiers
- [ ] Update `access-and-security.md`'s object table
- [ ] Prefer a generator; if that is out of scope, say so in the file header
      with the date it was last verified, so the next reader knows

---

### Phase 8 — collapse the `view_type` vocabulary

Two vocabularies exist for one concept, with `viewTypeVocabulary.ts` as the
translation seam:

```
DB      single | side-by-side | integrated
Client  single | stacked      | merged
```

The seam's own comment says a migration was avoided because persisted
`integrated` rows coerce harmlessly. **Checked the data: all 22 scenarios hold
`side-by-side`, and both other values are unused.** So the migration the
comment deferred is now three lines and loses nothing:

```sql
update public.service_scenarios set view_type = 'stacked';
alter table public.service_scenarios drop constraint service_scenarios_view_type_check;
alter table public.service_scenarios add constraint service_scenarios_view_type_check
  check (view_type in ('single','stacked','merged'));
```

Then delete `src/lib/viewTypeVocabulary.ts`, `toClientViewType`,
`dbToClientViewType`, and both seams in `phasesToSlides.ts` and
`authoringRpc.ts`. One vocabulary — the one the product speaks.

**Verify the constraint name first** (`\d service_scenarios`); it is guessed
above.

---

## Acceptance criteria

- [ ] No table or column name is contradicted by a UI label or a code comment
- [ ] `grep -rn "layer" src/` returns only genuine z-index/CSS uses
- [ ] The two apology comments are deleted, because they are no longer true:
      `upsert_cell`'s *"for historical reasons"* and `CellPanelEditor.tsx:413`'s
      *"Summary, not Description"*
- [ ] uno-bot still answers — it calls `search_blueprint` **by parameter name**
- [ ] `npm run build`, `npm run lint`, full test suite green
- [ ] Retrieval evals stay 26/26
- [ ] `viewTypeVocabulary.ts` is deleted, and no file translates between two
      view-type vocabularies
- [ ] The lane label reads **Storyboard** in both render paths; `layer_role`
      is untouched and every import still writes `visual`
- [ ] `cells.content` is unchanged — this plan renames no cell body field
      other than `description`

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| ~~`filter_layer_role` breaks uno-bot~~ | **None** | Verified: the bot never passes it (plan 007) |
| `cell_triggers` rename breaks uno-bot's edge read **silently** | **Critical** — cross-repo | Rename the FK constraints in the same migration; plan 007 Phase 2 puts the names in the checked contract |
| `search_blueprint`'s OUTPUT column `description` renamed under the bot | **High** | The RPC projection is a separate decision from the table column — make it explicitly |
| PostgREST embed hints break silently | High | They fail loudly at request time, not build time — cover with a smoke query per embed |
| Rename lands mid-branch and conflicts | Medium | Sequenced after `refactor/agent-tool-surface` merges |
| Sweep misses a string in a skill doc | Low | Word-boundary sweep, same method as `7530402` |

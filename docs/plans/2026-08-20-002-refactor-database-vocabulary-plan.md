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

**Check before dropping `services`:** its row is `"Example API"` with a `slug`
column that nothing else has. If `slug` was meant for routing a future
multi-service URL, note it in [plan 004](2026-08-20-004-feat-multi-service-support-plan.md)
before the table goes — the column is the only trace of that intent.

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

- `paths.description` **and** `paths.note` — two free-text fields with no
  documented difference. Before either gets a UI, decide what each is for or
  merge them.
- `evidence.added_by` **and** `created_by` — two attribution columns. `added_by`
  is documented (*"Agent name or participant-coded author. Never the
  interviewee."*); `created_by` is not.

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

**Trap:** `filter_layer_role` is a **parameter of the deployed RPC**, and
uno-bot passes it by name. Renaming it is a breaking change for a consumer in
another repo — either keep the old parameter name, or ship both repos together.

### Phase 2 — `cell_triggers` → `cell_links`

Lower risk: no PostgREST embed depends on it by name except
`outgoing:cell_triggers!cell_triggers_source_cell_id_fkey` in
`PATH_BLUEPRINT_SELECT`, where **the constraint name is part of the syntax** —
so the FK constraint has to be renamed too, or the embed hint updated.

### Phase 3 — `propositions` → `business_model`

Smallest: 0 rows, 1 reader (`get_proposition`, added on this branch), 2 skill
docs. `evidence.proposition_question_key` keeps its name — renaming it would
have to move the CHECK constraint for nothing.

### Phase 4 — `cells.description` → `cells.summary`

Do this one **only with Phase 1**, not alone. It touches `getCell`,
`CellPanelEditor`, `search_blueprint`'s projection, `PATH_BLUEPRINT_SELECT` and
the compare model. Worth it because the workaround comment is in the code
today, but not worth its own migration window.

### Phase 5 — positions (optional)

`order_position` / `slot_position` / `position` → `position`. Skip unless
Phases 1–4 are already touching the same files.

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

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `filter_layer_role` rename breaks uno-bot | **High** — cross-repo | Keep the old parameter name, or ship both repos in one window |
| PostgREST embed hints break silently | High | They fail loudly at request time, not build time — cover with a smoke query per embed |
| Rename lands mid-branch and conflicts | Medium | Sequenced after `refactor/agent-tool-surface` merges |
| Sweep misses a string in a skill doc | Low | Word-boundary sweep, same method as `7530402` |

### Phase 6 — retire "lifecycle"

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

## Phase 7 — the schema assets, which are already stale

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

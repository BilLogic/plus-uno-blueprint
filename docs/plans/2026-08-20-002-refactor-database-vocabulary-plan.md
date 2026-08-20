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
actually uses. Six real divergences, five of them one word each, plus one
family of five columns that disagree with each other.

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

### 🟡 Inconsistent with each other, not with the product

Five column names for "ordinal within parent":

```
phases.order_position        service_scenarios.order_position
layers.row_position          cells.slot_position
path_steps.column_position   slices.position   slice_items.position
```

`row_position` and `column_position` are meaningful — a lane is a row, a step
is a column, and the axis is real information. `order_position`,
`slot_position` and `position` are three words for the same idea.

**Proposal:** keep `row_position` / `column_position` (the axis is content),
collapse the other three to `position`. Lowest value of everything here — do it
only if the rename is happening anyway.

### ✅ Keep — checked and correct

| Name | Why it stays |
|---|---|
| `service_scenarios` | `service_` is a live family: `services` → `service_lifecycles` → `service_scenarios`. Renaming one member orphans it, and the agent layer already exposes `scenario` (`filter_scenario`), so no user sees the prefix |
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

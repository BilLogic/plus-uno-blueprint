---
title: 'Make touchpoint colours a stored, editable product fact'
type: feat
status: active
date: 2026-08-05
---

# ✨ Make touchpoint colours a stored, editable product fact

## Where this landed — 2026-09-06

Three of the four units have shipped, in a different shape from the one drawn
below, because a `touchpoints` table arrived from another direction while this
plan sat: `20260830140000` created it as a registry with names, kinds and
placements, and `20260905110000` / `20260905120000` added `tone` and `aliases`
to it rather than standing up the single-purpose table this plan sketched.

- **Unit 1** — the column, not a table, and no backfill inside the migration.
  The values are `docs/reference/seed-touchpoint-colours-and-scenario-notes.sql`,
  which the owner runs.
- **Unit 2** — the read path is a module store in `src/lib/touchpointColors.ts`
  and not a context, because `TouchpointCellFace` became the template's file
  and takes a label with no prop to carry a tone in.
- **Unit 4** — done: the seed map is the generic eleven the template ships, and
  the deployment's twenty-odd are rows.
- **Unit 3 — the swatch picker — has NOT shipped.** Nobody can change a colour
  from the app yet; the column is read-only to the deployed site by policy.
  That is the live remainder of this plan.

Two of the open questions below were answered by events rather than decided.
`Zoom / PLUS App` never became two touchpoints — the registry has one row per
tool and placements link to it — and the CHECK constraint this plan wanted was
deliberately NOT written, for the reasons `20260905110000` sets out.

## Why

"Zoom is blue" is a product decision, not a palette one. Today it is a hardcoded
map in `src/lib/techPillColors.ts`, and any touchpoint missing from that map gets
a colour from a **hash of its own name**. Whoever owns the blueprint cannot
change either.

The styling side of this is already finished and needs no further work. A pill's
colour resolves entirely through `[data-blueprint-tone]` in `blueprint.css`, and
`getTouchpointTone(label, chosen?)` already takes the override the stored value
will arrive through — `chosen` wins when present. **This plan adds a row to
attach a colour to, and a control to change it. It touches no CSS.**

## Verified reality

Measured against the live database (project `osybxeojvsqcwxkgnalm`) on
2026-08-05, and against the source on this branch — not assumed.

| Fact | Value |
| --- | --- |
| Pill instances on tech layers | 206 |
| Distinct labels | 28 (27 case-insensitively) |
| Labels resolving to a **chosen** tone | 23 |
| Labels resolving to a **hash** | **5** |
| Entries in `TECH_PILL_COLORS` | 25 |
| Seed entries that match nothing live | 4 |
| Cells in the database | 802 |

The five labels currently wearing a colour nobody picked:

| Label | Uses | Hashed to |
| --- | --- | --- |
| `Google Spreadsheet` | 4 | purple |
| `Shift Swap Google Form` | 2 | purple |
| `PLUS App (Real-time student progress display)` | 1 | red |
| `Zoom / PLUS App` | 1 | indigo |
| `Zoom / PLUS App (Student Progress Dashboard)` | 1 | purple |

Two of the four dead seed entries are simply never used
(`Google Quiz embedded in Notion`, `Zoom Recording`). `Google Quizzes` is a
plural nobody writes. The fourth is more interesting: **`Workday` is shadowed by
its own alias** — `TECH_LABEL_ALIASES` maps `workday` → `Workday (Employee
View)`, so the `Workday` key in `TECH_PILL_COLORS` can never be reached.

### The thing that decides the schema

A tech pill is **not a row**. It is a substring of `cells.content`, split on
`/\r?\n|,/` by `parseCellContentItems`. That is why there is nowhere to store a
colour today, and it is the whole reason this plan exists.

It also produces the one genuinely undecided question. Two live labels name
*two* touchpoints in one pill:

- `Zoom / PLUS App`
- `Zoom / PLUS App (Student Progress Dashboard)`

The split pattern does not break on ` / `, so each is currently one pill wearing
one colour. See **Open question 1**.

## Scope boundaries

Explicit non-goals, so implementation does not drift into them:

- **No CSS changes.** The seven `[data-blueprint-tone]` rules and the seven-family
  tone set are finished and asserted by `palette.test.ts`. This plan must not add
  a family or a token.
- **No content editing.** Renaming a touchpoint means editing `cells.content`,
  which is the panel-editor work, tracked separately.
- **Not a touchpoint registry.** No logo, URL, description or owner on the new
  table yet — only what is needed to answer "what colour is this". Adding columns
  later is cheap; shipping a half-used registry is not.

## Schema

```sql
create table public.touchpoints (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  tone        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint touchpoints_tone_check check (tone in (
    'crimson','gold','indigo','purple','red','tomato','yellow'
  ))
);

-- Case-insensitive, because `PLUS app` and `PLUS App` are one touchpoint.
create unique index touchpoints_name_key on public.touchpoints (lower(name));
```

Decisions behind this shape:

- **`tone` is `not null` with a CHECK, not a foreign key.** The seven families are
  a design-system fact declared in `blueprint.css`; a lookup table would put them
  in two places that can disagree. The CHECK list must stay in step with
  `TouchpointTone` — **add an acceptance test that reads both and asserts they
  match**, the same way `palette.test.ts` reads the stylesheet.
- **Unique on `lower(name)`.** `PLUS app` and `PLUS App` both occur live.
- **No `cell_id`.** A touchpoint is global — Zoom is the same Zoom in every cell.
  This is what makes the table small (28 rows, not 206).
- **`name` matches the *canonical* label**, i.e. the output of
  `normalizeTechPillLabel`, so the alias map keeps working unchanged.

RLS follows `slices`, which is the closest existing model — public `SELECT`,
`authenticated` for write:

```sql
alter table public.touchpoints enable row level security;
create policy touchpoints_select        on public.touchpoints for select to public        using (true);
create policy touchpoints_insert_auth   on public.touchpoints for insert to authenticated with check (true);
create policy touchpoints_update_auth   on public.touchpoints for update to authenticated using (true) with check (true);
create policy touchpoints_delete_auth   on public.touchpoints for delete to authenticated using (true);
```

Writes go through the dev auth user, not the service key — the same path the
existing editing surfaces use.

## Implementation units

### Unit 1 — Migration and backfill

**Goal.** The table exists and already knows every colour the app currently
shows, so turning the feature on changes nothing visually.

**Files.** `supabase/migrations/2026080500000_touchpoints.sql`

**Approach.** DDL above, then seed all 28 live labels. For the 23 with a seed
entry, insert the tone from `TECH_PILL_COLORS`. **For the 5 hashed ones, do not
insert the hash** — a hash is not a decision, and writing it down would launder
it into one. Leave them absent so they keep hashing until someone picks, and the
picker UI can show them as unset.

Re-derive the label list at implementation time rather than pasting the table
above; content may have changed.

**Verification.** `select count(*) from touchpoints` = 23. Every `tone` passes
the CHECK. A second run of the migration is a no-op (`on conflict do nothing`).

### Unit 2 — Read path

**Goal.** The stored tone reaches the two components that draw pills.

**Files.** `src/hooks/useTouchpoints.ts` (new), `src/components/blueprint/TechPillFace.tsx:30`,
`src/components/blueprint/BlueprintTechPill.tsx:33`

**Patterns to follow.** `src/hooks/useEvidence.ts` — `useSupabaseQuery` with a
stable string key and a `useCallback` fallback. Note this table is read
**globally, once**, not per cell, so the key is a constant.

**Approach.** Fetch all touchpoints into a `Map<lowercased name, tone>`, expose
it through context so 206 pills do not each subscribe. Both call sites already
call `getTechPillToneFor(item)`; they become
`getTechPillToneFor(item, stored.get(normalizeTechPillLabel(item).toLowerCase()))`.
`getTouchpointTone` needs no change — `chosen` already wins.

**Watch for.** `BlueprintCellButton` has no `React.memo` and the grid re-renders
broadly. Put the map in a context whose value is memoised on the query result, or
this adds a re-render to every pill on every unrelated state change.

**Verification.** With the table seeded, every pill renders the same colour as
before the change — screenshot the board before and after and diff. Delete one
row and confirm that label falls back to its seed, not to the hash.

### Unit 3 — Write path and the swatch control

**Goal.** Someone who owns the blueprint can change a touchpoint's colour and see
every instance of it move.

**Files.** `src/components/blueprint/CellTouchpointTone.tsx` (new),
`src/components/blueprint/BlueprintCellDetailPanel.tsx`

**Patterns to follow.** `CellEvidenceTab.tsx:131` is the existing in-component
write (`client.from('evidence').insert(...)`, error surfaced locally, reload
token bumped). Mirror it, with `upsert` on the unique index.

**Approach.** In the cell detail panel, when the selection is a tech pill, show
seven swatches plus an "unset" state. The swatches are the tone families — render
them by setting `data-blueprint-tone` and reading
`--background-blueprint-cell`, so the picker cannot drift from what the pill
will actually look like. Label each swatch with its family name, following
`annotationSwatchName()`: **never render `var(--color-…)` to a user.**

Selecting a swatch upserts `{name: canonical, tone}` and bumps the reload token.

**Verification.** Change Zoom to `gold`; all 3 Zoom pills change, `Zoom`
(a different touchpoint) does not. Reload the page and the change persists. Sign
out and the control is not offered.

### Unit 4 — Retire the seed map

**Goal.** One source of truth.

**Files.** `src/lib/techPillColors.ts`

**Approach.** Once Unit 3 ships and the 5 unset labels have been picked,
`TECH_PILL_COLORS` becomes the *fallback for a database that has not loaded yet*
rather than the answer. Trim the 4 dead entries, and fix the `Workday` shadowing
either by removing the key or by removing the alias — whichever matches how the
data actually reads by then.

Keep the hash. It is the right behaviour for a label nobody has ever seen, and
it is deterministic, which a random colour would not be.

## Requirements trace

| # | Requirement | Unit |
| --- | --- | --- |
| 1 | A touchpoint's colour is stored, not computed | 1 |
| 2 | Nothing changes visually on the day it ships | 1, 2 |
| 3 | The colour is editable by whoever owns the blueprint | 3 |
| 4 | An edit applies everywhere that touchpoint appears | 2, 3 |
| 5 | The seven-family palette is not expanded | all — enforced by the CHECK and `palette.test.ts` |
| 6 | No token name is ever shown to a user | 3 |

## Open questions — decide before Unit 1

1. **Are `Zoom / PLUS App` and its Dashboard variant one touchpoint or
   two?** If two, `parseCellContentItems` must also split on ` / `, which changes
   206 pills' parsing and is a bigger change than this plan — it would become its
   own unit ahead of the migration. If one, they are simply two more touchpoints
   to colour and nothing else moves. **Recommendation: treat as one for now.**
   Splitting is a content-model change and belongs with the panel editor.
2. **Should a parenthetical qualifier collapse to its base?** e.g.
   `PLUS App (Real-time student progress display)` → `PLUS App`. Three live labels
   have this shape. Collapsing means one fewer decision for the operator and
   consistent colour for what is arguably one product; not collapsing means the
   distinction stays visible. **Recommendation: do not collapse.** It is easy to
   add later via `TECH_LABEL_ALIASES`, and impossible to undo once the
   distinction has been erased from the picker.
3. **Does an unset touchpoint show as hashed, or as neutral?** Hashed keeps
   today's look; neutral makes "nobody has chosen this" visible and is a nudge to
   pick. **Recommendation: hashed in the board, flagged as unset in the picker** —
   the board should not degrade to make an authoring point.

## Risks

| Risk | Mitigation |
| --- | --- |
| The CHECK list and `TouchpointTone` drift apart | Acceptance test reads both, like `palette.test.ts` reads the stylesheet |
| 206 pills each subscribing to a query | One context, memoised on the result (Unit 2) |
| A colour edit silently applies to a label the operator did not expect (aliases) | The picker shows the canonical name it will write, not the raw label clicked |
| Backfill launders 5 hashes into decisions | Explicitly excluded from the seed (Unit 1) |

## Post-deploy monitoring & validation

- **Validation queries**
  - `select count(*) from touchpoints;` — expect 23 after backfill.
  - `select name from touchpoints where tone not in ('crimson','gold','indigo','purple','red','tomato','yellow');` — expect 0 rows.
- **Expected healthy behaviour** — board renders identically to the pre-migration
  screenshot; no console errors; the tone context issues exactly one query per
  session.
- **Failure signal / rollback trigger** — any pill rendering an unexpected colour,
  or a re-render regression on the grid. Roll back by reverting Unit 2's two call
  sites to `getTechPillToneFor(item)`; the table can stay, unread.
- **Window and owner** — first authoring session after deploy.

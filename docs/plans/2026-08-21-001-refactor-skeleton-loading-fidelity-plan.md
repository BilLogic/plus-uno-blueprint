---
title: Skeleton loading fidelity
type: refactor
status: active
date: 2026-08-21
---

# Skeleton loading fidelity

## Decisions settled (2026-08-21)

Three questions came up while this plan was being written. All three are closed;
recording them here so the reasoning is not re-litigated.

**1. Does the board keep preloading `summary` and `links`? — Yes.**
Neither is drawn on the canvas. Together they are **274 KB of the board's
~374 KB payload**, carried in memory so the panel opens instantly
(`blueprintCellSelection.ts` hands them to the panel at click time), and used in
bulk by compare's difference signatures (`compareSlots.ts` compares on content,
summary and links). Deferring them to cell-open was considered and rejected:
**current load speed is fine**, and the change would trade a faster board for a
skeleton on every first cell open. Revisit only if board load becomes a
complaint.

**2. Do cell panels get skeletons? — No, because nothing will be loading.**
Follows from (1). Once the last per-cell columns move into the board query, the
cell panel has nothing in flight and therefore nothing to place a skeleton for.
A skeleton for a surface that renders in the same commit as its parent is not a
low-fidelity placeholder; it is a bug.

**3. What is the rule when this comes up again?**
> **One value per cell → ships with the board. Unlimited values per cell → gets
> its own query.**

Function, form, owner, summary — one each, bounded. Evidence sources —
unbounded. Size today is not the test; that property does not change as the
board grows.

---

## Overview

Four entity panels share one generic placeholder that resembles none of them.
Two cell sub-surfaces carry accurate placeholders for queries that should not
exist. This plan makes the first group honest and deletes the second group's
reason to exist.

The measurement below changed the shape of this plan twice. It is worth reading
before the design.

## Problem statement

### What is on screen today

`PanelLoading` ([panelShell.tsx:474](../../src/components/blueprint/panelShell.tsx)) renders two
stacked bars and two full-width boxes:

```tsx
<div className="flex flex-col gap-1.5">
  <Skeleton className="h-4 w-32" />
  <Skeleton className="h-3 w-40" />
</div>
<Skeleton className="h-14 w-full" />
<Skeleton className="h-14 w-full" />
```

Four panels render it verbatim — [LanePanel.tsx:67](../../src/components/blueprint/LanePanel.tsx),
[PhasePanel.tsx:57](../../src/components/blueprint/PhasePanel.tsx),
[StepPanel.tsx:59](../../src/components/blueprint/StepPanel.tsx),
[ScenarioPanel.tsx:72](../../src/components/blueprint/ScenarioPanel.tsx).

What each of them actually loads:

| Panel | Loaded shape | The placeholder promises |
| --- | --- | --- |
| **Lane** | identity (badge + title + hint line) · Stakeholder **select** · Owner team **input** · KPIs **string-list** · Tools **string-list** | 2 boxes |
| **Phase** | identity · **three** textareas (rows 2 / 3 / 3) | 2 boxes |
| **Step** | identity · one textarea (rows 3) · optional **storyboard frame row** (4:3, horizontally scrolling) · optional **columns list** | 2 boxes |
| **Scenario** | identity · one textarea (rows 2) · **Paths accordion**, one row per path (1–6 on this board) | 2 boxes |

No panel has two equal full-width boxes. The Lane panel's tallest region is a
list of one-line rows; the Step panel's is a row of 4:3 images. The placeholder
is not a low-fidelity version of any of them — it is a different layout, so the
swap is a re-flow rather than a fill-in.

### Why it always paints

`DeferredSkeleton` holds 250 ms before painting, so a fast query never flashes.
These four queries are **not** fast — each hook is a strictly sequential
waterfall of round-trips, not one request:

```ts
// useLaneSpec.ts — the comment is explicit about why
// "Three round-trips rather than one: the sibling lanes cannot be found until
//  the lane's own scenario is known, and the cell count cannot be counted
//  until the siblings are."
const { data: lane }     = await client.from('lanes').select(…)   // 1
const { data: siblings } = await client.from('lanes').select(…)   // 2 — needs 1
const { count }          = await client.from('cells').select(…)   // 3 — needs 2
```

Counts: Lane 3, Phase 4, Step 4, Scenario 4. At any realistic RTT the total
clears 250 ms every time, so **the skeleton paints on every open of all four
panels.** Fidelity here is not a nicety about a rare frame; it is the thing the
reader sees each time.

### The measurement that redrew the plan

The original scope treated `CellOverviewSpec` and `CellEvidenceTab` as the two
skeletons that were already correct and should be preserved. Measuring the data
they wait for:

```sql
select (select count(*) from cells)                                as cells,
       (select count(*) from cells
         where coalesce("function",'') <> '' or coalesce(form,'') <> ''
            or jsonb_array_length(coalesce(value_props,'[]'::jsonb)) > 0) as with_spec,
       (select pg_size_pretty(sum(pg_column_size("function")
              + pg_column_size(form) + pg_column_size(value_props)))
          from cells)                                              as spec_bytes,
       (select count(*) from evidence)                             as evidence_rows;
```

| | value |
| --- | ---: |
| cells | **935** |
| cells with `function` | **11** |
| cells with `form` | **8** |
| cells with `value_props` | **11** |
| total spec payload, whole board | **7,772 bytes** |
| cells with `owner` / `perceived_owner` | **0 / 0** |
| evidence rows, whole board | **2** |

*(An earlier revision of this plan said 2,459 bytes. That query summed
`pg_column_size(a) + pg_column_size(b) + pg_column_size(c)` per row — NULL if
any one column is NULL, so `sum()` skipped almost every row. Columns measured
separately above.)*

`useCellSpec` is keyed `cell-spec:<id>` — 935 distinct cache keys, one request
each. With `staleTime: Infinity` ([queryClient.ts:18](../../src/lib/queryClient.ts)) each is
fetched once per session, so browsing 100 cells costs 100 round-trips. They are
guarding **7.8 KB**, and 924 of every 935 return nothing at all. `useEvidence`
is the same pattern guarding two rows.

The entire dataset is smaller than the request headers used to fetch it. The
correct placeholder for these two surfaces is no placeholder, because the
correct query is no query.

**This is the plan's central finding, and it inverts the obvious instinct.**
"Fetch on demand rather than up front" is normally the performance-conscious
choice. Here per-cell fetching *is* the performance problem: it converts one
7.8 KB response into up to 935 sequential ones, each gated behind a panel open.

## Proposed solution

Split the work by whether the query deserves to exist.

### Tier A — delete the query (cells)

Opening one cell fires **three** per-cell round-trips today, not two:

| Hook | Fetches | Reality |
| --- | --- | --- |
| `useCellContent` | content, summary, maturity, links, **owner, perceived_owner** | **Four of six are already in the board query.** The other two are empty on all 935 cells — this trip fetches nothing. |
| `useCellSpec` | function, form, value_props | 7.8 KB across the whole board |
| `useEvidence` | evidence rows | 2 rows in the entire database |

All three move into the board query — `owner`, `perceived_owner`, `function`,
`form`, `value_props`, and an evidence index. **+8.3 KB on a ~374 KB payload,
about 2%.** `CellOverviewSpec`, `CellContentSection` and `CellEvidenceTab` then
read from memory, have no loading state, and their skeletons are deleted as
dead code.

### Tier B — keep the query, fix the placeholder (entities)

The four entity hooks are genuine multi-request waterfalls computing per-entity
joins and counts. They cannot be preloaded into one response without a view or
an RPC, which is out of scope here. They keep their queries and get placeholders
shaped like what they load.

### Preserved unchanged

`DeferredSkeleton` is the part of this system that is already ahead of the
reference implementation and must not be touched:

- 250 ms hold before painting, so a warm load shows nothing
- mounted at `opacity-0` during the hold, so geometry is live from frame 1 and
  the canvas camera pre-fits against the placeholder rectangles
- shared session by `holdKey`, so a waterfall spanning components shows one
  skeleton for the whole chain rather than one per stage

`BlueprintPanelLoadingSkeleton` also stays: its dimensions come from
`getBlueprintArtboardSize` on real step and lane counts, so it is the finished
rectangle rather than an estimate.

## Technical approach

### Benchmark: Supabase Studio

Read from source, not memory —
`packages/ui-patterns/src/ShimmeringLoader/index.tsx` and
`apps/studio/CLAUDE.md`.

Their four-state doctrine, verbatim from the studio guide:

```tsx
if (isLoading) return <GenericSkeletonLoader />
if (isError) return <AlertError error={error} subject="Failed to retrieve data" />
if (isSuccess && data.length === 0) return <EmptyState />
return <DataDisplay data={data} />
```

Their three components:

| Component | Shape |
| --- | --- |
| `ShimmeringLoader` | one bar; `delayIndex` × `animationDelay` staggers siblings 150 ms apart |
| `GenericSkeletonLoader` | three bars at 100% / 75% / 50% — used **only where the shape is unknown** |
| `GenericTableLoader({ headers, numRows })` | a real `<Table>` with the **actual header strings** and the **actual row count** |

**What we take:** the `GenericTableLoader` principle. Where the shape is known,
the placeholder is built from the real shape — not a generic stand-in. Our
`PanelLoading` is `GenericSkeletonLoader` deployed in four places where
`GenericTableLoader` belongs.

**What we take:** the fourth state. Our panels have loading and error and no
empty state; `LanePanel` renders a full form of blank fields for a lane with
nothing recorded, which reads as a loaded form the reader has to inspect to
discover is empty.

**What we do not take:** their timing. Supabase has no hold — every fast query
flashes a placeholder — and no cross-component session. Ours is better on both
counts and this plan changes neither.

**What we do not take:** `delayIndex` stagger. It is a decoration that makes a
placeholder look busy. Our pulse is one shared rhythm keyed off
`[data-slot=skeleton]` in `animations.css`, which is a deliberate choice
recorded in [skeleton.tsx](../../src/components/ui/skeleton.tsx) and stays.

### Architecture

```
DeferredSkeleton            timing contract        (unchanged)
  └── Skeleton              the bar primitive      (unchanged)

PanelLoading                                       (REPLACED)
  ├── PanelLoadingFields    n textareas of stated row counts
  ├── PanelLoadingForm      select + input + two string-lists
  ├── PanelLoadingStep      textarea + optional frame row
  └── PanelLoadingPaths     textarea + n accordion rows

PanelEmpty                                         (NEW — the fourth state)
```

### Implementation units

---

#### Unit 1 — Cell spec and evidence load once, with the board

**Goal.** Delete three per-cell round-trips, and with them two skeletons and two
loading states.

**Files**
- `src/hooks/useCellSpec.ts` — becomes a lookup into a service-wide result
- `src/hooks/useEvidence.ts` — same
- `src/hooks/useCellSpecIndex.ts` *(new)* — one query, keyed `cell-specs:<serviceId>`
- `src/hooks/useEvidenceIndex.ts` *(new)* — one query, keyed `evidence:<serviceId>`
- `src/components/blueprint/CellOverviewSpec.tsx` — drop the `DeferredSkeleton` branch
- `src/components/blueprint/CellEvidenceTab.tsx` — drop `EvidenceLoadingSkeleton`

**Approach.** Both indexes select every row for the service once and shape to
`Map<cellId, …>`. `useCellSpec(cellId)` and `useEvidence(cellId)` keep their
signatures and return shapes — every call site is unchanged — but read from the
index instead of issuing a request. `invalidateEvidence(cellId)` invalidates the
index key rather than a per-cell key; the comment at
[useEvidence.ts:9](../../src/hooks/useEvidence.ts) explaining why the old
reload-token approach failed stays relevant and should be carried forward.

**Patterns to follow.** `useSlices` ([useSlices.ts](../../src/hooks/useSlices.ts)) is exactly this
shape already, and its doc comment states the rationale in one line: *"powers
client-side membership checks … without per-cell queries."* This unit applies
the decision that hook already made to the two hooks that missed it.

**Growth check — the number that would reverse this.** Plan
`2026-08-20-005-feat-spec-fill-campaign` fills `function` and `form` board-wide.
At full fill: 935 cells × roughly 260 bytes ≈ **240 KB raw, ~50 KB gzipped**, in
one response. Still two orders of magnitude cheaper than 935 requests. Record
the reversal threshold in the hook doc comment: **if the combined index exceeds
~1 MB raw, split it per phase.** Not before.

**Verification.** Open ten different cell panels with the network tab filtered
to `cells?select=function`; expect exactly one request across all ten, not ten.
`CellOverviewSpec` renders its section in the same commit as the panel body,
with no reserved-then-collapsed space.

---

#### Unit 2 — A placeholder per panel, shaped from what loads

**Goal.** Replace one generic placeholder with four that match their panels.

**Files**
- `src/components/blueprint/panelLoading.tsx` *(new — extracted from `panelShell.tsx`)*
- `src/components/blueprint/panelShell.tsx` — re-export for existing importers
- the four panels' loading branches

**Approach.** Every variant opens with the same identity block, because every
panel does: a badge chip, a title bar, and a meta line. What differs is below it.

```tsx
// panelLoading.tsx
function PanelLoadingIdentity() {
  return (
    <div className="flex flex-col gap-1.5">
      {/* The badge is a chip, not a bar — every loaded panel opens with one. */}
      <Skeleton className="h-4 w-16 rounded-full" />
      <Skeleton className="h-5 w-40" />
    </div>
  )
}

/** Phase: three textareas at the row counts the loaded panel uses. */
export function PanelLoadingFields({ rows }: { rows: number[] })

/** Lane: a select, an input, and two string-lists of one row each. */
export function PanelLoadingForm()

/** Step: a textarea, and a frame row only when the step has frames. */
export function PanelLoadingStep({ frames }: { frames: number })

/** Scenario: a textarea and one accordion row per path. */
export function PanelLoadingPaths({ paths }: { paths: number })
```

Heights come from the same constants the loaded fields use, so a textarea
placeholder at `rows={3}` is the height of a `rows={3}` textarea rather than a
number that matched once.

**Counts from real data, and honestly about the limit.**

| Panel | Count source | Known before the query? |
| --- | --- | --- |
| Phase | fixed — three fields | yes, statically |
| Lane | fixed — four fields | yes, statically |
| Step | frames from the canvas store's `step_visual` cells | yes |
| Scenario | paths **currently displayed** on the canvas | partially — see below |

The scenario case has a real limit worth stating rather than papering over.
`useScenarioPaths` reads paths from the database precisely because *"the canvas
holds only the paths currently selected for display"*
([useScenarioPaths.ts:13](../../src/hooks/useScenarioPaths.ts)). So the free
client-side count can **undercount** when paths are filtered out of view. That
is still strictly better than a fixed guess, and it matches what the reader is
looking at. Do not add a query to make the placeholder more accurate — a request
issued to improve a placeholder has inverted the entire point.

**Verification.** Throttle to Slow 3G, open each panel, screenshot the
placeholder frame and the loaded frame, and confirm no region changes height
across the swap.

---

#### Unit 3 — The fourth state

**Goal.** A panel whose entity has nothing recorded says so, instead of
presenting a form of blank fields.

**Files**
- `src/components/blueprint/panelShell.tsx` — add `PanelEmpty`
- the four panels

**Approach.** Follow the Supabase early-return ordering exactly, since our three
existing branches are already in that order:

```tsx
if (result.status === 'loading') return <PanelLoadingForm />
if (result.status === 'error')   return <PanelLoadError subject="lane" />
if (isEmpty(lane) && !canEdit)   return <PanelEmpty … />
return <LanePanelBody lane={lane} … />
```

**The `!canEdit` guard is the whole subtlety.** In Edit mode a blank form is
correct — it is how a value gets recorded. The empty state belongs to View
mode, where a blank form is a dead end. This is why the fourth state cannot be
copied from Supabase unchanged: Studio has no view/edit split.

Scope: **View mode only.** Emptiness is per panel — a lane with no owner team,
no KPIs and no tools; a phase with all three prose fields blank. Text should
name what is absent, matching the existing read-only line at
[LanePanel.tsx:229](../../src/components/blueprint/LanePanel.tsx): *"Not
specified — no team recorded for this lane."*

**Verification.** A lane with `owner_team` empty and `kpis`/`tools` empty — of
which there are currently **306** — shows the empty state in View mode and the
editable form in Edit mode.

---

#### Unit 4 — The footer stops jumping

**Goal.** `CellInSlicesFooter` reserves its height while slices load instead of
appearing later and shifting the panel.

**Files**
- `src/components/blueprint/CellInSlicesFooter.tsx`

**Approach.** [Line 44](../../src/components/blueprint/CellInSlicesFooter.tsx) collapses
loading into "no matches":

```ts
const rows = slices.status === 'ready' ? slices.data
           : slices.status === 'error' ? (slices.fallback ?? [])
           : []                            // ← loading falls here
const matches = slicesContainingCell(rows, cellId)
if (matches.length === 0) return null      // ← so loading returns null
```

Distinguish the two. While loading, render a `DeferredSkeleton` at the collapsed
trigger's height; when ready with zero matches, keep returning `null`.

**Correctly scoped as minor.** `useSlices` is keyed `slices:first` — one query
for the whole service, `staleTime: Infinity` — so this pops in **exactly once
per session**, on the first cell panel opened. It is worth fixing and it is not
urgent. Recording the true blast radius here so it is not mistaken for a
per-cell bug.

---

#### Unit 5 — A test that fails when they drift

**Goal.** Catch the next divergence between a panel and its placeholder in CI,
not in a screenshot months later.

**Files**
- `src/components/blueprint/panelLoadingContract.test.tsx` *(new)*

**Approach.** Render each panel twice into the same container — once with the
query forced to `loading`, once with a fixture — and assert the **top-level
region count and their ordering** match. Not pixel heights, which would be
brittle; the structural claim, which is the one that broke.

**Patterns to follow.** `src/lib/cellMaturityContract.test.ts` is the working
precedent in this repo: it parses the select list out of the query string and
the key list out of the mapper literal, and asserts nothing selected is dropped.
It caught `cells.position` being silently unmapped since August. Same idea, one
layer up.

**The test must be proven to fail.** Delete one field from a panel body, confirm
red, restore. A contract test never observed failing is a contract test that
does not hold — this is exactly how the maturity test earned its keep.

## Alternative approaches considered

**Keep one generic placeholder, accept the mismatch.** Defensible when a
placeholder rarely paints. Rejected on the measurement: these four waterfalls
clear the 250 ms hold every time, so it always paints.

**Prefetch entity specs on cell hover.** Would hide the waterfall behind pointer
intent. Rejected as premature — it optimizes latency the user has not complained
about, adds a speculative-request policy to reason about, and does nothing about
fidelity, which is the actual complaint.

**Collapse each entity waterfall into one RPC.** The real fix for Tier B's
latency and it would shorten every one of these to a single round-trip. Rejected
as **out of scope, not as wrong** — it is a database-surface change and this is
a front-end plan. Worth its own plan; note it as follow-up.

**Adopt Supabase's `delayIndex` stagger.** Rejected: our single shared pulse is
a deliberate decision recorded in the component, and a staggered cascade makes a
placeholder look like activity rather than reserved space.

## System-wide impact

**Interaction graph.** Unit 1 moves two hooks from per-cell keys to
service-wide keys. Everything downstream reads through the unchanged hook
signatures, so the blast radius is the two hooks and their two skeleton
branches. The one behavioural edge: `invalidateEvidence` currently drops one
cell's cache; against an index it drops the whole index and every mounted reader
refetches. With two evidence rows on the board this is free, and the reversal
threshold above covers the case where it stops being free.

**Error propagation.** Tier A folds two error surfaces into one. A failed index
fetch means *no* cell shows spec, where previously one cell failed alone. Given
the index is a single small request that either lands with the board or does
not, a shared failure is more honest than 935 independent ones — but the error
copy must say so rather than implying this cell in particular is broken.

**State lifecycle.** No writes change. `AddSourceForm` still inserts one
evidence row; only the invalidation target moves.

**API surface parity.** The agent tool surface reads cell spec through its own
path (`src/lib/agent/tools/specs.ts`) and is unaffected — the hooks are React
only. Confirm during implementation that no agent tool imports `useCellSpec`.

**Integration test scenarios** — the cross-layer cases unit tests with mocks
would not catch:

1. Open ten cell panels; assert exactly one `cells?select=function…` request.
2. Add an evidence source, then reopen the panel: the new row is present (the
   invalidation actually reached the index).
3. Open a Lane panel on a throttled connection: assert no region changes height
   between the placeholder frame and the loaded frame.
4. Open a Scenario panel with paths filtered out of view: assert the placeholder
   undercounts rather than throwing or rendering zero rows.
5. View mode, lane with no owner/KPIs/tools: empty state. Edit mode, same lane:
   editable form.

## Acceptance criteria

### Functional

- [ ] Opening N cell panels issues **one** cell-spec request and **one**
      evidence request, not N of each
- [ ] `CellOverviewSpec` and `CellEvidenceTab` have no loading branch and no
      skeleton
- [ ] Each of the four entity panels renders a placeholder matching its own
      loaded region count and ordering
- [ ] Textarea placeholder heights derive from the same row counts the loaded
      fields use
- [ ] Step and Scenario placeholders take their counts from data already in
      memory; neither issues a request to shape a placeholder
- [ ] View mode with nothing recorded shows an empty state; Edit mode shows the
      editable form
- [ ] `CellInSlicesFooter` reserves height while loading and still returns
      `null` when ready with zero matches

### Non-functional

- [ ] `DeferredSkeleton` untouched — hold, `opacity-0` mount, `holdKey` session
      all intact
- [ ] Placeholders keep `aria-hidden` and the single shared pulse
- [ ] Reduced-motion readers get a still bar, as today

### Quality gates

- [ ] `npm run typecheck` · `npm run lint` · `npm test` green
- [ ] The contract test is **observed failing** against a deliberately broken
      panel, then restored
- [ ] Before/after screenshots at Slow 3G for all four panels

## Success metrics

| | before | target |
| --- | ---: | ---: |
| requests to read spec for 100 cells | 100 | **1** |
| requests to read evidence for 100 cells | 100 | **1** |
| panels whose placeholder matches their shape | 0 of 4 | **4 of 4** |
| panel states implemented | 3 of 4 | **4 of 4** |
| layout shift on panel swap | present | none |

## Dependencies & risks

**No blockers.** Nothing here waits on the open content questions.

| Risk | Mitigation |
| --- | --- |
| Spec index grows past usefulness after the fill campaign | Threshold documented in the hook (~1 MB raw → split per phase); recheck after plan 005 lands |
| Index-wide invalidation refetches more than needed | Trivial at current size; same threshold governs |
| Contract test becomes brittle and gets skipped | Assert structure and ordering only — never pixel heights |
| Placeholder variants drift as panels change | That is precisely what Unit 5 exists to catch |

## Documentation plan

- `docs/reference/ui-inventory.md` — replace the single `PanelLoading` entry
  with the four variants and `PanelEmpty`
- Hook doc comments on both new indexes — state the reversal threshold in the
  code, where the next person changing it will actually read it
- `docs/reference/panel-affordances.md` — add the fourth state to the panel
  state vocabulary

## Follow-up, deliberately not in this plan

Collapsing each entity spec waterfall into one RPC. It is the real fix for
Tier B latency — 3–4 sequential round-trips become one — and it would make the
placeholders paint far less often. Database-surface change; own plan.

## Sources & references

### Internal

- [panelShell.tsx:474](../../src/components/blueprint/panelShell.tsx) — `PanelLoading` as it stands
- [deferred-skeleton.tsx](../../src/components/ui/deferred-skeleton.tsx) — the timing contract to preserve
- [useLaneSpec.ts:36](../../src/hooks/useLaneSpec.ts) — the waterfall, documented in its own comment
- [useSlices.ts](../../src/hooks/useSlices.ts) — the service-wide-index pattern Unit 1 generalises
- [queryClient.ts:18](../../src/lib/queryClient.ts) — `staleTime`/`gcTime` Infinity
- [cellMaturityContract.test.ts](../../src/lib/cellMaturityContract.test.ts) — the contract-test precedent
- [EditorLoadingSkeletons.tsx](../../src/components/editor/EditorLoadingSkeletons.tsx) — the placeholder that is already right

### External

- `supabase/supabase` → `packages/ui-patterns/src/ShimmeringLoader/index.tsx`
- `supabase/supabase` → `apps/studio/CLAUDE.md`, four-state doctrine

### Related plans

- `2026-08-20-005-feat-spec-fill-campaign-plan.md` — grows the spec index; the
  reversal threshold is set against it

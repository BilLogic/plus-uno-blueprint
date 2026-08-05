---
title: Land the Supabase-aligned design system on the active feature line
type: refactor
status: completed
date: 2026-08-05
---

# ♻️ Land the design system on the active feature line

## Overview

`claude/blueprint-design-system-57db6a` (`40f5255`, 35 commits, 101 files) executes
`docs/plans/2026-08-04-001-refactor-supabase-design-system-alignment-plan.md` end to
end. It is green on its own terms — `npm run build` passes, `npm test` passes 116
assertions across 2 files. It is also based on a `main` that has not moved since the
fork, while `feat/derived-layer-slices` has moved 116 commits and 214 files, 100 of
them new files under `src/`.

So this is not "does the design system work" — it does. It is "how do two
independently-correct 100-file branches become one," where one rewrote the token
vocabulary and the other wrote a hundred new components against the old one.

The measured answer is: much smaller than the file counts suggest. **9 content
conflicts, 1 modify/delete, 2 silent-breakage sites.** Every conflict is
individually diagnosed below.

## Problem Statement

### 1. The divergence is one-sided, which decides the merge direction

`main` is byte-identical to the fork point `b0648f6`. Nothing has landed on it. Both
branches descend from it directly:

```
b0648f6 (main) ──┬── 40f5255  claude/blueprint-design-system-57db6a  (35 commits, 101 files)
                 └── 6d5031a  feat/derived-layer-slices              (116 commits, 214 files)
```

Because the design branch is a direct descendant of `main`, it can land there
**without a merge at all** — a fast-forward. The feature branch then absorbs it as an
ordinary "merge main in," which is the merge every long-lived branch does anyway.

The alternative — merging the design branch sideways into the feature branch — makes
the design system hostage to the feature work: it never becomes independently
reviewable or deployable, and if the slices work stalls, so does the rebrand.

### 2. The token vocabulary changed under 100 new files

The branch renames role-first: `--blueprint-cell-bg-hover` →
`--background-blueprint-cell-hover`, `--blueprint-cell-ring-soft` →
`--ring-blueprint-cell-soft`, `--sidebar-hover` → deleted, `--font-heading` → deleted.
Token count goes 121 → 419.

A rename like that normally means auditing every consumer. Census across the feature
branch's 100 new files says otherwise:

| Removed thing | Sites in feature-branch-only files |
| --- | --- |
| `bg-sidebar-hover` | 2 — `AgentPanel.tsx`, `EditorRail.tsx` |
| `font-heading` | 0 |
| `--blueprint-panel-*` | 0 |
| `--blueprint-cell-*` | 0 |
| `BLUEPRINT_CELL_PALETTE`, `getBlueprintCellInteractionColors`, `getTechPillFill`, `PATH_TYPE_BADGE_CLASSES` (+6 more removed exports) | 0 |

Two sites. The new work happened to route through semantic tokens and the `ui/`
primitives rather than reaching for blueprint internals, which is exactly what
`AGENTS.md` asks for and why the blast radius collapsed.

### 3. `src/index.css` is a modify/delete, and both sides fixed the same bug

The branch deletes `src/index.css` (670 lines) in favour of 21 files under
`src/styles/`. The feature branch added 21 lines to it. Three hunks:

- `[data-blueprint-cell-anchor][data-slice-picked]` — draft-pick outline.
- `[data-slice-pick-badge]` added to the badge fade transition.
- **`--sidebar-hover` redefined darker**, with a comment: *"brightening a
  0.985-lightness surface clamps to pure white — a hover state that mathematically
  cannot be seen."*

That third one is the interesting collision. The branch **deletes** `--sidebar-hover`,
justifying it as *"ours was a verbatim alias of `--sidebar-accent`"* — true at the fork
point, stale now. But the branch independently fixed the same invisible-hover bug by a
different mechanism: `semantic.css:149` makes `--accent` a *subtractive* overlay,
`oklch(from var(--foreground) l c h / var(--accent-alpha))`, which darkens in light mode
instead of brightening. Same bug, solved twice, two mechanisms.

The branch's mechanism is the better one (it is systemic, not a per-token patch), so
the feature branch's local darkening gets dropped. But light `--surface` also moved
from `0.985` to `0.995` (`themes/light.css:27`), so the visibility that motivated the
original patch must be **re-verified**, not assumed.

### 4. Two test harnesses, and `AGENTS.md` documents the one being replaced

| | `feat/derived-layer-slices` | design branch |
| --- | --- | --- |
| `npm test` | `node scripts/tests/run.mjs` | `vitest run` |
| Tests | 11 `.test.mjs`, 1,228 lines, `node:test` + `node:assert/strict` | 2 `.test.ts`, 116 assertions, vitest |
| Mechanism | esbuild-compiles listed modules to a temp dir, `node --test` runs the output | native TS via Vite |
| Footgun | a new test module must be added to `run.mjs`'s `MODULES` list or **it silently never runs** — documented in `AGENTS.md:39-40` | none |

`run.mjs`'s own header explains itself: *"this repo has no test runner. Rather than add
one for a handful of pure functions…"* The design branch adds one. The premise expired.

### 5. Residue the branch carries

- Its plan doc has **100 unchecked boxes and zero ticked**, despite being executed. It
  reads as a plan nobody ran.
- `docs/plans/2026-08-05-001-feat-touchpoint-colours-plan.md` collides on sequence
  number with `docs/plans/2026-08-05-001-feat-anon-sandbox-mode-plan.md` on the feature
  branch. No git conflict — different filenames — so this lands silently wrong.
- Five concerns in one branch (CSS split, rename, rebrand, a11y, light/dark, TanStack).
  Phases A and B were *designed* to be independently shippable and aren't. Not worth
  re-splitting now — the 35 commits are sequenced and interdependent, and the result is
  green — but it is the reason Phase 1 below wants a real look before it lands.

## Proposed Solution

Four merges' worth of work, sequenced so each step is independently verifiable:

1. Fast-forward the design branch onto `main`. Nothing to resolve.
2. Merge `main` into `feat/derived-layer-slices`. One resolution pass, 9 conflicts,
   each pre-diagnosed below.
3. Sweep the 2 silent-breakage sites, then unify the test harness.
4. Verify visually — the only check that catches a token that resolves but looks wrong.

Do the work in the existing worktree at
`.claude/worktrees/blueprint-design-system-57db6a`, or a fresh one. Not in the primary
checkout: a half-resolved 9-file conflict is a bad place to be interrupted.

## Technical Approach

### Phase 1 — Land the design branch on `main`

`main` has not moved, so this is `git merge --ff-only`. No conflicts exist to resolve.

Two things to settle first, because after this step they are public:

- [ ] **The teal rebrand and Ubuntu Sans go live on the Netlify site** the moment this
  hits `main`, ahead of any of the slices work. Confirm that is wanted. (The deployed
  site is read-only per `AGENTS.md:50`, so this is a visual question, not a data one.)
- [ ] Tick the 100 checkboxes in
  `docs/plans/2026-08-04-001-refactor-supabase-design-system-alignment-plan.md`, or add a
  header noting which phases shipped in which commits. An executed plan that reads as
  un-executed will get re-executed.
- [ ] Rename `docs/plans/2026-08-05-001-feat-touchpoint-colours-plan.md` →
  `2026-08-05-003-…` before it lands, to clear the sequence collision.
- [ ] Optional but cheap: fix the branch's own review nits first —
  `useSupabaseQuery.ts:52` assigns `fetcherRef.current` in the render body where the
  previous version used an effect (`AGENTS.md:25` explicitly lint-blocks refs during
  render); and `queryKey: [key]` gives every gated hook the shared key `[null]`.
- [ ] Verify in the worktree: `npm run build`, `npm test`, then a browser pass on the
  landing page and one scenario in both themes.

### Phase 2 — Merge `main` into `feat/derived-layer-slices`

```bash
git merge main   # from feat/derived-layer-slices
```

Merge, not rebase. 116 commits rebased is 116 opportunities to re-resolve the same nine
conflicts.

Seven of the nine are **doc-comment adjacency**: the branch's commit `be7c496`
("document every exported component") added JSDoc directly above exports, and the
feature branch added imports and logic in the same regions. Those are unions, not
choices. Two are real structural divergences.

#### `src/components/blueprint/BlueprintCellDetailPanel.tsx` — union

Feature side added `panelEditorBusy()` and the drawer error boundary; branch side added
JSDoc. Keep both, branch's comment above feature's code.

#### `src/components/blueprint/BlueprintLabelRail.tsx` — union

Feature side added three imports (`useCanvasModeValue`, `useCellPick`, `cellsInLane`);
branch side added `/** One row of the left label column… */`. Keep both.

#### `src/components/editor/EditorShell.tsx` — union

Feature side added `RAIL_WIDTH`, `DEFAULT_ASIDE_WIDTH`, `loadAsideWidth()`; branch side
only rewrote the file's top JSDoc. Keep feature's code, take branch's docblock, and
reconcile the two descriptions of aside behaviour into one.

#### `src/components/editor/SidebarNav.tsx` — take branch, both hunks

`hover:bg-sidebar-hover` → `hover:bg-sidebar-accent` (the rename), plus the branch adds
the `data-ancestor` marker-dot `before:` block that the feature side does not have. Take
both. Then confirm the ancestor dot still reads correctly against the feature branch's
current nav tree, which grew rail surfaces after the branch forked.

#### `src/components/editor/PathsSidebarSection.tsx` — merge both intents

Feature side added selected-state weight and full ink (`font-medium
text-sidebar-accent-foreground`) inside a `cn()`; branch side is a flat string that adds
hover classes and does the token rename. Keep feature's `cn()` with its `selected`
branch, add the branch's `hover:bg-sidebar-accent`, and note the branch also changed
`flex-1` → `w-full`.

#### `src/components/editor/CanvasAnnotationToolbar.tsx` — feature structure wins

Feature side gates a pan tool on `designing`, with a comment explaining why Edit needs
one and View does not. Branch side has a single draw slot that swaps to an eraser icon.
Keep the feature's `designing ?` structure; re-apply the branch's eraser-swap and
tooltip content **inside** it.

#### `src/components/editor/SlideModeView.tsx` — discard branch side

Feature side parameterized `SlideModeSidebarNav({ surface })` for the rail surfaces.
Branch side keeps the prop-less version with a local `SidebarMode` type — it predates
the rail work. Take the feature side wholesale; the branch's contribution here is a
one-line docstring worth keeping.

#### `src/components/editor/EditorChrome.tsx` — the one that needs a design call

Two hunks:

- Imports: union — keep `Play` (feature) **and** add `ThemeToggle` (branch).
- Body: genuine divergence. The feature branch rewrote the chrome into a
  breadcrumb (`EDITOR_TITLE` / `summary.glyph` / `summary.title`) with an inline
  `summary.action` play button — the "floating pill IS the collapsed navbar" work
  (`9cc349b`). The branch has `EditorTitleLabel` + `<ThemeToggle />` +
  `SidebarCollapseButton`.

  Feature structure wins. The open question is **where `<ThemeToggle />` goes in the new
  breadcrumb chrome** — it cannot just slot in where the branch put it, because that
  slot no longer exists. Decide deliberately; it is a persistent affordance in the app's
  most crowded 32px.

#### `package.json` / `package-lock.json`

- [ ] Add: `@tanstack/react-query@5.101.4`, `framer-motion@12.43.0`, `next-themes@0.4.6`,
  `@tailwindcss/forms@0.5.11`, `@tailwindcss/typography@0.5.20`,
  `@fontsource-variable/ubuntu-sans`, `vitest@^4.1.10`.
- [ ] Remove: `@fontsource-variable/inter`, `@fontsource-variable/manrope`,
  `@radix-ui/react-slot` (0 importers).
- [ ] `@base-ui/react`: branch pins `1.7.0` exact, feature branch has `^1.6.0`. Take the
  exact pin — the branch's `ui/` restyle was measured against it.
- [ ] `"test"`: see Phase 4. Do not silently take one side.
- [ ] Regenerate the lockfile with `npm install` rather than hand-resolving it.

#### `src/index.css` — delete, port three hunks

- [ ] `git rm src/index.css`. `src/main.tsx` already points at
  `src/styles/tailwind.config.css` on the branch side.
- [ ] Port `[data-blueprint-cell-anchor][data-slice-picked]` into
  `src/styles/blueprint.css`, converting `var(--primary)` to whatever the branch's
  equivalent role token is.
- [ ] Port `[data-slice-pick-badge]` into the badge-fade rule, and carry the comment
  explaining why pick badges deliberately survive the far-zoom threshold.
- [ ] **Drop** the `--sidebar-hover` redefinition. Superseded by the branch's
  subtractive-alpha `--accent`. Then re-verify (Phase 5) — light `--surface` moved
  `0.985` → `0.995`, so the invisible-hover failure this patch existed to fix must be
  confirmed actually fixed, not assumed.

Exit criteria: `npm run build` passes (it is the real type-check — `AGENTS.md:43`).

### Phase 3 — Sweep the silent-breakage sites

The nine conflicts announce themselves. These do not: they merge clean and compile,
then render wrong.

- [ ] `src/components/editor/AgentPanel.tsx` — `bg-sidebar-hover` → `bg-sidebar-accent`.
- [ ] `src/components/editor/EditorRail.tsx` — same.
- [ ] Re-run the census after resolution, since resolving 9 files can reintroduce a
      stale token:
      ```bash
      grep -rn 'sidebar-hover\|font-heading\|--blueprint-cell-bg\|--blueprint-panel-' src/
      ```
      Expected: zero hits.
- [ ] `npm run lint`. The baseline is tracked and already broken on both sides — 58
      problems on the feature branch, 71 on the design branch, same pre-existing
      `_unusedVar` / `vite-env.d.ts` pattern. Do not regress *past* the union;
      `AGENTS.md:41` says the baseline is ~63, which will need updating either way.

### Phase 4 — One test harness

Take vitest and retire `run.mjs`. It is the harness with no silent-skip footgun, and
`run.mjs`'s own stated premise ("this repo has no test runner") no longer holds.

The migration is near-mechanical because both use `node:assert/strict`, which vitest
supports unchanged:

- [ ] In each of the 11 `scripts/tests/*.test.mjs`: `import { test } from 'node:test'` →
      `import { test } from 'vitest'`. Nothing else changes — the assertions stay.
- [ ] Widen the vitest `include` in `vite.config.ts`:
      ```ts
      include: ['src/**/*.test.ts', 'scripts/tests/**/*.test.mjs'],
      ```
- [ ] Delete `scripts/tests/run.mjs` and its `MODULES` list.
- [ ] `"test": "vitest run"` in `package.json`.
- [ ] Update `AGENTS.md:39-40`: the node:test/MODULES paragraph is now wrong, and the
      footgun it warns about no longer exists. Also update the lint baseline number.
- [ ] Confirm the count: 116 vitest assertions + whatever the 11 migrated files
      contribute. Any drop means a file stopped being collected.

Fallback if a migrated file misbehaves: keep both scripts (`test` = vitest, `test:node`
= `run.mjs`) as a temporary state, with a follow-up. Do not leave it there — two
harnesses is how a test stops running without anyone noticing.

### Phase 5 — Visual verification

The only check that catches a token which resolves correctly and still looks wrong. Nothing
in Phases 1–4 can find these.

- [ ] Every scenario × every view (single / side-by-side / integrated, every path) in
      **light and dark**. `sb:render-checker` drives exactly this walk and collects
      console errors; use it against a local dev server.
- [ ] **Sidebar hover in light mode, specifically.** The bug both sides fixed. Hover a
      nav row, an unselected path row, a slice row. Confirm visible separation from both
      the resting surface and the selected fill.
- [ ] The presentation stage. It pins `.dark` on its own subtree; confirm root
      light/dark does not fight it (`ThemeToggle`'s docstring claims exemption — verify).
- [ ] Print. `src/styles/print.css` is 110 lines carved out of `index.css`; print one
      scenario and one slice.
- [ ] `forced-colors: active`. New in this branch, so there is no baseline — check the
      canvas and one dialog.
- [ ] Focus rings on the surfaces the plan called out: `NavbarSlideTitleNav`, blueprint
      cells, the resize handle.
- [ ] The new `Alert` `info` / `success` variants, which no feature-branch code uses yet.

### Phase 6 — Absorb the residue

- [ ] `docs/agent/ui-inventory.md` — the need→primitive map (`AGENTS.md:12`). Add
      `ThemeToggle`, the new `Alert` variants, and any `ui/` primitive whose variants
      changed.
- [ ] Re-read `AGENTS.md` end to end against the merged tree. Section 6 names
      `ui/` as base-ui flavor with `render={...}`; confirm the `1.7.0` pin does not move
      that.
- [ ] Decide the fate of
      `docs/plans/2026-08-05-003-feat-touchpoint-colours-plan.md` (renamed in Phase 1).
      It proposes making touchpoint colours a stored, editable product fact — which
      overlaps the feature branch's `pathColorTheme` work. Sequence it explicitly rather
      than letting two plans own the same tokens.

## Alternative Approaches Considered

**Re-split the design branch into Phase A/B/C-G stacked PRs.** Its own plan designed A
(a11y) and B (file move) as independently shippable, and shipping the a11y fixes alone
has real value. Rejected: the 35 commits are sequenced and interdependent — the token
rename (B) is a prerequisite for most of C–G, and the branch is green as a unit.
Re-splitting is a second full pass of work to buy reviewability of a branch that already
passes.

**Rebase `feat/derived-layer-slices` onto the design branch.** Gives linear history.
Rejected: 116 commits, 9 conflicting files, and the conflicts are in files the feature
branch touched repeatedly — the same resolution would recur across many commits. One
merge commit, one resolution.

**Merge the design branch sideways into the feature branch, leaving `main` alone.**
Rejected: the design system never becomes independently reviewable or deployable, and it
inherits the feature branch's timeline. `main` has not moved; there is no reason not to
use that.

**Keep `src/index.css` alongside `src/styles/`.** Rejected outright — two sources for the
same token is the failure the branch exists to remove, and the cascade would silently
pick a winner by import order.

## System-Wide Impact

### Interaction graph

`App.tsx` gains two providers wrapping everything: `QueryClientProvider` outermost, then
`ThemeProvider` (`attribute="class"`, `defaultTheme="light"`, `enableSystem`), then the
existing `SupabaseProvider` → `EditorProvider` → `ViewStateProvider` →
`PathSelectionProvider` → `TooltipProvider` chain. Consequences:

- Every read hook now goes through TanStack's cache. `useSupabaseQuery` keeps its
  discriminated-union return, so no call site changes — but cache *behaviour* does:
  `staleTime: Infinity`, `gcTime: Infinity`, `retry: false`,
  `refetchOnWindowFocus: false`. Revalidation is explicit only, via a key change or
  `invalidateQueries(prefix)`.
- `invalidateQueries` stays a plain module-level function (`lib/queryClient.ts`), so the
  mutation wrappers in `AGENTS.md:32-35` (`authoringRpc.ts`, `cellContentMutations.ts`,
  `cellSpecMutations.ts`, `sliceMutations.ts`) call it unchanged. Verify each still
  invalidates the right prefix — the matching is now a prefix match on `queryKey[0]`,
  not the old listener set.
- `next-themes` writes `class` and `color-scheme` on `<html>`. Anything that reads or
  sets a root class — canvas export, print, the presentation stage's own `.dark` — now
  shares that attribute with a library.

### Error and failure propagation

`retry: false` plus `raceSupabaseQuery`'s per-attempt timeout means a failed read goes
straight to the bundled-fixture fallback rather than a retry schedule. `query.error`
wins over a stale `query.data`, so a failed *refetch* after `invalidateQueries` flips a
`ready` surface to `error` with the fixture as fallback — same as the pre-merge
behaviour, but confirm on the authoring paths, where a failed post-write invalidation is
now the most likely way to see it.

### State lifecycle risks

`gcTime: Infinity` means no eviction, ever. Fine at current key cardinality (per
blueprint / scenario / slice); it becomes a leak if keys ever go per-cell. Worth a note
in `queryClient.ts` rather than a fix.

### API surface parity

The token rename is the parity surface. `--background-blueprint-cell-*` /
`--ring-blueprint-cell-*` must be spelled identically in `blueprintCellStyle.ts`,
`ui/button.tsx`'s `blueprint` and `blueprintPill` variants, `styles/blueprint.css`, and
`BlueprintStepVisual.tsx`'s inline override. The branch's `palette.test.ts` pins the
TypeScript side against `colors.css` on disk — extend it to cover any token this merge
touches, so the next drift fails a test instead of a screenshot.

### Integration scenarios unit tests will not catch

1. Author a cell, save, and confirm the invalidation refetch repaints — exercises the
   mutation wrapper → `invalidateQueries` prefix match → `useQuery` refetch chain end to
   end.
2. Toggle to dark, open the presentation stage, exit. The stage pins its own `.dark`;
   confirm the root toggle survives the round trip.
3. Pick cells for a draft slice at far zoom. Exercises both ported `index.css` hunks
   (`data-slice-picked` outline, `data-slice-pick-badge` surviving the zoom threshold) in
   the new stylesheet.
4. Fail a read with the network offline and confirm the fixture fallback still renders,
   with `retry: false`.
5. Hover every sidebar row type in light mode. The regression this merge is most likely
   to introduce.

## Acceptance Criteria

### Functional

- [ ] `main` contains the design system; the Netlify deploy renders the rebrand.
- [ ] `feat/derived-layer-slices` contains `main`, with all 9 conflicts resolved per the
      per-file guidance above.
- [ ] `src/index.css` is gone; its three feature-branch hunks live in `src/styles/`.
- [ ] `grep` for the four removed token families returns zero hits under `src/`.
- [ ] One test harness. `npm test` runs both the 2 `.test.ts` and the 11 migrated
      `.test.mjs` files, with a stated total assertion count.
- [ ] `<ThemeToggle />` has a deliberate home in the merged `EditorChrome`.

### Non-functional

- [ ] `npm run build` passes on both branches.
- [ ] `npm run lint` does not exceed the union of the two baselines; `AGENTS.md`'s number
      is updated.
- [ ] Sidebar hover is visibly distinct from resting *and* selected, in light mode, on
      every row type.
- [ ] Focus indicators still clear SC 1.4.11 after resolution — the resolved files
      include several the a11y phase touched.
- [ ] No new console errors across the full scenario × view walk.

### Quality gates

- [ ] `palette.test.ts` extended to cover tokens this merge touched.
- [ ] `AGENTS.md` and `docs/agent/ui-inventory.md` match the merged tree.
- [ ] The design-system plan doc reads as executed.

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A clean auto-merge references a renamed token and only fails visually | Medium | High | Phase 3 grep sweep + Phase 5 full walk. This is the merge's main failure mode |
| `--sidebar-hover` deletion reintroduces invisible hover — light `--surface` moved 0.985 → 0.995 | Medium | Medium | Explicit Phase 5 check on every row type; the branch's subtractive `--accent` should cover it, but it was retuned after the original fix |
| `EditorChrome` resolution loses the breadcrumb or the play action | Medium | Medium | Feature structure wins by default; only `ThemeToggle` is ported in |
| Migrating 11 node:test files to vitest silently drops one | Low | High | Assert the total count before and after; a drop means a file stopped being collected |
| Teal rebrand goes public before the slices work is ready | High | Low–Medium | Deliberate call in Phase 1. Deployed site is read-only |
| `CanvasAnnotationToolbar` resolution loses the eraser swap or the pan tool | Medium | Low | Both intents are named explicitly in the per-file guidance |
| Lockfile hand-resolved into an inconsistent tree | Low | Medium | Regenerate with `npm install`, never resolve by hand |
| The touchpoint-colours plan and `pathColorTheme` end up owning the same tokens | Medium | Medium | Phase 6 sequences them explicitly |

## Sources & References

### Internal

- Design branch: `claude/blueprint-design-system-57db6a` @ `40f5255`, worktree at
  `.claude/worktrees/blueprint-design-system-57db6a`
- Its plan: `docs/plans/2026-08-04-001-refactor-supabase-design-system-alignment-plan.md`
  (Phases A–G, 100 unchecked boxes)
- `docs/plans/2026-08-05-001-feat-touchpoint-colours-plan.md` — sequence collision
- `src/styles/tailwind.config.css` — import-only entry, ordering is load-bearing
- `src/styles/semantic.css:149` — `--accent` as subtractive foreground overlay
- `src/styles/semantic.css:217-232` — sidebar tokens; `:226-227` states the
  `--sidebar-hover` rationale that is stale w.r.t. the feature branch
- `src/styles/themes/light.css:27` — `--surface: 0.995`
- `src/index.css:179-190` (feature branch) — the darker `--sidebar-hover` and its reason
- `src/hooks/useSupabaseQuery.ts:52` — ref assigned in render body
- `src/lib/queryClient.ts` — module singleton, `invalidateQueries` prefix match
- `scripts/tests/run.mjs:1-36` — the esbuild/MODULES harness and its stated premise
- `AGENTS.md:12,25,32-35,39-44` — ui-inventory pointer, refs-during-render rule, mutation
  wrappers, commands and the lint baseline

### Verification commands used

```bash
git merge-tree --write-tree --messages HEAD claude/blueprint-design-system-57db6a
git worktree add --detach /tmp/uno-merge HEAD && git merge --no-commit --no-ff <branch>
npm run build && npm test && npm run lint   # in the design worktree
```

### Notes

Conflict diagnoses come from a real trial merge, not from `merge-tree` summaries — every
per-file recommendation above was read off actual conflict hunks. The design branch was
built and tested in its own worktree with its own `node_modules`. Research for this plan
was done inline rather than delegated to subagents.

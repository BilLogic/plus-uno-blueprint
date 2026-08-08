---
title: Desktop UI refinements — five proposals with before/after drafts
type: feat
status: draft
date: 2026-08-08
---

# Desktop UI Refinements — before vs. after

> Status **draft**: these are proposals for review, not committed scope. The user is not yet convinced — each item below shows the exact before/after so the change can be judged concretely. Nothing here is prerequisite for the mobile plan (2026-08-08-001).

## 1. Semantic zoom — the overview becomes a table of contents

**Problem.** At overview zoom (0.05–0.2) every cell still renders its full card: title text, icons, borders — all shrunk to illegible smudge. The user sees *shape* but reads nothing. The first screen every visitor lands on is the least designed.

**Before (today, overview zoom):**
```
┌────────────────────────────────────────────────┐
│ ▪▪▪▪▪▪ ▪▪▪▪▪▪ ▪▪▪▪▪▪ ▪▪▪▪▪▪ ▪▪▪▪▪▪ ▪▪▪▪▪▪     │  ← phase headers: 4px grey smudge
│ ░░░░ ░░░░ ░░░░ ░░░░ ░░░░ ░░░░ ░░░░ ░░░░ ░░░░   │
│ ░░░░ ░░░░ ░░░░ ░░░░      ░░░░ ░░░░ ░░░░        │  ← cells: uniform grey chips,
│ ░░░░ ░░░░      ░░░░ ░░░░ ░░░░      ░░░░ ░░░░   │    unreadable text inside each
│ ░░░░ ░░░░ ░░░░ ░░░░ ░░░░ ░░░░ ░░░░ ░░░░        │
└────────────────────────────────────────────────┘
   everything equally illegible; lanes indistinguishable
```

**After (zoom < threshold, cells switch render tier):**
```
┌────────────────────────────────────────────────┐
│ ARRIVAL   SETUP    IN-SESSION   WRAP-UP   ...  │  ← phase names stay legible:
│ ▓▓▓▓ ▓▓▓▓ ▓▓▓▓ ▓▓▓▓ ▓▓▓▓ ▓▓▓▓ ▓▓▓▓ ▓▓▓▓       │    ONLY text that survives
│ ▓▓▓▓ ▓▓▓▓ ▓▓▓▓ ▓▓▓▓      ▓▓▓▓ ▓▓▓▓ ▓▓▓▓       │  ← cells: flat lane-tinted
│ ▒▒▒▒ ▒▒▒▒      ▒▒▒▒ ▒▒▒▒ ▒▒▒▒      ▒▒▒▒       │    blocks, no inner text —
│ ─────────── line of visibility ─────────────    │    frontstage/backstage tint
│ ▒▒▒▒ ▒▒▒▒ ▒▒▒▒ ▒▒▒▒ ▒▒▒▒ ▒▒▒▒ ▒▒▒▒            │    split by the visible rule
└────────────────────────────────────────────────┘
   read at a glance: journey length, density per phase, above/below the line
```

**Mechanism.** `zoom < SEMANTIC_ZOOM_THRESHOLD` (≈0.35, tune) → cell renders a cheap block variant (no text layout, no images — also a render-perf win: hundreds of text layouts skipped at overview). Phase headers switch to a fixed-screen-size label (inverse-scaled) so they hold ~11px on screen at any zoom. Threshold crossing animates as a cross-fade at `--motion-micro`; reduced-motion = instant swap. Bonus: the block-tier board is exactly the "miniature" asset the mobile fold animates from — one implementation serves both plans.

**Judgement call for review:** is the overview *supposed* to be a texture (current) or a map (proposed)? If you actually like the texture reading, reject this.

## 2. Camera-flight wayfinding — motion that says where

**Problem.** Opening a scenario flies the camera across the board (~600ms). Mid-flight, zero anchor: no label of destination, no trace of origin. The motion is pleasant but informationally empty — a long flight on a big board is disorienting.

**Before (mid-flight):**
```
┌────────────────────────────────────────────────┐
│          ░░░░  ░░░░   ← board streaking by     │
│   ░░░░       ░░░░  ░░░░                        │
│        (where am I going? no signal)           │
└────────────────────────────────────────────────┘
```

**After (mid-flight, transient ghost breadcrumb):**
```
┌────────────────────────────────────────────────┐
│          ░░░░  ░░░░                            │
│   ░░░░       ░░░░  ░░░░                        │
│                                                │
│        ┌─────────────────────────┐             │
│        │ Overview → In-Session ·  │             │  ← appears at flight start,
│        │        Help Request      │             │    fades ~150ms after arrival
│        └─────────────────────────┘             │
└────────────────────────────────────────────────┘
```

**Mechanism.** Camera controller already knows origin + destination selection. Portal a centered pill (existing `bubble`/`badge` styling, `--shadow-floating`) during `isFlying`; fade out on arrival at `--motion-micro`. Reduced-motion: camera already jumps instantly → pill never shows (no flight, no need). Zero layout impact; purely additive overlay. Smallest item here — cheap to try, easy to delete if it feels naggy.

## 3. Drawer ↔ cell tether — close the selection loop

**Problem.** Cell drawer opens `modal={false}` as a right-pinned card. Canvas stays live (good) but nothing visually couples the drawer to its cell. At mid zoom the selection ring is faint; after a pan, the selected cell may be off-screen entirely — drawer floats contextless.

**Before:**
```
┌───────────────────────────────┬──────────────┐
│  ░░░░  ░░░░  ░░░░  ░░░░       │ Sign-in kiosk│
│  ░░░░  ▓▓▓▓  ░░░░             │ ────────────  │
│        ↑ selected (faint ring │ What happens │
│          easy to lose)        │ here…        │
│  ░░░░  ░░░░  ░░░░  ░░░░       │              │
└───────────────────────────────┴──────────────┘
      which cell is this drawer about?
```

**After:**
```
┌───────────────────────────────┬──────────────┐
│  ░░░░  ░░░░  ░░░░  ░░░░       │ Sign-in kiosk│
│  ░░░░  ▓▓▓▓━━━━━━━━━━━━━━━━━━▶│ ────────────  │
│        ↑ strong halo    tether │ What happens │
│  ░░░░  ░░░░  ░░░░  ░░░░       │ here…        │
│                               │ ⌖ off-screen? │
│                               │ [Jump to cell]│ ← appears only when cell
└───────────────────────────────┴──────────────┘    leaves the viewport
```

**Mechanism.** Three graduated pieces (can ship independently):
1. Stronger selection halo while drawer open — accent-colored ring + slight lane-tint fill boost. Tiny CSS change.
2. Leader line from cell edge to drawer edge, drawn on the existing annotation/overlay layer (geometry code already un-projects camera coordinates — `CanvasAnnotationProvider` does this exact math). Hidden below semantic-zoom threshold.
3. "Jump to cell" affordance in the drawer header when the selected cell scrolls out of viewport — reuses `scrollBlueprintCellIntoView`.
Recommend 1+3 for sure; 2 is the opinionated one — judge from the draft.

## 4. Phase headers get a typographic register — the time skeleton reads as skeleton

**Problem.** Phase headers, lane headers, and cell titles sit at near-identical visual weight (same face, similar sizes). The hierarchy that matters most — time structure — has no typographic voice. Everything is politely medium.

**Before:**
```
│ Arrival          Setup            In-Session     │ ← same face/weight as
│ Frontstage                                       │   lane + cell text
│ [Greet at door] [Kiosk check-in] [Session open]  │
```

**After:**
```
│ 01 · ARRIVAL     02 · SETUP       03 · IN-SESSION│ ← mono/utility face,
│ Frontstage                                       │   uppercase, letterspaced,
│ [Greet at door] [Kiosk check-in] [Session open]  │   muted-foreground + index
```

**Mechanism.** Restyle phase header text only: existing mono/utility token face, `text-xs uppercase tracking-wider text-muted-foreground`, ordinal index prefix. Steps ARE an ordered sequence — numbering here is information, not decoration. Same treatment the mobile reader's sticky eyebrow uses → desktop and mobile share one recognizable "time marker" idiom. Smallest diff of the five; pure CSS/class change on one component.

## 5. Code-health prerequisites (already filed — todos/019)

Not UI proposals; listed because they tax every item above:
- `EditorShell.tsx` god component (~560 lines: shell + sidebar + resize + presentation). Item 1/2 touch the camera + viewport; extraction first would keep those diffs reviewable. The mobile plan's unit 1 fork makes the same extraction pressure worse — do it there.
- Arbitrary font sizes + one hardcoded shadow — item 4 should consume tokens, not add more one-offs.
- `MergedCompareGrid` O(paths×cells) — untouched by this plan.

## Recommended order (if approved)

| Order | Item | Size | Risk |
|---|---|---|---|
| 1 | #4 phase typographic register | XS | none — CSS only |
| 2 | #3.1 + #3.3 halo + jump-to-cell | S | none |
| 3 | #2 flight breadcrumb | S | low — additive overlay |
| 4 | #1 semantic zoom | M | medium — render-tier switch on the hot path; needs perf check |
| 5 | #3.2 leader line | S | aesthetic risk — judge after halo ships |

Each independently shippable + independently rejectable. #1 doubles as a render-perf win and as the mobile fold's miniature asset.

## Sources

- Overview render path: `ZoomPanViewport.tsx`, `useZoomPanViewport.ts` (`MIN_ZOOM = 0.05`), cell components under `src/components/blueprint/`.
- Coordinate un-projection precedent for the tether: `CanvasAnnotationProvider.tsx` (layer-rect / scale math).
- Jump-to-cell primitive: `scrollBlueprintCellIntoView` in `blueprintCellConnections.ts`.
- Filed code-health: `todos/019-pending-p2-mobile-and-review-followups.md`.

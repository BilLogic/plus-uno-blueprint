---
audience: designers, developers
summary: Which primitive for what, the drawer/sheet posture contract (this doc is its single owner), badges and segmented controls, and the empty/loading/error visual recipes.
sources: src/components/ui/, src/components/blueprint/BlueprintCellDetailPanel.tsx, src/components/mobile/MobileScenarioReader.tsx, src/components/EditorErrorBoundary.tsx
last-reviewed: 2026-08-08
---

# Components

## The primitive inventory

`src/components/ui/` is shadcn-shaped on **Base UI** (plus vaul-style drawer
plumbing) — vendored, so it can be edited, but edits are system changes, not
per-feature tweaks. Reach for, in order: an existing primitive → composition
of primitives → a new primitive argued in the PR. Highlights:

| Need | Primitive |
|---|---|
| Action | `button` (incl. the `blueprint`/`blueprintPill` cell variants) |
| Choice among few | `toggle-group` (segmented), `tabs` |
| Overlay, blocking | `dialog` |
| Overlay, anchored | `popover`, `dropdown-menu`, `context-menu`, `tooltip` |
| Edge panel | `sheet` (mobile nav, mobile agent), `drawer` (cell detail, reader cell sheet) |
| Loading | `deferred-skeleton`, `skeleton`, `spinner` (`DelayedSpinner`) |
| Structure | `sidebar`, `separator`, `card`, `badge` |

**Composition uses `render={}`, not `asChild`** — Base UI's render-prop is
the house idiom; the few remaining `asChild` occurrences are legacy Radix
shims, not the pattern to copy.

## Drawer and sheet postures — owned here

One component, two postures, keyed remount on the flip. The cell detail panel
(`BlueprintCellDetailPanel`) is the canonical case and this doc is the single
owner of the contract (engineering docs link here):

- **Desktop ≥ breakpoint**: a right-pinned floating *card* (not a full sheet)
  at `--width-cell-panel`, expanding to `--width-cell-panel-expanded`;
  `modal={false}` so the canvas stays live; swipe direction `right`. Its
  motion is an inspector's — it expands out of the selection, it does not
  arrive from off-screen (see the block comment in `animations.css`).
- **Mobile < breakpoint**: a bottom sheet, full width, swipe `down`,
  view-only content.
- The drawer is **keyed on posture** (`key={mobile ? 'mobile' : 'desktop'}`)
  so a resize across the breakpoint remounts clean instead of reinterpreting
  an in-flight swipe against the wrong axis.
- Surface switches inside an open drawer are content swaps at the same tree
  position — never close-reopen.
- **Snap points require a `defaultSnapPoint`.** A drawer given `snapPoints`
  without a default opens at an arbitrary state; the reader's cell sheet
  (`MobileScenarioReader.tsx`) is the pattern — peek by default, drag to full.

Agent dock docked/floating is the same one-component-two-postures precedent.

## Badges and segmented controls

`ScenarioTitleBadge` names things on the canvas (phase tone vs default tone);
`badge` covers inline status; `PathTypeBadge` carries the path encoding from
[data-viz](foundations/data-viz.md). Mode switches (view/design, Stacked/
Merged) are `toggle-group` segmented controls carrying `aria-pressed` — state
that forced-colors and screen readers key off (see
[accessibility](accessibility.md)).

## Empty, loading, and error states

These are designed states, not fallbacks:

- **Loading**: `DeferredSkeleton` — the skeleton itself waits (~250ms) so
  warm loads flash nothing; one skeleton per surface, all-or-nothing swap,
  shaped with real geometry where it's free (true phase counts), held across
  waterfall stages. The spinner (`DelayedSpinner`) only where no structure is
  knowable. Never skeleton → blank → skeleton.
- **Empty**: an empty state says what would be here and how to get it — a
  short designed block (muted icon, one sentence, one action), not a blank
  region. Copy rules in [content-voice](content-voice.md).
- **Error**: `EditorErrorBoundary` renders a contained card — the failure
  stays the size of the feature that failed, the shell survives. Same recipe
  at panel scale. Wording again per [content-voice](content-voice.md).

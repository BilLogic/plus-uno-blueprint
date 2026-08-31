---
audience: designers, developers
summary: Which primitive to reach for, badges and segmented controls, and the empty/loading/error visual recipes — the 34 primitives under src/components/ui/.
sources: src/components/ui/, src/components/blueprint/BlueprintCellDetailPanel.tsx, src/components/mobile/MobileNavSheet.tsx, src/components/mobile/MobileAgentSheet.tsx, src/components/EditorErrorBoundary.tsx
last-reviewed: 2026-08-25
---

# Components

`src/components/ui/` is the design system: 34 primitives, and the whole of what
this folder documents. Anything assembled out of them is
[composition](../composition/overview.md). The need→primitive map for agent-UX
work, with every primitive named, is
[`docs/reference/ui-inventory.md`](../../reference/ui-inventory.md).

## The primitive inventory

`src/components/ui/` is shadcn-shaped on **Base UI** (plus vaul-style drawer
plumbing) — vendored, so it can be edited, but edits are system changes, not
per-feature tweaks. Reach for, in order: an existing primitive → composition
of primitives → a new primitive argued in the PR. Highlights:

| Need | Primitive |
|---|---|
| Action | `button` (incl. the `blueprint` cell variant, whose shape — square face or round touchpoint — is a variant of `blueprintCellButtonClassName`) |
| Choice among few | `toggle-group` (segmented), `tabs` |
| Overlay, blocking | `dialog` |
| Overlay, anchored | `popover`, `dropdown-menu`, `context-menu`, `tooltip` |
| Edge panel | `sheet` (mobile nav, mobile agent), `drawer` (cell detail, entity detail) |
| Loading | `deferred-skeleton`, `skeleton`, `spinner` (`DelayedSpinner`) |
| Structure | `sidebar`, `separator`, `card`, `badge` |

**There are two words for small labelled things, and only two.** A **badge**
describes the thing it sits on — one per thing, not drawn from a set the reader
picks from, and **never interactive**, which is why `badge.tsx` has no hover
state in any variant. A **tag** is one value out of a set, selectable or
removable; `OwnerTagSelect` is the only one in the app. "Chip" and "pill" are
not names here, and
[`scripts/tests/badge-and-tag.test.mjs`](../../../scripts/tests/badge-and-tag.test.mjs)
fails a build that reintroduces either. The full rule, and what an explained
badge wears instead of a hover state, is in
[reference/panel-affordances.md](../../reference/panel-affordances.md).

**Composition uses `render={}`, not `asChild`** — Base UI's render-prop is the
house idiom. The Radix migration is finished: `asChild` has zero occurrences in
`src/` and there is no `@radix-ui` dependency.

## Postures live in composition

The drawer/sheet **posture** contract — which posture a panel takes at which
width, how it is keyed, what a surface switch inside an open drawer may do —
sat here for months, and it is a composition rule wearing a components label.
It has moved, single-owner claim intact, to
[composition/dialogs-sheets-and-forms.md](../composition/dialogs-sheets-and-forms.md).
This doc still owns *which primitive*; that one owns *what shape it takes*.

## Badges and segmented controls

`ScenarioTitleBadge` names things on the canvas (phase tone vs default tone);
`badge` covers inline status; `PathLabelBadge` carries the path encoding from
[data-viz](../foundations/data-viz.md). Mode switches (view/design, Stacked/
Merged) are `toggle-group` segmented controls carrying `aria-pressed` — state
that forced-colors and screen readers key off (see
[accessibility](../foundations/accessibility.md)).

## Empty, loading, and error states

These are designed states, not fallbacks:

- **Loading**: `DeferredSkeleton` — the skeleton itself waits (~250ms) so
  warm loads flash nothing; one skeleton per surface, all-or-nothing swap,
  shaped with real geometry where it's free (true phase counts), held across
  waterfall stages. The spinner (`DelayedSpinner`) only where no structure is
  knowable. Never skeleton → blank → skeleton.
- **Empty**: an empty state says what would be here and how to get it — a
  short designed block (muted icon, one sentence, one action), not a blank
  region. Copy rules in [content-voice](../foundations/content-voice.md).
- **Error**: `EditorErrorBoundary` renders a contained card — the failure
  stays the size of the feature that failed, the shell survives. Same recipe
  at panel scale. Wording again per [content-voice](../foundations/content-voice.md).

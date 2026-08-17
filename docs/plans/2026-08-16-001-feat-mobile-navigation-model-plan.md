---
title: Mobile navigation model — collapsible menu, view toggle, agent FAB
type: feat
status: active
date: 2026-08-16
---

# Mobile navigation model

The mobile shell currently spends about a fifth of a phone screen on chrome
that navigates worse than the drawer hidden behind it. This plan replaces the
bottom tab bar with a desktop-mirroring collapsible menu, demotes the
journey/map switch from a destination to the view toggle it actually is, and
turns the agent from a full-height sheet into a floating action button.

## The problem, stated once

**Journey and Map are not destinations.** They are two readings of one
selected scenario — the same content, unrolled linearly or laid out as a
grid. A bottom tab bar is the platform's destination switcher, so putting a
view mode there tells the user these are different places. Meanwhile the
actual destination picker (which scenario am I reading?) is hidden behind a
hamburger, and a third copy of it renders inside the content area as the
journey index. Three surfaces teach three different mental models of the same
hierarchy.

## Audit — current top and bottom chrome

Top bar (`h-12`, five slots on a 375px screen):

| Slot | Verdict |
| --- | --- |
| ☰ Open navigation | **Keep.** The only entry to the real hierarchy. |
| Title (truncating) | **Keep**, but it should say where you are, not just what. |
| Theme toggle | **Move.** A rarely-changed setting holding prime chrome. Belongs in the drawer footer. |
| ✦ Ask the agent | **Move to FAB.** Also duplicated in the bottom bar today. |
| ⋯ More | **Delete.** Its menu contains exactly one item, permanently disabled ("Editing is available on desktop"). A 44px target that can never do anything. |

Bottom bar (`<nav aria-label="Primary">`, three full-width buttons):

| Slot | Verdict |
| --- | --- |
| Journey | **Not a destination.** Becomes half of a view toggle. |
| Map | **Not a destination.** Becomes the other half. |
| Ask | **Not navigation at all.** An action inside a `<nav>` labelled Primary — wrong semantics for assistive tech, and the second of two entry points to the same panel. |

Defects beyond placement:

1. **Two controllers fight over one state.** The tabs set the view, but the
   drawer silently overrides it — `selectPhase` forces Map
   ([MobileShell.tsx:331](src/components/mobile/MobileShell.tsx:331)) and
   `openScenario` forces Journey
   ([MobileShell.tsx:161](src/components/mobile/MobileShell.tsx:161)). Pick
   Map, then tap a scenario, and you are silently back in Journey with the
   Map tab no longer reflecting anything you chose.
2. **Every switch is a full remount of a 6,319-node tree.** Measured live at
   375×812: the reader surface is **151 DOM nodes**; the map surface is
   **6,319 nodes / 669 cells** — the whole service overview, every phase and
   scenario, rendered on a phone. `key={surface + scenarioId}`
   ([MobileShell.tsx:223](src/components/mobile/MobileShell.tsx:223)) tears
   all of it down and rebuilds it on every toggle. Toggling faster than a
   rebuild takes saturates the main thread: the page stops responding, the
   content area goes blank, and half-built surfaces stack on top of each
   other. Nothing throws, so no error boundary catches it and the console
   stays empty — which is why this reads as "the app crashes" and leaves no
   trace to debug. This is the single highest-value fix in the plan.
3. **~100px of permanent chrome** (48px top + ~52px bottom with safe area) on
   a viewport that is often 812px tall or less — before any content renders.
4. **Redundant hierarchy**: drawer, bottom tabs, and the in-content journey
   index all navigate the same phases → scenarios tree.

## The new model

One persistent bar, one collapsible menu, one floating action.

```
┌──────────────────────────────────┐
│ ☰   Warm-Up               [◫│▦]  │  top bar: menu · title · view toggle
├──────────────────────────────────┤
│                                  │
│         content surface          │  journey reader OR map,
│      (one selected scenario)     │  same scenario either way
│                                  │
│                            ╭───╮ │
│                            │ ✦ │ │  agent FAB (thumb reach)
└────────────────────────────╰───╯─┘
```

### 1. The collapsible menu replaces the tab bar

Mirror the desktop structure rather than inventing a phone-only one. Desktop
is a vertical icon rail (`EditorRail`: Blueprints ◫, Slices ◇, Agent ✦) plus a
panel that collapses to rail-only with a hover-peek
([EditorShell.tsx:89](src/components/editor/EditorShell.tsx:89)).

On mobile the same two-part structure opens as an overlay drawer: the icon
rail pinned left, the panel beside it. Collapsed state on a phone is *closed*
rather than a persistent rail — a 48px rail would eat 13% of a 375px width for
navigation the user is not currently doing. The rail lives inside the drawer,
so the structure a user learns on desktop is the structure they meet on the
phone.

- Rail surfaces: **Blueprints** (phases → scenarios accordion) and **Slices**
  (the cut views). Agent is not a rail surface here — it is the FAB.
- Drawer footer holds the theme toggle and the "editing is desktop-only"
  notice that the dead overflow menu was carrying.
- First load with nothing selected opens the drawer instead of rendering a
  separate in-content index — the drawer *is* the index, so
  `MobileJourneyIndex` retires.

### 2. Journey ⇄ Map is decided by navigation, not a toggle

> **Superseded 2026-08-16 (v3).** This section originally proposed a
> two-segment toggle in the top bar. Review killed it: the menu already
> expresses the same intent — tapping a *phase* asks for the map, tapping a
> *scenario* asks for the reader — so a second control asked a question the
> user had just answered. The surface now follows from what kind of thing was
> tapped, and the freed slot holds **Fit to screen** on the map. Implementation
> in [plan 002](2026-08-16-002-feat-mobile-shell-implementation-plan.md).

The rule below still holds; only the control is gone.

- Selecting a scenario anywhere no longer forces a view. The user's last
  chosen view **persists across navigation** — this is the fix for the
  two-controllers defect, and it is the whole reason the toggle stops being a
  tab.
- Phase selection (which has no reader form) is the one case that implies
  Map; it should say so rather than silently switching.
- Switching views must **stop remounting**. Both surfaces stay mounted, one
  hidden, or the key drops to the scenario id alone — Map keeps its zoom, the
  reader keeps its scroll position, and the registration churn behind the
  crashes goes away.

### 3. Agent becomes a floating action button

The full-height sheet is more container than the interaction needs: the agent
is read-only on mobile, so the exchange is a question and an answer, not a
work session.

- FAB bottom-right, above the safe-area inset, visible on both surfaces.
- Tapping expands it in place into a **compact floating card** (roughly a
  third of the viewport) holding the composer and the latest exchange —
  content stays visible behind it, which matters when the answer cites cells
  the user wants to look at.
- The card can be dragged to full height for a long conversation, but that is
  the escalation, not the default.
- Hidden entirely when the agent is unavailable (`canAgent` false), which the
  current bottom bar already gets right.

## What this buys

- **~100px of chrome returns to content** — the bottom bar disappears and the
  top bar keeps three slots instead of five.
- **One hierarchy, one place.** Drawer for where you are, toggle for how you
  read it, FAB for asking about it.
- **View state stops being clobbered**, because only one control owns it.
- **No remount per switch**, removing both a performance cost and a suspected
  crash path.

## Implementation units

| # | Unit | Files | Verification |
| --- | --- | --- | --- |
| 1 | Stop the remount; keep both surfaces mounted | `MobileShell.tsx` | Toggle views: map zoom and reader scroll both survive |
| 2 | View state persists across navigation; drawer stops forcing surfaces | `MobileShell.tsx` | Pick Map, tap a scenario → still Map |
| 3 | Top bar: delete overflow, move theme to drawer, add view toggle | `MobileShell.tsx` | Three slots; no dead controls |
| 4 | Drawer gains the rail structure + slices/blueprints surfaces | `MobileShell.tsx`, new `MobileNavDrawer.tsx` | Matches desktop rail vocabulary |
| 5 | Delete bottom `<nav>`; retire `MobileJourneyIndex` | `MobileShell.tsx` | Empty selection opens the drawer |
| 6 | Agent FAB + compact card, drag-to-expand | `MobileShell.tsx`, `AgentPanel` mobile variant | Content visible behind the card |

Units 1 and 2 are worth landing first and independently: they are the
behavioural bug fixes, they are small, and they do not depend on any of the
visual restructuring.

## Scope boundaries

- Mobile stays **view-only** — no editing affordances arrive with this.
- Desktop chrome is untouched; only the vocabulary is borrowed.
- Slice presentation stays full-bleed over everything (it is already
  phone-shaped).

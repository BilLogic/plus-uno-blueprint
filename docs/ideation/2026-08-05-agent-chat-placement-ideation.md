# Agent chat placement — lowfi options (2026-08-05)

Problem: the agent is a rail SURFACE — opening it replaces the Blueprints
or Slices panel. But the common working posture is "chat while looking at
the thing": drafting against the blueprint nav, or iterating a slice with
its list in view. Today that forces rail ping-pong.

Constraint that shapes everything: the canvas is a WIDE artifact. Every
horizontal pixel spent on chrome is a pixel of grid; the panel column is
already paid for.

## Option A — Stack: chat docks under the active panel

```
┌─┬──────────────┬──────────────────────────┐
│R│ BLUEPRINTS   │                          │
│a│  Application │                          │
│i│  Onboarding  │         canvas           │
│l│  In-session ◀│                          │
│ ├──── drag ────┤                          │
│ │ ✦ Warm-up jam│                          │
│ │  agent: the  │                          │
│ │  gap is in…  │                          │
│ │ [composer__] │                          │
└─┴──────────────┴──────────────────────────┘
```

One column, split horizontally; drag divider; chat collapses to its
header row (title + ✦) when idle. Rail's ✦ becomes a toggle for the
docked section instead of a surface swap; "expand" affordance promotes
chat to the full column (today's layout) for long sessions.

+ Nav/slice list AND chat visible; zero canvas cost; width already
  standardized so the column just splits.
+ Cheapest build: render AgentPanel below SlideModeSidebarNav in the
  same aside; one new divider + collapse state.
+ Presentation/collapse behaviors inherit from the existing column.
− Vertical space is tight on laptops — both halves get short; chat
  history needs the expand affordance to breathe.
− Sessions list vs chat view inside a half-height section needs care
  (probably: docked mode always shows the LAST session, list only in
  expanded mode).

## Option B — Float: chat as a draggable palette over the canvas

```
┌─┬──────────────┬──────────────────────────┐
│R│ BLUEPRINTS   │            canvas        │
│a│  Application │   ┌─────────────┐        │
│i│  Onboarding  │   │ ✦ Warm-up ⤢ ✕│        │
│l│  In-session ◀│   │ agent: the   │        │
│ │              │   │ gap is in…   │        │
│ │              │   │ [composer__] │        │
│ │              │   └─────────────┘        │
└─┴──────────────┴──────────────────────────┘
```

Floating window (drag, resize, snap to corners), collapses to a ✦
bubble. Any panel stays open behind it.

+ Best of both: full-height panel AND chat; chat can sit next to the
  cells being discussed; natural fit for presentation mode.
− Occludes the canvas it cites (focus_cell scrolls under the window);
  needs drag/resize/z-index/snap plumbing + per-mode positioning; small
  screens get cramped fast; annotations + floating chat compete.

## Option C — Second column: chat on the right edge

```
┌─┬──────────────┬──────────────┬───────────┐
│R│ BLUEPRINTS   │    canvas    │ ✦ chat    │
│a│  In-session ◀│              │ agent: …  │
│l│              │              │ [compose] │
└─┴──────────────┴──────────────┴───────────┘
```

+ Everything visible, nothing overlaps, both full height.
− Steals 300+px of canvas permanently — the one resource the wide grid
  cannot spare; doubles chrome; smallest-screen story is bad. Rejected
  unless ultrawide-only.

## Recommendation

**A as the default posture, B as the presentation/power add-on later.**
A solves the actual complaint (chat + panel co-visible) at near-zero
canvas cost and small build cost, and its "expand" state IS today's
layout, so nothing regresses. B is worth building once A proves the
habit — floating is the right shape for presenting and for pointing at
cells mid-conversation, but it brings a window manager's worth of edge
cases. C loses to the width budget.

Build sketch for A: EditorShell renders `<aside>` as a flex column —
surface panel (flex-1, min-height) + divider + docked AgentPanel
(chat view of the most recent session, header collapse, "expand"
promotes to full column). ✦ rail button toggles docked visibility;
attachment hand-offs (openAgentSurface) open the dock instead of
swapping surfaces.

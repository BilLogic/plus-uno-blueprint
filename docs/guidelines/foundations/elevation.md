---
audience: designers
summary: Flat by default — elevation is a lightness ladder, shadows are rare and tokenized, and the z-index bands are a short fixed map.
sources: src/styles/semantic.css, src/styles/theme.css, src/components/editor/EditorShell.tsx, src/components/mobile/MobileShell.tsx
last-reviewed: 2026-08-25
---

# Elevation

## Flat by default

Height in this app is expressed as **lightness, not shadow**. The semantic
layer (`src/styles/semantic.css`) derives a surface ladder — canvas →
sidebar → card → popover — from one signed dial (`--elevation-step`) times a
shared ratio set (`--elevation-1..4`), so "higher = lighter" holds in both
themes. The translucent state surfaces (`--muted`, `--accent`, `--tertiary`)
are alpha overlays tuned to the same ladder. A surface says how high it is by
which background token it uses; no shadow needed.

Shadows follow Supabase's stance: **near-no bespoke shadow tokens**. Tailwind's
default scale plus two additions: `--shadow-floating` in `src/styles/theme.css`,
the shared shadow for anything floating over the canvas (toolbars, menus, the
agent's floating window); and `--shadow-blueprint-annotation-fill`
(`src/styles/blueprint.css`, light and dark), scoped to the annotation surface.
If it floats over the board, it uses `--shadow-floating`; if it doesn't float,
it almost certainly needs no shadow.

One-off `box-shadow` literals are a review rule with no checker behind it, and
two ship today — the slice frame editor's drop indicators
(`SliceFrameEditor.tsx:254,257`). They are the standing counter-example, not a
precedent.

## When a surface earns elevation

A surface earns a shadow only when it **occludes the canvas and can be moved
or dismissed** — it must read as sitting *above* the work, because it is. The
cell detail panel, floating toolbars, menus, and the agent float qualify.
Cards inside the page flow do not: they take the next surface token up the
ladder and at most a hairline `border-border`. When in doubt, go flat; the
board is the star.

## Z-index conventions

Small fixed bands, not an arms race. The shell's map:

| Band | Belongs to |
|---|---|
| `z-0` / `z-1` | Ground: the transformed canvas content and its arrow layers |
| `z-10` | In-surface pins: phase badges on the canvas |
| `z-20` | Shell columns — the sidebar over the canvas edge |
| `z-30` | Shell furniture over content: the sidebar resize handle, corner overlays, the mobile agent FAB and Reset View |
| `z-40` | Full-screen takeovers: the mobile slice-presentation overlay, the agent's floating window |
| `z-50` | Topmost transients: menus, popovers, tooltips (the primitives' default), canvas flow arrows |
| `z-60` | The annotation surface, which must sit over every transient it is drawn on top of |

Rules: pick the band by *role*, never bump a value to win a local fight — a
stacking bug means two things are in the wrong band, and the fix is moving one,
not inventing a step between two bands.

**Known debt, named rather than denied.** The canvas grid still carries
arbitrary values that predate this table and belong in it:
`BlueprintLabelRail.tsx:62,93,176` (`z-[35]`, `z-[5]`, `z-[45]`),
`BlueprintDependencyArrows.tsx:385` (`z-[30]`) and `CanvasPenCursor.tsx:99`
(`z-[9999]`). Nothing checks for them. New arbitrary `z-[…]` values are still a
smell; a new band is a change to this table, proposed as such.

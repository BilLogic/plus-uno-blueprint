---
audience: designers
summary: Flat by default — elevation is a lightness ladder, shadows are rare and tokenized, and the z-index bands are a short fixed map.
sources: src/styles/semantic.css, src/styles/theme.css, src/components/editor/EditorShell.tsx, src/components/mobile/MobileShell.tsx
last-reviewed: 2026-08-18
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

Shadows follow Supabase's stance: **no bespoke shadow tokens**. Tailwind's
default scale plus exactly one addition in `src/styles/theme.css` —
`--shadow-floating`, the shared shadow for anything floating over the canvas
(toolbars, menus, the agent's floating window). If it floats over the board,
it uses `--shadow-floating`; if it doesn't float, it almost certainly needs no
shadow. One-off `box-shadow` literals are review-blockers (the last two were
hunted down in the 2026-08-07 review polish).

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
| `z-10` | In-surface pins: phase badges on the canvas |
| `z-20` | Shell columns — the sidebar over the canvas edge |
| `z-30` | Shell furniture over content: the sidebar resize handle, corner overlays, the mobile agent FAB and Reset View |
| `z-40` | Full-screen takeovers: the mobile slice-presentation overlay, the agent's floating window |
| `z-50` | Topmost transients: menus, popovers, tooltips (the primitives' default), canvas flow arrows |

Rules: pick the band by *role*, never bump a value to win a local fight — a
stacking bug means two things are in the wrong band, and the fix is moving
one, not inventing `z-45`. Arbitrary `z-[…]` values are a smell; if a new band
seems needed, that is a change to this table, proposed as such.

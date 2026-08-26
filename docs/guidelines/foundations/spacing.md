---
audience: designers
summary: The spacing and radius scale — Tailwind's default steps plus the handful of named app measures, and what it takes to write an arbitrary value instead.
sources: src/styles/theme.css
last-reviewed: 2026-08-25
---

# Spacing and radius

Tailwind's default spacing scale, plus the handful of named measures Supabase
also registers — recurring app measures, not a parallel scale. All live in
`src/styles/theme.css`:

- `--radius` is the dial; `--radius-sm/md/lg/xl` (and `2xl/3xl/4xl`) derive from
  it, so rounding retunes from one place. `--radius-panel` is the flat panel
  radius.
- `--spacing-content` (the content column unit) and `--spacing-card`
  (indirecting to the card's own padding token).

Use the scale. A `p-[13px]`-style arbitrary value needs the PR to argue why no
step fits — a review rule, not a checked one, and the canvas carries two that
never made that argument (`CellDependencySections.tsx:36,108`, `pl-[19px]` and
`gap-[7px]`). Those are debt, not precedent.

The tell for a genuine exception is that the number comes from somewhere else:
an optical alignment against a glyph, a rail that has to meet an arrow's
origin. The tell for debt is that the number came from dragging until it
looked right.

Widths are not on this scale and have their own home rule — see
[layout.md](layout.md) and [tokens.md](tokens.md).

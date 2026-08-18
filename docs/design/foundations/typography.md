---
audience: designers
summary: Type roles and scale (including the sub-xs steps), and the time-marker register that names phases and steps the same way on every surface.
sources: src/styles/theme.css, src/styles/base.css, src/types/nav.ts, src/components/editor/CanvasPhaseSection.tsx
last-reviewed: 2026-08-18
---

# Typography

## Roles

Two faces, declared in `src/styles/theme.css` in Supabase's seam shape:

- **Sans** — Ubuntu Sans Variable (the brand face), behind the `--app-font-sans`
  injection seam so an embedding app can swap it. Body, headings, cell content.
  There is no separate heading face and no weight overrides: headings are this
  stack at a heavier weight, exactly as Supabase does it.
- **Mono** — Source Code Pro Variable, behind `--font-source-code-pro` (seam
  filled in `src/styles/base.css`). Code, identifiers, and the utility register
  below.

The fallback chains live *outside* the `var()` slot on purpose — see the
comment in `theme.css` for the failure mode that placement prevents.

## Scale

Tailwind's default type scale, extended downward by two named steps in
`theme.css`: `--text-2xs` and `--text-3xs` (illustratively 11px and 10px —
the file owns the values). They exist because the editor's dense chrome
(badges, kickers, axis labels) uses those sizes constantly and named steps
beat scattered `text-[11px]` literals. Deliberately no bundled line-height:
the utilities set font-size only, and call sites keep their own leading.

## The time-marker register

The one deliberate typographic voice in the app: **mono + uppercase +
`tracking-wider` + a zero-padded ordinal** — `01 · Arrival`. The label is
built by one helper, `ordinalLabel` in `src/types/nav.ts`, which is what makes
"these surfaces name time the same way" structural rather than aspirational.

It governs exactly one element today:

- **Canvas phase badges** — the `ScenarioTitleBadge` on each phase frame
  (`CanvasPhaseSection.tsx`), which also counter-scales to stay legible at the
  semantic-zoom blocks tier. (The mobile reader's step eyebrows carried the
  register too until the reader was deleted 2026-08-17; the shared canvas
  now serves phones, so the badges are the register's one home.)

Why it exists: phases and steps ARE ordered sequences in time, so **the
ordinal is information, not decoration**. That is also the register's limit —
numbering is earned only where the underlying thing is an ordered sequence.
Do not apply it to lanes, scenarios, slices, or anything unordered; there the
number would be decoration, which this system refuses.

The register is a *visual* treatment: accessible names keep the plain title
(the phase section's `aria-label` says "Open Arrival phase", not
"zero one dot arrival"). See [accessibility](../accessibility.md).

## Everything else stays quiet

Cell titles and body copy stay in the sans face at sizes that survive a 375px
viewport without mid-word truncation. Muted hierarchy is carried by
`text-muted-foreground` / `text-tertiary-foreground` (see
[color](color.md)), not by additional faces or sizes. If a new surface seems
to need a new typographic voice, that is a deviation — see the
[Deviating](../README.md#deviating) protocol.

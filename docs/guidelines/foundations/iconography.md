---
audience: designers
summary: Lucide only, small glyphs on generous hit areas, and the rule that an icon carrying meaning always has a text name.
sources: src/components/ui/, src/components/mobile/MobileTopBar.tsx, src/lib/canvasAnnotations.ts
last-reviewed: 2026-08-25
---

# Iconography

## One set

Icons come from **lucide-react**, and only lucide-react. No second icon set,
no bespoke SVGs for concepts lucide already covers — a mixed icon vocabulary
reads as seams. If lucide genuinely lacks a needed glyph, that is a
[deviation](../overview.md#deviating) to argue in the PR.

## Sizing

Glyphs in chrome sit at `size-3.5`, `size-3` or `size-4` — the three dominant
sizes across the app, in that order of frequency. Check neighboring components
and match. Icons scale with their container's text where inline; standalone
icons take an explicit size class.

Don't invent a size per surface. Nothing enforces that, and the app has drifted
past the three: `size-2.5` (micro-chrome, ~13 sites) and `size-5` (~10) also
ship. Reach for a fourth value only with a reason in the PR.

## Glyph vs hit area

**The glyph stays small; the target does not.** An icon button's visual and
its touchable area are two different things:

- On desktop, the `Button` icon variants supply comfortable padding around a
  `size-4` glyph.
- On touch surfaces, targets must be at least 44px square. The pattern is the
  mobile top bar (`MobileTopBar.tsx`): `size-11` buttons (44px) carrying
  `size-4`–`size-5` glyphs. Never grow the glyph to grow the target.

The 44px floor is part of the accessibility bar — see
[accessibility](accessibility.md).

## Icons that mean something get names

An icon that *decorates* a labeled control needs nothing. An icon that
*carries* the meaning — an icon-only button, a status glyph, a swatch — must
have a text name: an `aria-label` always, and a `Tooltip` wherever hover
exists (the sidebar row actions and toolbar got a tooltip sweep for exactly
this reason). The reference precedent is the annotation swatches
(`annotationSwatchName` in `src/lib/canvasAnnotations.ts`): the swatch's
*value* is a token string, but it announces and tooltips a human color name —
"Red", never `var(--color-red-900)`.

Corollary: never encode a distinction by icon alone when the icon set can't
make the two glyphs obviously different at `size-4`. Add the word.

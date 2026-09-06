---
audience: designers, developers
summary: How a token gets a home — the four tiers, the one-home rule between theme.css and layoutTokens.ts, and what to do when a CSS-only value grows a runtime consumer.
sources: src/styles/theme.css, src/lib/layoutTokens.ts, src/lib/motion.ts, src/lib/tokenDiscipline.test.ts
last-reviewed: 2026-08-25
---

# Tokens

Every foundation in this folder is a vocabulary; this doc is the rule about
where a word in one of those vocabularies is allowed to live. Read it once and
the other foundations stop needing to repeat themselves.

## The tiers

Colour has four tiers and [color.md](color.md) is their single owner — read it
there rather than a summary here. The shape generalises: **primitive values,
then semantic roles, then a Tailwind indirection, then component-scoped
variables a component sets on itself.** A component consumes the semantic layer;
reaching past it to a primitive ramp is the drift `src/lib/tokenDiscipline.test.ts`
exists to catch.

## The one-home rule

A measure has **exactly one home each**, chosen by who consumes it:

- **A stylesheet** owns values that *only feed class names*. CSS is their single
  home because no JavaScript ever computes with them.
- **A TypeScript module** owns values the *runtime does math on* — drag clamps,
  persistence, viewport clamping, anything a CSS custom property cannot serve,
  because `Math.min` has no `var()`.

The rule is **never declare the same measure in both**. If a CSS-only value
grows a runtime consumer it *moves*, and the class reads it via inline style; it
does not get copied. A copy is not a duplication problem, it is a *drift*
problem — the two homes diverge silently and the surface that reads the stale
one is the one nobody tested.

Worked instances, each owned by its own doc:

| Vocabulary | CSS home | Runtime home | Owner |
|---|---|---|---|
| Widths | `src/styles/theme.css` | `src/lib/layoutTokens.ts` | [layout.md](layout.md) |
| Spacing, radius | `src/styles/theme.css` | — | [spacing.md](spacing.md) |
| Durations, easings | `src/styles/animations.css` | `src/lib/motion.ts` | [motion.md](motion.md) |
| Shadows, z-bands | `src/styles/theme.css`, `blueprint.css` | — | [elevation.md](elevation.md) |

Motion is the case where both homes are unavoidable — CSS animates, and JS has
to wait for the animation to finish — so it is also the only one held together
by a test (`src/lib/motion.test.ts`). Where a test is possible, that is the
shape to copy.

## Adding one

Adding a token is a change to a vocabulary, not a local decision. In order:

1. Check the owner doc for whether an existing token already means this. Most
   proposed tokens are a second name for an existing one.
2. Decide the home from the rule above — who computes with it?
3. Add it in that one place, and say in the PR which vocabulary grew and why
   the existing words did not fit.

A value used at exactly one call site is not a token; write it there. A token is
what you reach for the second time.

---
date: 2026-08-19
topic: nested-scenario-hover
---

# Nested scenario hover

## What We're Building

When a scenario inside a non-focused phase is hovered or keyboard-focused, that
scenario becomes the clear interaction target without visually selecting its
whole phase. Hovering phase background still previews the phase as a whole.

## Why This Approach

Ancestor opacity prevents a child card from becoming clearer than its phase.
Increasing the whole phase opacity makes the interaction ambiguous; adding a
stronger outline alone adds more chrome without restoring legibility. Applying
dim states to the phase frame and individual scenario wrappers lets one nested
target lift independently using the existing color and shadow vocabulary.

## Key Decisions

- Phase-background hover lifts the complete phase to 70%.
- Nested scenario hover lifts only that scenario to 100%.
- The phase frame, phase badge, and sibling scenarios remain at 30%.
- Keyboard `focus-within` mirrors pointer hover.
- Focused-phase scenario behavior remains unchanged.

## Open Questions

None.

## Next Steps

Implement the CSS state contract and validate both nested and focused-phase
hover paths in the browser.

---
status: ready
priority: p1
issue_id: "033"
tags: [canvas, input, camera, mobile, agent, performance]
dependencies: []
---

# Canvas input, camera transitions, and agent parity

## Problem Statement

Canvas panning can fail when touch starts inside populated lane/container content because gesture ownership depends on descendant event propagation. Programmatic phase/scenario camera transitions also stall and feel janky. Both refactors can strand or misdirect the in-app agent unless semantic camera ownership, command lifecycle, and verified completion are implemented together.

## Findings

- Pointerdown is currently observed too late by the viewport when descendants stop propagation.
- Space-pan is documented but not implemented; multiple components compete to own gestures.
- `focus_cell` can report success even though transformed-canvas scrolling is intentionally a no-op.
- Dynamic UI commands are keyed by name, so mount order can select a hidden viewport.
- Preserving memoized inactive panels can retain stale compare commands and context.
- The CLI harness validates tool choice but mocks visual UI effects; a real-browser contract is required.

## Proposed Solutions

1. Patch only touch propagation. Low effort, but preserves competing handlers and does not address desktop grammar or agent ownership.
2. Introduce a pure gesture policy plus one capture controller, then extract a shared imperative camera transaction/controller. Moderate-to-high effort with a simple durable boundary.
3. Adopt a full canvas framework. Highest effort and unnecessary for UNO's current scene model.

## Recommended Action

Implement option 2 in the order documented by the two active 2026-08-19 plans: input policy/controller first; render isolation and camera transactions second; agent parity and real-browser verification as gates throughout.

## Acceptance Criteria

- [ ] Touch pan/pinch begins over populated descendants without breaking taps, selection, drawing, nested scrolling, or desktop hotkeys.
- [ ] Space-drag, middle-drag, Hand, marquee, and tool ownership follow one tested policy.
- [ ] Programmatic camera transitions have one cancellable owner, exact endpoints, coupled motion, and reduced-motion support.
- [ ] Heavy unaffected blueprint bodies do not rerender for navigation/camera frames.
- [ ] Agent navigation, focus, camera, mode/tool, selection, annotation, compare, panel, tabs, path filters, writes, and revert surfaces retain verified control.
- [ ] Dynamic agent commands belong to the explicit active surface and clean up without stale closures.
- [ ] Static parity, LLM harness, real-browser agent contract, unit/integration tests, lint, and build pass.

## Work Log

### 2026-08-19 - Implementation started

**By:** Codex

**Actions:**
- Reviewed both active implementation plans, repository architecture/security routing, and agent-native impact inventory.
- Created `codex/canvas-input-camera-agent-parity` from `main` while preserving unrelated working-tree edits.

**Learnings:**
- The implementation must distinguish semantic outcome parity from raw human-event parity.
- Camera command ownership and completion semantics are prerequisites for trustworthy agent results.

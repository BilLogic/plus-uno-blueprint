---
date: 2026-08-19
topic: camera-motion-policy
---

# Camera Motion Policy

## What We're Building

One camera motion policy for every canvas navigation: phase↔phase,
scenario↔scenario, phase↔scenario, and either level↔overview. Motion stays
interruptible and honors reduced motion.

## Why This Approach

The initial implementation used geometry to stretch travel from 360–620 ms.
Browser validation showed that ordinary phase↔scenario moves resolved near the
620 ms ceiling while the focus UI still followed the 420 ms camera token. The
result was a visible handoff: the UI arrived, the camera hesitated, then swept
through a steep middle acceleration. One duration is easier to synchronize
across every route and proved more predictable than the adaptive policy.

## Key Decisions

- Use one 420 ms duration for every automatic fit. Forward, reverse, nearby,
  and cross-level routes share one timing contract with their focus fades.
- Use a sine ease-in-out. It still departs and settles calmly, but spends less
  time nearly stationary than quintic smootherstep. Pure ease-in remains
  inappropriate because a camera must settle, not arrive at maximum speed.
- Keep one animation owner. Cards, sidebar, breadcrumbs, keyboard, mobile, and
  agent navigation all change selection; the viewport alone computes motion.
- Start timing on the first drawable frame and allow a new intent or manual
  pan/zoom to interrupt from the live transform. Manual wheel, pinch, drag,
  and keyboard zoom remain immediate; this policy only governs automatic fits.
- Reduced motion remains an immediate fit.

## Open Questions

- None for implementation. Browser validation will sample representative
  transitions in both directions and confirm the focus fades and camera settle
  together.

## Validation Outcome

The fixed policy passed phase↔scenario navigation, zoom-out hover/click
switching, overview reset, direct keyboard zoom, unit tests, lint, typecheck,
and the production build. Further tuning should change the shared token and
both easing representations together rather than adding route-specific rules.

---
status: pending
priority: p3
issue_id: 003
tags: [code-review, performance]
---
# Measure slice-focus dim filter cost on a large board

## Problem Statement
The slice-focus dim uses per-cell `filter: saturate(.35) grayscale(.5)` on every
non-member cell — each becomes a stacking context re-rasterized during zoom/pan
(slice tabs only). User explicitly wanted the stronger contrast, so keep the look;
measure pan FPS on the Ecoeled 56-card board during stage-3 dogfood and swap to an
opacity/token-only approximation if it drops frames.

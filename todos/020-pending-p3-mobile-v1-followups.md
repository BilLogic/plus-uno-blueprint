# 020 · P3 · Mobile v1 follow-ups (deliberate scope cuts)

> Update 2026-08-08 (same day, second pass): items 1, 2, 3 SHIPPED — snap
> points on the reader cell sheet (base-ui `defaultSnapPoint` was the missing
> piece), drag-threshold pan from cells (plus a ghost-pointer reset on primary
> touch and a touch pass-through on ResizableComparePanel), and slices
> presenting full-bleed from the nav sheet. Item 5 half-done: the semantic-zoom
> block tier shipped on desktop; the fold still cross-fades. Remaining: 4
> (width tokens), 6 (real-device smoke), 7 (tablet band).

The mobile shell shipped v1 (plan `docs/plans/2026-08-08-001`). These were cut
deliberately and are queued, not forgotten:

1. **Cell drawer snap points** — the reader's cell sheet and the Map's detail
   drawer are plain bottom sheets (`max-h-70/75svh`). The plan called for vaul
   `snapPoints={[0.35, 1]}` peek ↔ full; tune ratios on a real device.
2. **One-finger pan starting on a cell** — touch pan engages only from board
   background (the panIgnoreSelector rule, same as mouse). A drag-threshold
   "pending pan" would let drags start anywhere while keeping taps as taps —
   this is the mobile touch contract item from todos/019, half done now.
3. **Slices + presentation on mobile** — the nav sheet lists phases/scenarios
   only. Slices (list → `SlicePresentation`, which is linear and should suit a
   phone) are absent below `md`.
4. **Width tokenization** (plan unit 9) — 320/640/380/48 layout magic numbers
   still live in component JS; mobile shipped without touching them.
5. **The fold** — reader ⇄ Map switch is a 200ms cross-fade, not the
   board-miniature fold animation the plan sketched. Semantic-zoom block tier
   (desktop plan 2026-08-08-002 item 1) would provide the miniature asset.
6. **Real-device smoke** — verified via emulated coarse pointer + synthetic
   PointerEvents (pan + pinch both move the real camera); still owed a pass on
   the phone that originally crashed.
7. **Tablet band (768–1024)** — desktop shell (with editing) holds from 768 up;
   open question whether narrow tablets should get the reader instead.

---
status: pending
priority: p2
issue_id: 019
tags: [code-review, frontend, performance, mobile]
dependencies: []
---

# Review follow-ups (2026-08-06 session)

Findings from the ce-review + frontend-design pass that were NOT fixed in
5911a95 / d16d8d7. The mobile CRASH is fixed (step-visual decode capped
325 MB → 78 MB, lazy+async images, ErrorBoundary, deep-link CSS.escape).
These remain.

## P2 — mobile was never designed for (separate from the crash)

- `useIsMobile` (src/hooks/use-mobile.ts) is consumed only by the
  vendored `ui/sidebar.tsx`; no app component branches on it. The sidebar
  eats ~280px of a 375px viewport, clipping the canvas off-screen.
- The canvas zoom (`useZoomPanViewport.ts`) is wheel + ctrl/⌘-wheel +
  pointer-drag; there is NO `touchstart`/multi-touch pinch path (a
  comment at ~line 739 admits it). So even post-crash, the board is not
  navigable by touch.
- Only 22 of 144 component files use any `sm:`/`md:`/`lg:` prefix.
- Decide the mobile contract: at minimum a designed below-`md` notice
  ("best viewed on a larger screen"), ideally a touch-pinch/pan handler,
  or a read-only mobile view.

## P3 — correctness smells (from the TS review)

- **`BlueprintTriggerArrows`** (the single-path grid, mounted 2× per
  `ServiceBlueprintGrid`) never got the ResizeObserver hardening its
  integrated twin has: its RO callback is `() => updateArrows()` with no
  rAF coalescing, and `setSegments`/`setSize` fire fresh objects with no
  equality guard. During a camera-fit relayout it does a full sync DOM
  sweep + re-render per notification. Port the rAF coalescer +
  `serializeSegments`/size guards from `IntegratedTriggerArrows`.
- **`MergedCompareGrid`**: each path's arrow overlay runs
  `content.querySelectorAll('[data-blueprint-cell]')` over the ENTIRE
  merged DOM even though it draws only its own path — 2N full-container
  scans per update. Pass a shared cell-index to all overlays instead.

## P3 — token/style escapes (from the frontend review)

- The vendored shadcn/base-ui layer runs its own durations
  (`duration-200/150/100/300` in ui/sidebar, sheet, popover,
  navigation-menu; `duration-400` in ui/message-scroller) outside the
  `--motion-*` vocabulary. Either bring them onto tokens or make the
  exemption explicit — the "one vocabulary" claim currently excludes the
  base-ui layer silently.
- Inline hardcoded shadow, light-only: `CanvasAnnotationLayer.tsx:1041`
  `boxShadow: '0 1px 2px rgba(15,23,42,0.08), 0 4px 12px rgba(15,23,42,
  0.06)'` — no dark variant, not a `--shadow-*` token. Checkerboard hexes
  at :222/:445 similar (though they ship explicit light+dark pairs).
- Arbitrary font sizes bypass the scale: `text-[13px]` (×4, e.g.
  AgentPanel:307, SidebarNav:224), `text-[9px]` (SliceScreenComposer:302),
  `text-[8px]` (BlueprintStepVisual:68). If 13px is intentional (a common
  Supabase size), promote it to a token.
- `BLUEPRINT_THEME` / annotation families reach into PRIMITIVE steps
  (`var(--color-slate-500)`) from TS, which colors.css:26 forbids for
  components. It's a reasoned exception (no semantic equivalent for the
  board ladder) — add a one-line acknowledgment in the DS doc so it reads
  as intentional, not drift.

## P3 — god components (Supabase small-component preference)

- `CanvasAnnotationLayer.tsx` (2157 lines; main fn ~1342→end, 11
  useState), `AgentPanel.tsx` (19 useState — a useReducer or extracted
  state context is overdue), `BlueprintCellDetailPanel.tsx` (1479).
  Sub-components are co-located (mitigant); the main bodies + state
  fan-out are the refactor targets.

## Acceptance criteria

- [ ] Mobile contract decided and implemented (notice / touch / read-only)
- [ ] Both arrow-overlay P3s closed
- [ ] Token/style escapes swept
- [ ] At least one god-component split

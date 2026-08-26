---
status: accepted
audience: developers
summary: State that must outlive a mount point, or be read by non-React code, lives in a module-level store read through useSyncExternalStore rather than in context.
---

# Cross-surface state is a module store, not context

State shared across surfaces that do not share a provider lives in a
module-level store, read through `useSyncExternalStore`. Context is for state
that has a tree.

Two conditions send state here, and either one is sufficient:

1. **It must survive a mount point changing.** The agent chat renders from two
   places — docked in the sidebar, floating over the canvas — and a drag flips
   which one exists *mid-gesture*. Component state dies in that gap, which is
   exactly how a drag-out used to lose the drop-target ring, throw the user back
   to the session list, and eat a half-typed message.
2. **Non-React code must read it.** The agent's UI-context collector is plain
   functions with no hooks available to it, and the compare cockpit's consumers
   — a menubar pill, a portalled drawer, a canvas strip and a tool contributor —
   share no ancestor.

The live instances each carry their reason in their own header comment:
`agent/placement.ts`, `agent/panelState.ts`, `agent/settings.ts`,
`canvasModeContext.ts`, `sidebarCollapsedContext.ts`, `compareReviewStore.ts`,
`canvasChromeResize.ts`, and `useMobileShell.ts` (a media query as an external
store).

## Consequences

**The snapshot must be reference-stable between writes.** A `getSnapshot` that
builds a fresh object per call loops the render. Every store here caches its
snapshot and bumps it on write; that is not an optimisation, it is the contract.

**Persistence is decoupled from emission.** A drag emits on every pointermove,
and a synchronous `JSON.stringify` plus a storage write per frame is a real cost
for a value nobody reads until the next boot. Callers flush at the end of a
gesture.

**Default is still derived state and props.** This is the escape hatch for two
named conditions, not a state-management strategy. A store reached for because
prop-drilling felt tedious is a store nobody can find the writer of.

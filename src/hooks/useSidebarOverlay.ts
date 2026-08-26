import { useSyncExternalStore } from 'react'

/**
 * The width below which the sidebar stops sharing the row with the canvas.
 *
 * Between the phone gate and a comfortable desktop the two compete for width
 * that is not there: a canvas too narrow to read beside a sidebar nobody
 * asked to keep open. Below this gate the sidebar collapses, and reopening it
 * OVERLAYS the canvas rather than taking a column back from it — reopening in
 * flow would just recreate the squeeze the collapse was for.
 *
 * A number here rather than in `lib/layoutTokens.ts`: that file's contract is
 * shell *dimensions* the runtime does arithmetic on (drag clamps, viewport
 * clamping, persistence — the things `Math.min` needs and `var()` cannot
 * serve). This is a viewport boundary, and its consumer is `matchMedia`. Its
 * precedent is `MOBILE_SHELL_QUERY`: a gate lives with the hook that reads
 * it, and [foundations/layout.md] owns the list of them.
 *
 * ## Where this sits relative to the mobile gate
 *
 * The band is [768, 900) and the two gates can neither overlap nor leave a
 * gap, because the floor is not a number here at all — it is the mobile
 * gate's own. Below 768 `EditorShell` renders `MobileShell` and this desktop
 * tree does not exist, so the query needs no `min-width` half and there is no
 * second copy of 768 to drift. `useSidebarOverlay.test.tsx` pins the ordering,
 * so narrowing the band from either end stays a deliberate edit.
 */
export const SIDEBAR_OVERLAY_BREAKPOINT = 900
export const SIDEBAR_OVERLAY_QUERY = `(max-width: ${SIDEBAR_OVERLAY_BREAKPOINT - 1}px)`

export function isSidebarOverlayViewport(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia(SIDEBAR_OVERLAY_QUERY).matches
  )
}

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(SIDEBAR_OVERLAY_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

/**
 * True while the sidebar owes the canvas its column. Synchronous for the same
 * reason `useMobileShell` is: an effect-resolved answer paints one frame of
 * the wide posture, which here is a sidebar that appears and then wipes shut
 * on its own.
 */
export function useSidebarOverlay(): boolean {
  return useSyncExternalStore(subscribe, isSidebarOverlayViewport, () => false)
}

/**
 * Collapse, plus the two facts that let a resize back up do the right thing.
 *
 * `auto` is the whole point. A collapse the gate imposed and a collapse the
 * user asked for look identical as a boolean, and a shell that cannot tell
 * them apart gets exactly one of the two failures: it restores nothing on the
 * way back up (stranding the user in a sidebar they never closed), or it
 * restores everything (re-opening one they deliberately shut). Marking the
 * gate's own collapses — and clearing the mark on every user action — keeps
 * the widening a *give-back* rather than a reset.
 *
 * `narrow` is which side of the gate the state was last reconciled against,
 * so a reconcile that did not cross is a no-op. Without it the pass is not
 * idempotent, and StrictMode's double-invoked mount effect alone would read
 * the fresh auto-collapse as a pre-existing user one.
 */
export type SidebarCollapse = {
  collapsed: boolean
  auto: boolean
  narrow: boolean
}

/** Expanded, unless the app boots inside the band — in which case the gate
 *  has already had its say and owns the collapse. */
export function initialSidebarCollapse(): SidebarCollapse {
  const narrow = isSidebarOverlayViewport()
  return { collapsed: narrow, auto: narrow, narrow }
}

/** Crossing the gate, both directions decided in the one place. */
export function reconcileSidebarCollapse(
  state: SidebarCollapse,
  narrow: boolean,
): SidebarCollapse {
  if (state.narrow === narrow) return state
  if (narrow) {
    // Already shut when the window narrowed? Then the user shut it, and the
    // gate must not claim a collapse it did not make.
    return { collapsed: true, auto: !state.collapsed, narrow }
  }
  // Widening gives back only what the gate took.
  return { collapsed: state.auto ? false : state.collapsed, auto: false, narrow }
}

/** Every collapse the user asked for — rail toggle, pill, agent bridge —
 *  goes through here, which is what clears the gate's claim. */
export function collapseSidebarByUser(
  state: SidebarCollapse,
  collapsed: boolean,
): SidebarCollapse {
  return { ...state, collapsed, auto: false }
}

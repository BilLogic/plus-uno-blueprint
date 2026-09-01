import { useEffect, useRef } from 'react'
import { useSyncExternalStore } from 'react'

/**
 * What the collapsed sidebar's floating navbar says, and who told it.
 *
 * Collapsing used to leave TWO chrome lanes stacked: the navbar floated
 * over the canvas's own navbar (the phase menubar, the slice header
 * band). The fix is not to dock the navbar — it is to let it BE the
 * navbar while collapsed. The navbars hand it their identity (and their
 * primary action) and render nothing themselves, so there is exactly one
 * header on screen at any width.
 *
 * A module store rather than context: the navbars live deep inside canvas
 * content, several providers away from the shell that owns the state, and
 * this is a small signal — not worth threading through every surface.
 */
export type CollapsedNavSummary = {
  /** The one line the navbar shows — phase name, slice title. */
  title: string
  /** Optional glyph the band prefixes its title with (◇ for slices). */
  glyph?: string
  /** The band's primary action, kept reachable while collapsed. */
  action?: { label: string; onClick: () => void }
}

type CollapsedState = {
  collapsed: boolean
  /**
   * How far the aside reaches across the canvas column, in pixels, while it
   * OVERLAYS that column — and `0` at every width where it does not.
   *
   * Below `SIDEBAR_OVERLAY_BREAKPOINT` the aside goes `absolute inset-y-0
   * left-0` at `z-20`, so it draws over the canvas rather than taking a
   * column back from it. That posture is deliberate and #239 leaves it
   * exactly as it is; what it never accounted for is the docked bar at the
   * top of that column, which ends up with its left half underneath the
   * panel and reads as half a title.
   *
   * Two fixes were on the table (#234). Starting the panel below the bar
   * keeps the bar whole but stops the panel reaching the top of the column
   * it belongs to. Insetting the BAR was chosen instead: the panel keeps the
   * shape it has at every width, and the bar gives up only the space that is
   * genuinely not its while the panel is open.
   *
   * It rides this store for the same reason the summary does — the bars live
   * deep inside canvas content, several providers away from the shell that
   * owns the aside's width. A number and not a CSS variable, because what a
   * test must be able to read back is the bar's resolved left offset, and a
   * variable name is not an offset.
   */
  overlayInset: number
  summary: CollapsedNavSummary | null
}

let state: CollapsedState = { collapsed: false, overlayInset: 0, summary: null }
/**
 * Who published the summary on screen.
 *
 * The store is last-writer-wins, which is right — a newly mounted band
 * speaks for the surface the user just moved to. Unmounting is the case
 * that is NOT symmetric: a band tearing down after its successor published
 * would otherwise clear the successor's title and leave the navbar blank.
 * Only the current owner may clear.
 */
let owner: object | null = null
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

export function setSidebarCollapsedState(
  next: Pick<CollapsedState, 'collapsed' | 'overlayInset'>,
): void {
  // Both facts come from the one publisher (`EditorShell`) in one effect, so
  // the guard compares both rather than short-circuiting on `collapsed`:
  // dragging the aside's edge changes only the inset, and a guard that asked
  // about collapse alone would swallow every frame of that drag.
  if (
    state.collapsed === next.collapsed &&
    state.overlayInset === next.overlayInset
  ) {
    return
  }
  state = { ...state, ...next }
  emit()
}

function sameSummary(
  a: CollapsedNavSummary | null,
  b: CollapsedNavSummary | null,
): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  return (
    a.title === b.title &&
    a.glyph === b.glyph &&
    a.action?.label === b.action?.label &&
    a.action?.onClick === b.action?.onClick
  )
}

function setCollapsedNavSummary(
  by: object,
  summary: CollapsedNavSummary | null,
): void {
  // Field comparison, not identity: every publisher builds a fresh object,
  // so an identity check only ever caught null-over-null and every real
  // republish woke every subscriber.
  if (summary === null) {
    if (owner !== by) return
    owner = null
  } else {
    owner = by
  }
  if (sameSummary(state.summary, summary)) return
  state = { ...state, summary }
  emit()
}

/**
 * Publish this navbar's identity to the floating one while the sidebar is
 * collapsed. Pass null when the band is visible (it speaks for itself) or
 * has nothing to say. Clears on unmount so a stale title never outlives
 * the surface that owned it.
 */
export function useCollapsedNavSummary(summary: CollapsedNavSummary | null): void {
  // Identity for this mount, so the store can tell "I am done" from
  // "someone else's band is done" when the two overlap.
  const self = useRef<object>({})
  const title = summary?.title ?? null
  const glyph = summary?.glyph ?? null
  const actionLabel = summary?.action?.label ?? null
  const onClick = summary?.action?.onClick
  useEffect(() => {
    if (title === null) return
    const by = self.current
    setCollapsedNavSummary(by, {
      title,
      ...(glyph ? { glyph } : {}),
      ...(actionLabel && onClick
        ? { action: { label: actionLabel, onClick } }
        : {}),
    })
    return () => setCollapsedNavSummary(by, null)
  }, [title, glyph, actionLabel, onClick])
}

export function useSidebarCollapsedState(): CollapsedState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
    () => state,
  )
}

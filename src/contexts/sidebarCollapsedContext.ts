import { useSyncExternalStore } from 'react'

/**
 * The collapsed sidebar's expand control, and who is hosting it.
 *
 * Collapsing used to add a floating pill over the canvas — a second piece
 * of chrome that landed on top of the canvas's own navbar (the phase
 * menubar, the slice header band). Two stacked chrome layers is one too
 * many, so the control now DOCKS into whichever navbar is on screen and
 * the pill appears only when there is no navbar to dock into (the
 * overview and the landing page).
 *
 * A module store rather than context: the navbars live deep inside canvas
 * content, several providers away from the shell that owns the state, and
 * this is a two-field signal — not worth threading through every surface.
 */
type CollapsedState = {
  collapsed: boolean
  expand: () => void
  /** How many navbars are currently mounted and able to host the control. */
  hosts: number
}

let state: CollapsedState = { collapsed: false, expand: () => {}, hosts: 0 }
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
}

export function setSidebarCollapsedState(
  next: Pick<CollapsedState, 'collapsed' | 'expand'>,
): void {
  if (state.collapsed === next.collapsed && state.expand === next.expand) return
  state = { ...state, ...next }
  emit()
}

/** A navbar mounts: it can host the expand control, so the pill stands down. */
export function registerCollapsedNavHost(): () => void {
  state = { ...state, hosts: state.hosts + 1 }
  emit()
  return () => {
    state = { ...state, hosts: Math.max(0, state.hosts - 1) }
    emit()
  }
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

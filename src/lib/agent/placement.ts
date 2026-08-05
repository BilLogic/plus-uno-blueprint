import { useSyncExternalStore } from 'react'

/**
 * Where the agent chat lives — and the fact that it is ONE surface with two
 * postures, not two features.
 *
 * `docked` puts it under the active sidebar panel (chat while the blueprint
 * nav or the slice list stays in view — the posture people actually work
 * in). `floating` lifts it over the canvas so it can sit beside the cells
 * being discussed. Dragging the chat's header out of the sidebar floats it;
 * dragging it back over the sidebar re-docks it. Same conversation either
 * way — placement never touches session state.
 */
export type AgentPlacementMode = 'docked' | 'floating'

export type AgentPlacement = {
  mode: AgentPlacementMode
  /** Is the agent showing at all (the rail's ✦ toggles this). */
  open: boolean
  /** Docked height as a fraction of the sidebar column. */
  dockRatio: number
  /** Floating window box, viewport pixels. */
  float: { x: number; y: number; width: number; height: number }
}

const STORAGE_KEY = 'uno-agent-placement'

export const DOCK_MIN_RATIO = 0.2
export const DOCK_MAX_RATIO = 0.8
export const FLOAT_MIN = { width: 280, height: 240 }

const DEFAULTS: AgentPlacement = {
  mode: 'docked',
  open: false,
  dockRatio: 0.5,
  float: { x: 360, y: 96, width: 380, height: 460 },
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function load(): AgentPlacement {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<AgentPlacement>
    const float = { ...DEFAULTS.float, ...(parsed.float ?? {}) }
    return {
      mode: parsed.mode === 'floating' ? 'floating' : 'docked',
      open: parsed.open === true,
      dockRatio: clamp(
        typeof parsed.dockRatio === 'number' ? parsed.dockRatio : DEFAULTS.dockRatio,
        DOCK_MIN_RATIO,
        DOCK_MAX_RATIO,
      ),
      float: {
        x: Number.isFinite(float.x) ? float.x : DEFAULTS.float.x,
        y: Number.isFinite(float.y) ? float.y : DEFAULTS.float.y,
        width: Math.max(FLOAT_MIN.width, float.width),
        height: Math.max(FLOAT_MIN.height, float.height),
      },
    }
  } catch {
    return { ...DEFAULTS }
  }
}

let state: AgentPlacement = typeof window === 'undefined' ? { ...DEFAULTS } : load()
const listeners = new Set<() => void>()

function emit(): void {
  listeners.forEach((listener) => listener())
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Placement memory is a nicety; failing to store is fine.
  }
}

export function setAgentPlacement(patch: Partial<AgentPlacement>): void {
  state = { ...state, ...patch, float: { ...state.float, ...(patch.float ?? {}) } }
  emit()
}

/** The rail's ✦: show/hide the agent wherever it currently lives. */
export function toggleAgentOpen(force?: boolean): void {
  setAgentPlacement({ open: force ?? !state.open })
}

/** Drag ended outside the sidebar — float it, landing where it was dropped. */
export function floatAgentAt(x: number, y: number): void {
  setAgentPlacement({ mode: 'floating', open: true, float: { ...state.float, x, y } })
}

/** Drag ended over the sidebar — dock it back. */
export function dockAgent(): void {
  setAgentPlacement({ mode: 'docked', open: true })
}

export function getAgentPlacement(): AgentPlacement {
  return state
}

export function useAgentPlacement(): AgentPlacement {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
    () => state,
  )
}

import { createContext, useContext } from 'react'

/**
 * What the canvas is for right now.
 *
 * `view` is reading, navigating and annotating — the app as it has always
 * behaved. `design` turns the same canvas into an authoring surface: cells
 * become selectable, and the toolbar swaps its annotation tools for creation
 * ones rather than growing a second row.
 *
 * Scope is **per surface**, not global: the base canvas and each slice tab
 * hold their own mode, because editing a slice while reading the base
 * blueprint is a normal thing to want.
 */
export type CanvasMode = 'view' | 'design'

export type CanvasModeContextValue = {
  mode: CanvasMode
  setMode: (mode: CanvasMode) => void
  /** False when this session cannot write; the switch is hidden, not disabled. */
  available: boolean
}

export const CanvasModeContext = createContext<CanvasModeContextValue | null>(
  null,
)

/**
 * Null outside a provider — surfaces that never author (presentation, the
 * landing page) simply do not supply one, and the toolbar reads that as
 * "view only" rather than needing its own flag.
 */
export function useCanvasMode(): CanvasModeContextValue | null {
  return useContext(CanvasModeContext)
}

/** The mode, defaulting to `view` wherever no provider exists. */
export function useCanvasModeValue(): CanvasMode {
  return useContext(CanvasModeContext)?.mode ?? 'view'
}

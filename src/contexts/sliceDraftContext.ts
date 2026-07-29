import { createContext, useContext } from 'react'

export type SliceDraftContextValue = {
  /** Selected cell ids (canonical/resolved) → step index, insertion-ordered. */
  selectedCells: ReadonlyMap<string, number>
  toggleCell: (cellId: string, stepIndex: number) => void
  clear: () => void
}

/**
 * Multi-select basket for creating a slice from blueprint cells
 * (cmd/shift-click). Provided only while the session can write — anonymous
 * and no-DB sessions never see selection state, so modifier clicks fall
 * through to the plain click behavior. Provider: `SliceDraftProvider.tsx`.
 */
export const SliceDraftContext = createContext<SliceDraftContextValue | null>(
  null,
)

export function useSliceDraftOptional(): SliceDraftContextValue | null {
  return useContext(SliceDraftContext)
}

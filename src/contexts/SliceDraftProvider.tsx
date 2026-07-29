import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  SliceDraftContext,
  type SliceDraftContextValue,
} from '@/contexts/sliceDraftContext'
import { useSupabase } from '@/contexts/SupabaseProvider'

type SliceDraftProviderProps = {
  children: ReactNode
}

/** Owns the cmd/shift-click multi-select basket; null while read-only. */
export function SliceDraftProvider({ children }: SliceDraftProviderProps) {
  const { canWrite } = useSupabase()
  const [selectedCells, setSelectedCells] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  )

  const toggleCell = useCallback((cellId: string, stepIndex: number) => {
    setSelectedCells((current) => {
      const next = new Map(current)
      if (next.has(cellId)) {
        next.delete(cellId)
      } else {
        next.set(cellId, stepIndex)
      }
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setSelectedCells(new Map())
  }, [])

  const value = useMemo<SliceDraftContextValue>(
    () => ({ selectedCells, toggleCell, clear }),
    [selectedCells, toggleCell, clear],
  )

  return (
    <SliceDraftContext.Provider value={canWrite ? value : null}>
      {children}
    </SliceDraftContext.Provider>
  )
}

import { createContext, useContext } from 'react'

export type AssumptionLensContextValue = {
  /**
   * Cell ids with at least one evidence row (from the public
   * `evidence_counts` view). Null while the lens is off, counts are still
   * loading, or no database is configured — cells must not be tinted then.
   */
  evidencedCellIds: ReadonlySet<string> | null
  /** Invalidate the counts (called after Evidence-tab mutations only). */
  refresh: () => void
}

/** Provider: `AssumptionLensProvider.tsx` (blueprint tab scope). */
export const AssumptionLensContext =
  createContext<AssumptionLensContextValue | null>(null)

export function useAssumptionLens(): AssumptionLensContextValue | null {
  return useContext(AssumptionLensContext)
}

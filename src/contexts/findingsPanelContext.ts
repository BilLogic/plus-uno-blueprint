import { createContext, useContext } from 'react'
import type { QueryResult } from '@/hooks/useSupabaseQuery'
import type { Finding } from '@/types/database'

/**
 * Findings panel state shared between the toolbar toggle, the drawer, and
 * the focus scope around the blueprint canvas. Provided by
 * `FindingsProvider` (blueprint tab only); consumers outside the provider
 * get `null` from the optional hook and render nothing.
 */
export type FindingsPanelContextValue = {
  open: boolean
  /** Closing the panel also clears any focused finding. */
  setOpen: (open: boolean) => void
  findings: QueryResult<Finding[]>
  /** Refetch after a status flip (or conflict). */
  reload: () => void
  focusedFindingId: string | null
  /** Focus a finding's cells on the current grid; `null` clears. */
  focusFinding: (finding: Finding | null) => void
  /**
   * Raw + resolved cell ids of the focused finding — feeds
   * `SliceMembershipContext` so cells pick up `data-slice-member`.
   */
  focusMemberCellIds: ReadonlySet<string> | null
  /** Every cell id present in the currently rendered blueprints. */
  knownCellIds: ReadonlySet<string>
}

export const FindingsPanelContext =
  createContext<FindingsPanelContextValue | null>(null)

export function useFindingsPanel(): FindingsPanelContextValue {
  const context = useContext(FindingsPanelContext)
  if (!context) {
    throw new Error('useFindingsPanel must be used within FindingsProvider')
  }
  return context
}

export function useFindingsPanelOptional(): FindingsPanelContextValue | null {
  return useContext(FindingsPanelContext)
}

import { createContext, useContext } from 'react'

/**
 * The one place a canvas cell click can mean something other than "open the
 * detail panel".
 *
 * Two producers use it — the create-a-slice selection on the base canvas, and
 * a slice tab in edit mode — and one consumer reads it (`BlueprintCellButton`).
 * Routing both through a single context is what keeps the cell button from
 * growing a second, divergent notion of "selected": the panel's selection and
 * a slice's membership are different things and must never be confused.
 */
export type CellPickApi = {
  /**
   * `true` while the picker wants a plain click (a slice tab in edit mode:
   * the whole surface is a picker). `false` means only cmd/shift-click picks,
   * so ordinary reading of the blueprint is untouched.
   */
  plainClick: boolean
  isPicked: (cellId: string) => boolean
  /** 1-based position in the pick order, for the badge. */
  orderOf: (cellId: string) => number | undefined
  toggle: (cellId: string) => void
}

export const CellPickContext = createContext<CellPickApi | null>(null)

export function useCellPick(): CellPickApi | null {
  return useContext(CellPickContext)
}

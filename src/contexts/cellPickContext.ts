import { createContext, useContext } from 'react'

/**
 * The one place a canvas cell click can mean something other than "open the
 * detail panel".
 *
 * Two producers use it — the Design-mode selection on any canvas, and a slice
 * tab being edited — and one consumer reads it (`BlueprintCellButton`).
 * Routing both through a single context is what keeps the cell button from
 * growing a second, divergent notion of "selected": the panel's selection and
 * a slice's membership are different things and must never be confused.
 */
export type CellPickApi = {
  /**
   * `true` while the picker wants a plain click (Design mode: the whole
   * surface is a picker). `false` leaves ordinary reading of the blueprint
   * untouched.
   */
  plainClick: boolean
  /** The selection, in order. The toolbar counts it; the dialog consumes it. */
  picked: readonly string[]
  isPicked: (cellId: string) => boolean
  /** 1-based position in the pick order, for the badge. */
  orderOf: (cellId: string) => number | undefined
  /**
   * Figma's grammar: a plain pick *replaces* the selection, an additive one
   * (shift) toggles the cell in or out of it.
   */
  pick: (cellId: string, options?: { additive?: boolean }) => void
  /** Bulk pick, in the given order — lane, column, marquee, select-all. */
  pickMany: (cellIds: readonly string[], options?: { additive?: boolean }) => void
  clear: () => void
}

export const CellPickContext = createContext<CellPickApi | null>(null)

export function useCellPick(): CellPickApi | null {
  return useContext(CellPickContext)
}

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { MarqueeSelection } from '@/components/editor/MarqueeSelection'
import { SelectionToolbar } from '@/components/editor/SelectionToolbar'
import {
  CellPickContext,
  type CellPickApi,
  type PickMode,
} from '@/contexts/cellPickContext'
import { useBlueprintCellDetailOptional } from '@/contexts/BlueprintCellDetailContext'
import { useCanvasModeValue } from '@/contexts/canvasModeContext'
import { buildBlueprintCellSelectionForId } from '@/lib/blueprintCellConnections'
import { allCellsInReadingOrder } from '@/lib/canvasCellQuery'

/** Toggle each id in or out, preserving pick order for the ones that stay. */
function toggleInto(current: string[], cellIds: readonly string[]): string[] {
  const next = [...current]
  for (const cellId of cellIds) {
    const at = next.indexOf(cellId)
    if (at === -1) next.push(cellId)
    else next.splice(at, 1)
  }
  return next
}

/**
 * The Design-mode selection.
 *
 * Selection is an **ordered list**, not a set, because a slice made from it is
 * ordered. Individual clicks append in click order — picking a journey by hand
 * keeps the order you walked it — while bulk gestures (lane, column, marquee)
 * append in grid reading order, which their callers supply.
 *
 * The grammar used to be Figma's — plain click replaces, shift toggles — on the
 * reasoning that it is the vocabulary most people already have in their hands.
 * That was wrong, and the symptom was that a slice could not be built by
 * clicking: every click threw the previous one away, so the only way to gather
 * four cells was to hold shift for three of them, which nothing said.
 *
 * Figma's grammar fits a selection that is **the subject of the next verb**,
 * where verbs are frequent and each one acts on whatever is currently held.
 * This selection is **a set being assembled**, and there is exactly one verb at
 * the end: make a slice. So the grammar here is a file list's, not a canvas
 * editor's — click gathers, shift reaches, Escape clears.
 *
 * Editing a single cell is not lost to this: at exactly one pick the detail
 * panel opens, which is what clicking a cell did before and what makes the
 * separate "Edit cell" button unnecessary.
 */
export function CanvasSelectionProvider({ children }: { children: ReactNode }) {
  const mode = useCanvasModeValue()
  const detail = useBlueprintCellDetailOptional()
  const [picked, setPicked] = useState<string[]>([])
  // Where a shift-range reaches *from*. Held separately from `picked` because
  // the anchor is the last cell touched, which is not always the last entry —
  // toggling a cell out leaves the anchor where it was.
  const anchor = useRef<string | null>(null)

  // Leaving Design mode drops the selection: the badges and rings are Design
  // affordances, and a selection surviving invisibly into View would reappear
  // on the way back with no memory of why. Cleared during render rather than
  // in an effect, so View never paints one frame still showing pick badges.
  const [lastMode, setLastMode] = useState(mode)
  if (lastMode !== mode) {
    setLastMode(mode)
    if (mode !== 'design' && picked.length > 0) setPicked([])
  }

  const pickMany = useCallback(
    (cellIds: readonly string[], mode: PickMode = 'toggle') => {
      setPicked((current) => {
        if (mode === 'replace') return [...new Set(cellIds)]

        if (mode === 'add') {
          // Union, not toggle. Clicking a lane whose cells are half-picked
          // should end with the whole lane picked — toggling would deselect
          // exactly the half that was already there, which reads as a bug.
          const next = [...current]
          for (const cellId of cellIds) {
            if (!next.includes(cellId)) next.push(cellId)
          }
          return next
        }

        if (mode === 'range') {
          const from = anchor.current
          const to = cellIds[cellIds.length - 1]
          const order = allCellsInReadingOrder()
          const start = from === null ? -1 : order.indexOf(from)
          const end = to === undefined ? -1 : order.indexOf(to)
          // No anchor, or either end not on this grid: fall back to toggling
          // rather than selecting something arbitrary.
          if (start === -1 || end === -1) return toggleInto(current, cellIds)
          const span = order.slice(Math.min(start, end), Math.max(start, end) + 1)
          const next = [...current]
          for (const cellId of span) {
            if (!next.includes(cellId)) next.push(cellId)
          }
          return next
        }

        return toggleInto(current, cellIds)
      })
      const last = cellIds[cellIds.length - 1]
      if (mode !== 'range' && last !== undefined) anchor.current = last
    },
    [],
  )

  const pick = useCallback(
    (cellId: string, mode: PickMode = 'toggle') => {
      pickMany([cellId], mode)
    },
    [pickMany],
  )

  const clear = useCallback(() => {
    setPicked([])
    anchor.current = null
  }, [])

  /**
   * One cell picked means one cell being edited.
   *
   * This is what pays for the grammar change. Clicking a single cell used to
   * open the panel because a click *was* a single selection; now a click
   * gathers, so the panel follows the selection instead — and a second pick
   * closes it, because there is no such thing as a detail panel for two cells.
   *
   * Two things here are load-bearing, both learned the hard way:
   *
   * The detail context is read through a **ref**, not a dependency. Its value
   * is a fresh object on every render of its provider, and selecting a cell
   * re-renders that provider — so depending on it directly re-runs this effect,
   * which selects again, which re-renders. That is not a subtle risk; it is an
   * immediate "Maximum update depth exceeded".
   *
   * And the panel is only driven when the *answer changes*. Without that guard,
   * closing the panel by hand while one cell is still picked would have it
   * reopen on the next render, which makes the close button look broken.
   */
  const detailRef = useRef(detail)
  useEffect(() => {
    detailRef.current = detail
  })

  const drivenCellId = useRef<string | null>(null)
  useEffect(() => {
    const target = detailRef.current
    if (mode !== 'design' || !target) return

    const only = picked.length === 1 ? picked[0] : null
    if (only === drivenCellId.current) return
    drivenCellId.current = only

    if (only === null) {
      // Two or more picked: the selection toolbar is the surface now, not a
      // panel describing one cell. Zero picked is left alone — the panel may
      // have been opened by something other than picking.
      if (picked.length > 1) target.clearSelection()
      return
    }

    for (const blueprint of target.blueprints) {
      // The scenario name is only used for the breadcrumb, which the panel
      // re-derives from context — empty is honest rather than a guess.
      const selection = buildBlueprintCellSelectionForId(blueprint, only, '')
      if (selection) {
        target.selectCell(selection)
        return
      }
    }
  }, [mode, picked])

  useEffect(() => {
    if (mode !== 'design') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPicked([])
        return
      }
      // Cmd/Ctrl-A takes the whole grid, in reading order. Guarded on the
      // event target so it never steals the shortcut from a text field.
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'a' &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        const all = allCellsInReadingOrder()
        if (all.length === 0) return
        event.preventDefault()
        setPicked(all)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode])

  const api = useMemo<CellPickApi>(() => {
    const order = new Map(picked.map((cellId, index) => [cellId, index + 1]))
    return {
      plainClick: mode === 'design',
      gathers: true,
      picked,
      isPicked: (cellId) => order.has(cellId),
      orderOf: (cellId) => order.get(cellId),
      pick,
      pickMany,
      clear,
    }
  }, [clear, mode, pick, pickMany, picked])

  // Outside Design mode there is no picker at all, so a cell click means what
  // it has always meant.
  if (mode !== 'design') return <>{children}</>

  return (
    <CellPickContext.Provider value={api}>
      {children}
      <MarqueeSelection />
      <SelectionToolbar />
    </CellPickContext.Provider>
  )
}

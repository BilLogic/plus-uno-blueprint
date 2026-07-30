import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { MarqueeSelection } from '@/components/editor/MarqueeSelection'
import { CellPickContext, type CellPickApi } from '@/contexts/cellPickContext'
import { useCanvasModeValue } from '@/contexts/canvasModeContext'
import { allCellsInReadingOrder } from '@/lib/canvasCellQuery'

/**
 * The Design-mode selection.
 *
 * Selection is an **ordered list**, not a set, because a slice made from it is
 * ordered. Individual clicks append in click order — picking a journey by hand
 * keeps the order you walked it — while bulk gestures (lane, column, marquee)
 * append in grid reading order, which their callers supply.
 *
 * Grammar is Figma's, because that is the selection vocabulary most people
 * already have in their hands: a plain click replaces, shift toggles, Escape
 * clears.
 */
export function CanvasSelectionProvider({ children }: { children: ReactNode }) {
  const mode = useCanvasModeValue()
  const [picked, setPicked] = useState<string[]>([])

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
    (cellIds: readonly string[], options?: { additive?: boolean }) => {
      setPicked((current) => {
        if (!options?.additive) return [...new Set(cellIds)]
        // Additive: already-picked cells toggle out, new ones append. That is
        // what makes shift-click able to *remove* a cell from a lane you just
        // selected wholesale.
        const next = [...current]
        for (const cellId of cellIds) {
          const at = next.indexOf(cellId)
          if (at === -1) next.push(cellId)
          else next.splice(at, 1)
        }
        return next
      })
    },
    [],
  )

  const pick = useCallback(
    (cellId: string, options?: { additive?: boolean }) => {
      pickMany([cellId], options)
    },
    [pickMany],
  )

  const clear = useCallback(() => setPicked([]), [])

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
    </CellPickContext.Provider>
  )
}

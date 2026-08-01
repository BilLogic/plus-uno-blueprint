import { useEffect, useState } from 'react'
import { Eye, Plus, Minus } from 'lucide-react'
import { useBlueprintCellDetailOptional } from '@/contexts/BlueprintCellDetailContext'
import { useCellPick } from '@/contexts/cellPickContext'
import { useCanvasModeValue } from '@/contexts/canvasModeContext'
import { buildBlueprintCellSelectionForId } from '@/lib/blueprintCellConnections'
import { resolveBlueprintCellId } from '@/lib/resolveBlueprintCellId'

type Menu = { x: number; y: number; cellId: string }

/** Roughly the menu's size, used only to keep it inside the window. */
const MENU = { width: 176, height: 76 }

/**
 * Right-click on a cell.
 *
 * One listener on the canvas rather than a menu component per cell: the grid
 * renders five hundred of them, and a wrapper each would be five hundred
 * subscriptions to pay for a menu that is open zero or one at a time.
 *
 * It exists for the same reason double-click does — while gathering cells, a
 * click picks, so reading one without joining it needs its own gesture. Two of
 * them, because a right-click is the gesture people try first and a
 * double-click is the one that costs nothing to discover by accident.
 */
export function CanvasCellContextMenu() {
  const mode = useCanvasModeValue()
  const detail = useBlueprintCellDetailOptional()
  const pick = useCellPick()
  const [menu, setMenu] = useState<Menu | null>(null)

  useEffect(() => {
    if (mode !== 'design') return

    const onContextMenu = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const cell = target.closest('[data-blueprint-cell][data-blueprint-cell-interactive]')
      // Anywhere that is not a cell keeps the browser's own menu — taking it
      // away from the whole canvas would cost more than this gives.
      if (!cell) return
      const cellId = cell.getAttribute('data-blueprint-cell')
      if (!cellId) return
      event.preventDefault()
      setMenu({
        x: Math.min(event.clientX, window.innerWidth - MENU.width - 8),
        y: Math.min(event.clientY, window.innerHeight - MENU.height - 8),
        cellId,
      })
    }

    const dismiss = () => setMenu(null)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }

    window.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('pointerdown', dismiss)
    window.addEventListener('blur', dismiss)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('blur', dismiss)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [mode])

  if (!menu || mode !== 'design') return null

  const pickId = resolveBlueprintCellId(menu.cellId) ?? menu.cellId
  const picked = Boolean(pick?.isPicked(pickId))

  const viewDetail = () => {
    setMenu(null)
    if (!detail) return
    for (const blueprint of detail.blueprints) {
      const selection = buildBlueprintCellSelectionForId(
        blueprint,
        menu.cellId,
        '',
      )
      if (selection) {
        detail.selectCell(selection)
        return
      }
    }
  }

  return (
    <div
      role="menu"
      data-canvas-cell-menu=""
      style={{ left: menu.x, top: menu.y, width: MENU.width }}
      // Positioned in viewport coordinates, so it does not scale or drift with
      // the camera the way anything inside the canvas would.
      className="fixed z-50 overflow-hidden rounded-md border border-border bg-popover p-1 text-xs shadow-md"
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        role="menuitem"
        onClick={viewDetail}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-muted"
      >
        <Eye className="size-3.5 text-muted-foreground" aria-hidden />
        View cell detail
      </button>
      {pick ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            pick.pick(pickId, 'toggle')
            setMenu(null)
          }}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-muted"
        >
          {picked ? (
            <Minus className="size-3.5 text-muted-foreground" aria-hidden />
          ) : (
            <Plus className="size-3.5 text-muted-foreground" aria-hidden />
          )}
          {picked ? 'Remove from selection' : 'Add to selection'}
        </button>
      ) : null}
    </div>
  )
}

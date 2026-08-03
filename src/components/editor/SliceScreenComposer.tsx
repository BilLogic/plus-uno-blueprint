import { useEffect, useRef, useState } from 'react'
import { GripVertical, Scissors, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { describeCell } from '@/lib/canvasCellQuery'
import { cn } from '@/lib/utils'
import type { DraftFrame } from '@/lib/sliceValidation'

/**
 * Ordering *and* grouping, in one list.
 *
 * Presets were the wrong idea: grouping is something people shape cell by
 * cell, and since they are already dragging to reorder, both belong in one
 * gesture space. Cells between two dividers are one screen, so reordering and
 * re-bucketing are the same drag.
 *
 * The drag is **pointer events, not HTML5 drag-and-drop**. That API failed
 * here twice — first silently refusing to start without a `dataTransfer`
 * payload, then fighting the popover for the pointer — and its failures all
 * present the same way: the row snaps back and the user is told, in effect,
 * that they imagined the gesture. Pointer capture has one owner and no such
 * moods: down on the grip, move updates the slot under the pointer, up drops.
 *
 * "Screen" is the word here on purpose. A frame is the row in `slice_items`;
 * a screen is what the reader sees in presentation. The code keeps `frame`.
 */

/** Where a dragged cell would land: before cell `index` of screen `screen`. */
type DropSlot = { screen: number; index: number }

const sameSlot = (left: DropSlot | null, right: DropSlot | null) =>
  left?.screen === right?.screen && left?.index === right?.index

/** Read the slot back off the element under the pointer. */
function slotAt(x: number, y: number): DropSlot | null {
  const hit = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>('[data-drop-slot]')
  if (!hit) return null
  const [screen, index] = (hit.dataset.dropSlot ?? '').split(':').map(Number)
  if (Number.isNaN(screen) || Number.isNaN(index)) return null
  return { screen, index }
}

export function SliceScreenComposer({
  screens,
  onChange,
}: {
  screens: DraftFrame[]
  onChange: (screens: DraftFrame[]) => void
}) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [slot, setSlot] = useState<DropSlot | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  // Latest values for the window listeners, which are bound once per drag.
  const slotRef = useRef(slot)
  const screensRef = useRef(screens)
  useEffect(() => {
    slotRef.current = slot
    screensRef.current = screens
  })

  /**
   * Move a cell to an explicit position rather than "into a screen".
   *
   * Remove first, then re-derive the index — pulling the cell out shifts
   * everything after it, and inserting at the pre-removal index is how a drag
   * one place down silently becomes a no-op.
   */
  const moveTo = (cell: string, target: DropSlot) => {
    const current = screensRef.current
    let insertIndex = target.index
    const withoutCell = current.map((screen, index) => {
      const position = screen.cells.indexOf(cell)
      if (position === -1) return screen
      if (index === target.screen && position < target.index) insertIndex -= 1
      return { ...screen, cells: screen.cells.filter((id) => id !== cell) }
    })

    const next = withoutCell.map((screen, index) =>
      index === target.screen
        ? {
            ...screen,
            cells: [
              ...screen.cells.slice(0, insertIndex),
              cell,
              ...screen.cells.slice(insertIndex),
            ],
          }
        : screen,
    )

    // A screen emptied by the move disappears — an empty screen is not a
    // renderable state, and leaving one behind only fails validation later.
    onChange(next.filter((screen) => screen.cells.length > 0))
  }

  /** The whole drag lives on window: the pointer is captured, not trusted. */
  useEffect(() => {
    if (dragging === null) return

    const onMove = (event: PointerEvent) => {
      event.preventDefault()
      setPointer({ x: event.clientX, y: event.clientY })
      // The list scrolls, and a drag near its edge has to scroll it — a
      // screen below the fold is otherwise unreachable.
      const element = scroller.current
      if (element) {
        const box = element.getBoundingClientRect()
        if (event.clientY < box.top + 28) element.scrollTop -= 10
        else if (event.clientY > box.bottom - 28) element.scrollTop += 10
      }
      const next = slotAt(event.clientX, event.clientY)
      // Written straight to the ref as well: a pointerup in the same frame
      // as the last move must not read a slot from one render ago.
      slotRef.current = next
      setSlot((current) => (sameSlot(current, next) ? current : next))
    }

    const onUp = () => {
      const target = slotRef.current
      if (target) moveTo(dragging, target)
      setDragging(null)
      setSlot(null)
      setPointer(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- moveTo reads refs
  }, [dragging])

  const splitAt = (screenIndex: number, cellIndex: number) => {
    const screen = screens[screenIndex]
    const next = [...screens]
    next.splice(
      screenIndex,
      1,
      { ...screen, cells: screen.cells.slice(0, cellIndex) },
      { cells: screen.cells.slice(cellIndex), caption: '', narrative: '' },
    )
    onChange(next.filter((entry) => entry.cells.length > 0))
  }

  const mergeUp = (screenIndex: number) => {
    if (screenIndex === 0) return
    const next = [...screens]
    const [merged] = next.splice(screenIndex, 1)
    next[screenIndex - 1] = {
      ...next[screenIndex - 1],
      cells: [...next[screenIndex - 1].cells, ...merged.cells],
      caption: next[screenIndex - 1].caption || merged.caption,
    }
    onChange(next)
  }

  const removeCell = (screenIndex: number, cell: string) => {
    onChange(
      screens
        .map((screen, index) =>
          index === screenIndex
            ? { ...screen, cells: screen.cells.filter((id) => id !== cell) }
            : screen,
        )
        .filter((screen) => screen.cells.length > 0),
    )
  }

  // Running cell number across screens, derived from the screens above each
  // one rather than a counter mutated during render.
  const offsets = screens.map((_, index) =>
    screens.slice(0, index).reduce((total, screen) => total + screen.cells.length, 0),
  )

  /**
   * The insertion line, and the drop target: while dragging, each slot is a
   * generous hit band, and the one under the pointer draws the line the drop
   * will honour. The line is a promise, not a decoration — both are computed
   * from the same slot.
   */
  const DropLine = ({ target }: { target: DropSlot }) => {
    const active = dragging !== null && sameSlot(slot, target)
    return (
      <div
        data-drop-slot={`${target.screen}:${target.index}`}
        className={cn(
          'relative transition-[height]',
          dragging === null ? 'h-1' : 'h-4',
        )}
        aria-hidden
      >
        <span
          className={cn(
            'absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 rounded-full',
            active ? 'bg-primary' : 'bg-transparent',
          )}
        />
      </div>
    )
  }

  const draggedLabel = dragging ? describeCell(dragging).label : null

  return (
    <div
      ref={scroller}
      className={cn(
        'flex max-h-80 flex-col gap-2 overflow-y-auto',
        dragging !== null && 'select-none',
      )}
    >
      {screens.map((screen, screenIndex) => {
        const holdsDrag = dragging !== null && slot?.screen === screenIndex
        return (
          <div
            key={screenIndex}
            className={cn(
              'rounded-lg border bg-card p-2 transition-colors',
              holdsDrag ? 'border-primary bg-primary/[0.03]' : 'border-border',
            )}
          >
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="shrink-0 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                Screen {screenIndex + 1}
              </span>
              {/*
                No caption field here any more, and the space it took is now
                the screen's own. Captions are prose about a screen, and prose
                cannot be written before the screen exists — asking for it
                mid-grouping interrupts the one job this step has with a blank
                box per screen, five of which is five blank boxes. They are
                written in the slice itself, against the cells they describe.
                `caption` stays on the draft and saves as empty.
              */}
              <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                {screen.cells.length} cell{screen.cells.length === 1 ? '' : 's'}
              </span>
              {screenIndex > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-1.5 text-[10px] text-muted-foreground"
                  onClick={() => mergeUp(screenIndex)}
                >
                  Merge up
                </Button>
              ) : null}
            </div>

            <ul className="flex flex-col">
              {screen.cells.map((cell, cellIndex) => {
                const described = describeCell(cell)
                const running = offsets[screenIndex] + cellIndex + 1
                const isDragging = dragging === cell
                return (
                  <li key={cell}>
                    <DropLine target={{ screen: screenIndex, index: cellIndex }} />

                    {/*
                      Where a new screen gets made. The line is always drawn,
                      because the boundary is real whether or not it is
                      hovered; only the words wait. Hidden while dragging so
                      it does not compete with the insertion line.
                    */}
                    {cellIndex > 0 && dragging === null ? (
                      <button
                        type="button"
                        aria-label="Split into a new screen here"
                        onClick={() => splitAt(screenIndex, cellIndex)}
                        className="group/split flex h-4 w-full items-center gap-1 text-[10px] text-muted-foreground/0 transition-colors hover:text-primary"
                      >
                        <span className="h-px flex-1 bg-border transition-colors group-hover/split:bg-primary" />
                        <Scissors className="size-2.5 text-muted-foreground/50 transition-colors group-hover/split:text-primary" aria-hidden />
                        <span className="whitespace-nowrap">new screen</span>
                        <span className="h-px flex-1 bg-border transition-colors group-hover/split:bg-primary" />
                      </button>
                    ) : null}

                    <div
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-1 py-1 transition-opacity hover:bg-muted/60',
                        isDragging && 'opacity-40',
                      )}
                    >
                      {/*
                        Only the grip starts a drag. The row also holds a
                        caption field and a remove button, and a drag that can
                        start anywhere turns every misjudged click into a
                        move.
                      */}
                      <button
                        type="button"
                        aria-label={`Drag to move ${described.label}`}
                        onPointerDown={(event) => {
                          event.preventDefault()
                          setDragging(cell)
                          setPointer({ x: event.clientX, y: event.clientY })
                        }}
                        className="shrink-0 cursor-grab touch-none text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
                      >
                        <GripVertical className="size-3" aria-hidden />
                      </button>
                      <span className="grid size-4 shrink-0 place-items-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                        {running}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs">
                          {described.label}
                        </span>
                        {described.lane ? (
                          <span className="block truncate text-[10px] text-muted-foreground">
                            {described.lane}
                          </span>
                        ) : null}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${described.label}`}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => removeCell(screenIndex, cell)}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>

                    {/* The end of the screen needs its own slot, or the last
                        position in every screen is unreachable. */}
                    {cellIndex === screen.cells.length - 1 ? (
                      <DropLine
                        target={{ screen: screenIndex, index: screen.cells.length }}
                      />
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}

      {/* The dragged row's ghost, under the pointer — without it the only
          feedback mid-drag is a faded row somewhere off-screen. */}
      {dragging !== null && pointer !== null ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 max-w-56 truncate rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-md"
          style={{ left: pointer.x + 10, top: pointer.y + 6 }}
        >
          {draggedLabel}
        </div>
      ) : null}
    </div>
  )
}

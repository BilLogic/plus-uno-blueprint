import { useRef, useState, type DragEvent } from 'react'
import { GripVertical, Scissors, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
 * "Screen" is the word here on purpose. A frame is the row in `slice_items`;
 * a screen is what the reader sees in presentation. The code keeps `frame`.
 */

/** Where a dragged cell would land: before cell `index` of screen `screen`. */
type DropSlot = { screen: number; index: number }

const sameSlot = (left: DropSlot | null, right: DropSlot | null) =>
  left?.screen === right?.screen && left?.index === right?.index

export function SliceScreenComposer({
  screens,
  onChange,
}: {
  screens: DraftFrame[]
  onChange: (screens: DraftFrame[]) => void
}) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [slot, setSlot] = useState<DropSlot | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  /**
   * Move a cell to an explicit position rather than "into a screen".
   *
   * The old version appended to whichever screen the pointer was over, which
   * is what made the drag feel like a drop: a cell aimed between two rows
   * landed at the bottom of a list instead, and aimed at its own screen it
   * silently jumped to the end. A slot says exactly where, and the insertion
   * line drawn from the same slot is therefore a promise the drop keeps.
   */
  const moveTo = (cell: string, target: DropSlot) => {
    // Remove first, then re-derive the index — pulling the cell out shifts
    // everything after it, and inserting at the pre-removal index is how a
    // drag one place to the right silently becomes a no-op.
    let insertIndex = target.index
    const withoutCell = screens.map((screen, index) => {
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
    setDragging(null)
    setSlot(null)
  }

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

  /**
   * The list scrolls, and HTML drag-and-drop does not scroll it for you — a
   * screen below the fold was unreachable by drag, which is half of "it drops
   * instead of moving".
   */
  const edgeScroll = (clientY: number) => {
    const element = scroller.current
    if (!element) return
    const box = element.getBoundingClientRect()
    const margin = 28
    if (clientY < box.top + margin) element.scrollTop -= 12
    else if (clientY > box.bottom - margin) element.scrollTop += 12
  }

  const overSlot = (event: DragEvent, target: DropSlot) => {
    event.preventDefault()
    // Without this the browser shows a "copy" cursor and, in Firefox, refuses
    // the drop outright.
    event.dataTransfer.dropEffect = 'move'
    edgeScroll(event.clientY)
    setSlot((current) => (sameSlot(current, target) ? current : target))
  }

  // Running cell number across screens, derived from the screens above each
  // one rather than a counter mutated during render.
  const offsets = screens.map((_, index) =>
    screens.slice(0, index).reduce((total, screen) => total + screen.cells.length, 0),
  )

  /** The insertion line. Also the drop target — you can only drop on a slot. */
  const DropLine = ({ target }: { target: DropSlot }) => {
    const active = dragging !== null && sameSlot(slot, target)
    return (
      <div
        onDragOver={(event) => overSlot(event, target)}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          if (dragging) moveTo(dragging, target)
        }}
        // Tall enough to hit while dragging, invisible while not.
        className={cn(
          'relative -my-0.5 h-2 transition-opacity',
          dragging === null && 'pointer-events-none opacity-0',
        )}
        aria-hidden
      >
        <span
          className={cn(
            'absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 rounded-full transition-colors',
            active ? 'bg-primary' : 'bg-transparent',
          )}
        />
      </div>
    )
  }

  return (
    <div
      ref={scroller}
      className="flex max-h-72 flex-col gap-2 overflow-y-auto"
      onDragEnd={() => {
        setDragging(null)
        setSlot(null)
      }}
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
              <Input
                value={screen.caption}
                placeholder="Caption"
                className="h-6 min-w-0 flex-1 text-xs"
                onChange={(event) =>
                  onChange(
                    screens.map((entry, index) =>
                      index === screenIndex
                        ? { ...entry, caption: event.target.value }
                        : entry,
                    ),
                  )
                }
              />
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

                    {/* Split between two cells, where the cut actually goes.
                        Hidden while dragging so it does not compete with the
                        insertion line for the same two pixels. */}
                    {cellIndex > 0 && dragging === null ? (
                      <button
                        type="button"
                        onClick={() => splitAt(screenIndex, cellIndex)}
                        className="group/split flex h-3 w-full items-center gap-1 text-[10px] text-transparent transition-colors hover:text-muted-foreground"
                      >
                        <span className="h-px flex-1 bg-transparent group-hover/split:bg-border" />
                        <Scissors className="size-2.5" aria-hidden />
                        split here
                        <span className="h-px flex-1 bg-transparent group-hover/split:bg-border" />
                      </button>
                    ) : null}

                    <div
                      draggable
                      onDragStart={(event) => {
                        // Some browsers refuse to start a drag at all without
                        // payload, which is the other half of "it drops
                        // instead of moving".
                        event.dataTransfer.setData('text/plain', cell)
                        event.dataTransfer.effectAllowed = 'move'
                        setDragging(cell)
                      }}
                      onDragEnd={() => {
                        setDragging(null)
                        setSlot(null)
                      }}
                      className={cn(
                        'flex cursor-grab items-center gap-1.5 rounded-md px-1 py-1 transition-opacity hover:bg-muted/60 active:cursor-grabbing',
                        isDragging && 'opacity-40',
                      )}
                    >
                      <GripVertical
                        className="size-3 shrink-0 text-muted-foreground/60"
                        aria-hidden
                      />
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
    </div>
  )
}

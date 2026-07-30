import { useState, type DragEvent } from 'react'
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
export function SliceScreenComposer({
  screens,
  onChange,
}: {
  screens: DraftFrame[]
  onChange: (screens: DraftFrame[]) => void
}) {
  const [dragging, setDragging] = useState<{
    screen: number
    cell: string
  } | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  const moveCell = (from: number, cell: string, to: number) => {
    const next = screens.map((screen, index) => {
      if (index === from) {
        return { ...screen, cells: screen.cells.filter((id) => id !== cell) }
      }
      if (index === to) return { ...screen, cells: [...screen.cells, cell] }
      return screen
    })
    // A screen emptied by the move disappears — an empty screen is not a
    // renderable state, and leaving one behind only fails validation later.
    onChange(next.filter((screen) => screen.cells.length > 0))
    setDragging(null)
    setDropTarget(null)
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

  // Running cell number across screens, derived from the screens above each
  // one rather than a counter mutated during render.
  const offsets = screens.map((_, index) =>
    screens.slice(0, index).reduce((total, screen) => total + screen.cells.length, 0),
  )

  return (
    <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
      {screens.map((screen, screenIndex) => (
        <div
          key={screenIndex}
          className={cn(
            'rounded-lg border bg-card p-2 transition-colors',
            dropTarget === screenIndex ? 'border-primary' : 'border-border',
          )}
          onDragOver={(event: DragEvent) => {
            event.preventDefault()
            setDropTarget(screenIndex)
          }}
          onDragLeave={() =>
            setDropTarget((current) =>
              current === screenIndex ? null : current,
            )
          }
          onDrop={(event: DragEvent) => {
            event.preventDefault()
            if (dragging) moveCell(dragging.screen, dragging.cell, screenIndex)
          }}
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
              return (
                <li key={cell}>
                  {/* Split between two cells, where the cut actually goes. */}
                  {cellIndex > 0 ? (
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
                    onDragStart={() =>
                      setDragging({ screen: screenIndex, cell })
                    }
                    onDragEnd={() => setDragging(null)}
                    className="flex cursor-grab items-center gap-1.5 rounded-md px-1 py-1 hover:bg-muted/60 active:cursor-grabbing"
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
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

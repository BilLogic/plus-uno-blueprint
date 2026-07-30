import { useState, type DragEvent } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { DraftFrame, ValidationProblem } from '@/lib/sliceValidation'

/**
 * The frame editor, docked under the canvas while a slice is being edited.
 *
 * Drag lives *here*, never on the artboard: the canvas is a pan/zoom surface,
 * and a drag that starts on a cell is already the camera's gesture. So the
 * two halves of editing split by what they are good at — the canvas adds and
 * removes cells by clicking, this strip decides grouping and order.
 *
 * Two drag targets, deliberately distinct:
 * - a **cell chip** moves between frames (the "which frame is this in"
 *   question);
 * - a **frame header** reorders frames (the "what order do they play in"
 *   question).
 */
export function SliceFrameEditor({
  frames,
  activeFrame,
  problems,
  onActivate,
  onChange,
}: {
  frames: DraftFrame[]
  activeFrame: number
  problems: ValidationProblem[]
  onActivate: (index: number) => void
  onChange: (frames: DraftFrame[]) => void
}) {
  // What is currently being dragged. Kept in state rather than read from the
  // dataTransfer during dragover, because the payload is not readable there
  // in every browser — only on drop.
  const [dragging, setDragging] = useState<
    | { kind: 'cell'; frame: number; cell: string }
    | { kind: 'frame'; frame: number }
    | null
  >(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)

  const update = (next: DraftFrame[]) => {
    onChange(next)
    setDragging(null)
    setDropTarget(null)
  }

  const moveCell = (from: number, cell: string, to: number) => {
    if (from === to) return
    const next = frames.map((frame, index) => {
      if (index === from) {
        return { ...frame, cells: frame.cells.filter((id) => id !== cell) }
      }
      if (index === to) return { ...frame, cells: [...frame.cells, cell] }
      return frame
    })
    // A frame emptied by the move disappears — an empty frame is not a
    // renderable state, and leaving one behind would just fail validation.
    update(next.filter((frame) => frame.cells.length > 0))
  }

  const moveFrame = (from: number, to: number) => {
    if (from === to) return
    const next = [...frames]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    update(next)
  }

  const splitFrame = (index: number) => {
    const frame = frames[index]
    if (frame.cells.length < 2) return
    // Split after the first cell: repeated splits peel one cell at a time,
    // which is predictable. Splitting down the middle is not, once a frame
    // has an odd number of cells.
    const next = [...frames]
    next.splice(
      index,
      1,
      { ...frame, cells: frame.cells.slice(0, 1) },
      { cells: frame.cells.slice(1), caption: '', narrative: '' },
    )
    update(next)
  }

  const mergeWithNext = (index: number) => {
    if (index >= frames.length - 1) return
    const next = [...frames]
    const [second] = next.splice(index + 1, 1)
    next[index] = {
      ...next[index],
      cells: [...next[index].cells, ...second.cells],
      // Captions cannot both survive a merge; keeping the first is the least
      // surprising, and the second is one keystroke away in the input.
      caption: next[index].caption || second.caption,
      narrative: next[index].narrative || second.narrative,
    }
    update(next)
  }

  const removeCell = (frameIndex: number, cell: string) => {
    const next = frames
      .map((frame, index) =>
        index === frameIndex
          ? { ...frame, cells: frame.cells.filter((id) => id !== cell) }
          : frame,
      )
      .filter((frame) => frame.cells.length > 0)
    update(next)
  }

  // Running cell number across frames — the same sequence the saved slice
  // shows on the canvas, so the editor and the artboard agree. Derived from
  // the frames above it rather than a running counter, which keeps it a pure
  // function of the render's input.
  const sequenceByFrame = frames.map((frame, frameIndex) => {
    const before = frames
      .slice(0, frameIndex)
      .reduce((total, earlier) => total + earlier.cells.length, 0)
    return frame.cells.map((_, cellIndex) => before + cellIndex + 1)
  })

  return (
    <div className="flex max-h-56 shrink-0 gap-2 overflow-x-auto border-t border-border bg-sidebar p-2">
      {frames.map((frame, index) => {
        const frameProblems = problems.filter(
          (problem) => problem.frame === index,
        )
        const isActive = index === activeFrame

        return (
          <div
            key={index}
            className={cn(
              'flex w-56 shrink-0 flex-col gap-1.5 rounded-lg border bg-card p-2 transition-colors',
              isActive ? 'border-primary' : 'border-border',
              dropTarget === index && 'ring-2 ring-primary/40',
            )}
            onClick={() => onActivate(index)}
            onDragOver={(event: DragEvent) => {
              event.preventDefault()
              setDropTarget(index)
            }}
            onDragLeave={() => setDropTarget((current) => (current === index ? null : current))}
            onDrop={(event: DragEvent) => {
              event.preventDefault()
              if (!dragging) return
              if (dragging.kind === 'cell') {
                moveCell(dragging.frame, dragging.cell, index)
              } else {
                moveFrame(dragging.frame, index)
              }
            }}
          >
            <div
              draggable
              onDragStart={() => setDragging({ kind: 'frame', frame: index })}
              onDragEnd={() => setDragging(null)}
              className="flex cursor-grab items-center gap-1.5 active:cursor-grabbing"
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background">
                {index + 1}
              </span>
              <Input
                value={frame.caption}
                placeholder="Caption"
                className="h-6 min-w-0 flex-1 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                onClick={(event) => event.stopPropagation()}
                onChange={(event) =>
                  onChange(
                    frames.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, caption: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </div>

            <ul className="flex min-h-8 flex-col gap-1">
              {frame.cells.map((cell, cellIndex) => (
                <li
                  key={cell}
                  draggable
                  onDragStart={() =>
                    setDragging({ kind: 'cell', frame: index, cell })
                  }
                  onDragEnd={() => setDragging(null)}
                  className="flex cursor-grab items-center gap-1.5 rounded-md bg-muted/60 px-1.5 py-1 text-[11px] active:cursor-grabbing"
                >
                  <span className="shrink-0 text-muted-foreground">
                    {sequenceByFrame[index][cellIndex]}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
                    {cell.slice(-6)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Remove cell from slice"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={(event) => {
                      event.stopPropagation()
                      removeCell(index, cell)
                    }}
                  >
                    <X className="size-2.5" />
                  </Button>
                </li>
              ))}
            </ul>

            <textarea
              value={frame.narrative}
              rows={2}
              placeholder="Narrative"
              onClick={(event) => event.stopPropagation()}
              onChange={(event) =>
                onChange(
                  frames.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, narrative: event.target.value }
                      : item,
                  ),
                )
              }
              className="w-full resize-none rounded-md border border-input bg-transparent px-1.5 py-1 text-[11px] outline-none focus-visible:border-ring"
            />

            {frameProblems.length > 0 ? (
              <p className="text-[10px] text-destructive">
                {frameProblems[0].message}
              </p>
            ) : null}

            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[10px] text-muted-foreground"
                disabled={frame.cells.length < 2}
                onClick={(event) => {
                  event.stopPropagation()
                  splitFrame(index)
                }}
              >
                Split
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[10px] text-muted-foreground"
                disabled={index >= frames.length - 1}
                onClick={(event) => {
                  event.stopPropagation()
                  mergeWithNext(index)
                }}
              >
                Merge →
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Delete frame ${index + 1}`}
                className="ml-auto text-muted-foreground hover:text-destructive"
                onClick={(event) => {
                  event.stopPropagation()
                  update(frames.filter((_, itemIndex) => itemIndex !== index))
                }}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>
        )
      })}

      {/* An empty trailing frame is where the next clicked cell lands. */}
      <button
        type="button"
        className="flex w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        onClick={() => {
          onChange([...frames, { cells: [], caption: '', narrative: '' }])
          onActivate(frames.length)
        }}
      >
        <Plus className="size-4" />
        Add frame
      </button>
    </div>
  )
}

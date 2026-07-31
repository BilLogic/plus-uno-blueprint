import { useLayoutEffect, useState, type RefObject } from 'react'
import { useCanvasModeValue } from '@/contexts/canvasModeContext'
import { useCellPick } from '@/contexts/cellPickContext'

type Step = { id: string; name: string }
type Column = { left: number; width: number }

/**
 * Column handles above the grid, in Design mode only.
 *
 * The blueprint has never rendered step names as a header row — steps exist
 * only as column positions for cells — so there was nothing to click to select
 * a column the way a lane label selects a lane. This renders only while Design
 * mode is on, so a reader's view is untouched.
 *
 * **Positions are measured, not computed**, because the compare grid lays out
 * on CSS subgrid with each path in its own column: there is no single constant
 * to reuse. `offsetLeft`/`offsetWidth` rather than `getBoundingClientRect`, so
 * the canvas zoom transform does not have to be tracked.
 *
 * **No dependency array on the measuring effect.** The grid re-renders for
 * reasons this component cannot enumerate — path toggles, lane collapse,
 * walkthrough state — and a stale measurement is a handle floating over the
 * wrong column. Re-measuring every render is a handful of `offsetLeft` reads,
 * and the equality check below stops it from looping.
 */
export function BlueprintColumnHandles({
  steps,
  bodyRef,
}: {
  steps: Step[]
  bodyRef: RefObject<HTMLDivElement | null>
}) {
  const mode = useCanvasModeValue()
  const pick = useCellPick()
  const [columns, setColumns] = useState<Column[]>([])
  const active = mode === 'design' && pick !== null

  // No dependency array, deliberately.
  //
  // Every dependency-array variant of this measured nothing: the grid remounts
  // this subtree when Design mode toggles (the selection provider changes
  // element type at that position), and with deps the effect's one run landed
  // where the measurement was not yet meaningful. Running on every render and
  // committing only real changes is what actually works here, and it is also
  // what keeps handles aligned when the grid reflows for reasons this
  // component cannot enumerate — path toggles, lane collapse, walkthroughs.
  //
  // The equality check below is load-bearing: without it, a fresh array every
  // run sets state every run, which crashed the subtree in an update loop and
  // read as "the handles don't render at all".
  //
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- guarded
      if (columns.length > 0) setColumns([])
      return
    }
    const body = bodyRef.current
    if (!body) return

    const measured = steps.flatMap<Column>((_, stepIndex) => {
      const cell = body.querySelector(
        `[data-blueprint-cell-anchor][data-step-index="${stepIndex}"]`,
      )
      if (!(cell instanceof HTMLElement)) return []

      // Accumulate to the column body: the offsetParent chain may include
      // positioned wrappers between the cell and it.
      let left = 0
      let node: HTMLElement | null = cell
      while (node && node !== body) {
        left += node.offsetLeft
        node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null
      }
      return [{ left, width: cell.offsetWidth }]
    })

    const changed =
      measured.length !== columns.length ||
      measured.some(
        (column, index) =>
          column.left !== columns[index]?.left ||
          column.width !== columns[index]?.width,
      )
    if (changed) setColumns(measured)
  })

  if (!active || columns.length === 0) return null

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30"
      data-blueprint-column-handles=""
    >
      {columns.map((column, stepIndex) => (
        <button
          key={steps[stepIndex]?.id ?? stepIndex}
          type="button"
          title={`Select the ${steps[stepIndex]?.name ?? 'column'} column`}
          onClick={(event) => {
            // Scoped to *this* column's blueprint, not the whole canvas: the
            // overview shows every scenario at once, and a handle that
            // selected step 1 across all of them would be selecting cells the
            // user cannot even see.
            const body = bodyRef.current
            if (!body) return
            const cells = Array.from(
              body.querySelectorAll(
                `[data-blueprint-cell][data-blueprint-cell-interactive][data-step-index="${stepIndex}"]`,
              ),
            )
              .map((cell) => cell.getAttribute('data-blueprint-cell'))
              .filter((id): id is string => id !== null)
            if (cells.length === 0) return
            event.stopPropagation()
            pick.pickMany(cells, event.shiftKey ? 'toggle' : 'add')
          }}
          className="pointer-events-auto absolute truncate rounded-md border border-dashed border-border/70 bg-card/90 px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-foreground"
          style={{ left: column.left, width: column.width, top: -32 }}
        >
          {steps[stepIndex]?.name ?? `Step ${stepIndex + 1}`}
        </button>
      ))}
    </div>
  )
}

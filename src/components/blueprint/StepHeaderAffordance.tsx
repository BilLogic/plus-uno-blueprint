import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useEntityDetail } from '@/contexts/EntityDetailContext'
import {
  CANVAS_HEADER_BOX,
  CANVAS_HEADER_HINT,
  CANVAS_HEADER_STATE,
  CANVAS_HEADER_TEXT,
} from '@/lib/canvasHeaderStyle'
import { cn } from '@/lib/utils'

/**
 * The step column header, as the way into the step. Same treatment as the
 * lane's row header — same size, weight, radius, padding and states — and
 * centred rather than top-left, because that is what a column label is.
 *
 * It fills the block the grid gives the column, the way the lane header fills
 * its row: the whole header cell is the target and the whole header cell is
 * what the selected state marks, with the label centred in it.
 *
 * The ⓘ is positioned rather than laid out: an icon in the flex row shifts
 * the label off the column's centre by half its width, whether it is visible
 * or not. Out of flow, the label stays centred over the cells it names and
 * the hint appears at the box's right edge.
 */
export function StepHeaderAffordance({
  stepId,
  name,
  className,
  style,
}: {
  stepId: string
  name: string
  className?: string
  style?: React.CSSProperties
}) {
  const { toggleEntity, selection } = useEntityDetail()
  const open = selection?.kind === 'step' && selection.id === stepId

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-blueprint-column-header=""
            data-step-header-affordance=""
            aria-label={`View details: ${name}`}
            aria-pressed={open}
            style={style}
            onClick={(event) => {
              event.stopPropagation()
              toggleEntity({ kind: 'step', id: stepId })
            }}
            className={cn(
              'group/step-header relative flex h-full min-w-0 items-center justify-center',
              CANVAS_HEADER_BOX,
              CANVAS_HEADER_STATE,
              className,
            )}
          />
        }
      >
        <span
          className={cn(
            'min-w-0 truncate text-center text-muted-foreground',
            CANVAS_HEADER_TEXT,
          )}
        >
          {name}
        </span>
        <Info
          className={cn(
            CANVAS_HEADER_HINT,
            'absolute right-1.5 top-1/2 -translate-y-1/2',
            'group-hover/step-header:opacity-100',
            'group-focus-visible/step-header:opacity-100',
            'group-aria-pressed/step-header:opacity-100',
          )}
          aria-hidden
        />
      </TooltipTrigger>
      {/* The label is right there; repeating it in the tooltip says nothing.
          Above, because the header sits at the top of the grid and a tooltip
          below it lands on the first row of cells. */}
      <TooltipContent side="top">View details</TooltipContent>
    </Tooltip>
  )
}

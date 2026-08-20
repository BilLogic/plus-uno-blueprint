import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useEntityDetail } from '@/contexts/EntityDetailContext'
import { cn } from '@/lib/utils'

/**
 * The step column header, as the way into the step.
 *
 * Same shape as the lane's: the whole header block takes the hover, the focus
 * ring and the click, and the ⓘ appears as the hint rather than being the
 * target. A step is the only level a reader scans horizontally, and until now
 * its name was the one thing on the canvas that said nothing when you reached
 * for it.
 *
 * `name` is truncated by the caller's width; the tooltip carries it in full
 * alongside what the control does.
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
  const { openEntity, selection } = useEntityDetail()
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
              openEntity({ kind: 'step', id: stepId })
            }}
            className={cn(
              'group/step-header relative flex min-w-0 items-end justify-center gap-1',
              'overflow-hidden rounded-md px-2 pb-1.5',
              'transition-colors duration-(--motion-micro)',
              'hover:bg-foreground/5 aria-pressed:bg-foreground/5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              className,
            )}
          />
        }
      >
        <span className="relative truncate text-xs font-medium text-muted-foreground">
          {name}
        </span>
        <Info
          className={cn(
            'size-3 shrink-0 text-muted-foreground/50 opacity-0',
            'transition-opacity duration-(--motion-micro)',
            'group-hover/step-header:opacity-100',
            'group-focus-visible/step-header:opacity-100',
            'group-aria-pressed/step-header:opacity-100',
          )}
          aria-hidden
        />
      </TooltipTrigger>
      <TooltipContent side="bottom">{name} — view details</TooltipContent>
    </Tooltip>
  )
}

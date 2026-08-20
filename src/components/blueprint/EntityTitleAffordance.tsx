import { Info } from 'lucide-react'
import { ScenarioTitleBadge } from '@/components/blueprint/ScenarioTitleBadge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  useEntityDetail,
  type EntityDetailKind,
} from '@/contexts/EntityDetailContext'
import { cn } from '@/lib/utils'

/**
 * The canvas title, and the way into what is behind it.
 *
 * The title and the ⓘ are ONE control, not a label with a button parked next
 * to it: the thing a reader wants to open is the thing named, so the whole
 * group takes the hover, the focus ring and the click. A separate icon button
 * makes the title look inert and hides the affordance in 24 pixels.
 *
 * The badge inside is rendered without its own info tooltip on purpose — a
 * second ⓘ inside the first would be two affordances in one control, and
 * nesting its trigger button inside this one is invalid markup besides. What
 * that tooltip carried (the parallel-scenario note) is authored on the path
 * and reads in the panel this control opens.
 */
export function EntityTitleAffordance({
  kind,
  id,
  label,
  tone,
  className,
}: {
  kind: EntityDetailKind
  id: string
  label: string
  tone?: 'default' | 'panel' | 'phase'
  className?: string
}) {
  const { openEntity, selection } = useEntityDetail()
  const open = selection?.kind === kind && selection.id === id

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            // Says what it does, and which — several of these exist per screen.
            aria-label={`View details: ${label}`}
            aria-pressed={open}
            data-entity-title-affordance=""
            className={cn(
              'group/entity-title flex min-w-0 shrink-0 items-center gap-1 rounded-md px-1 py-0.5',
              'transition-colors duration-(--motion-micro)',
              'hover:bg-sidebar-accent aria-pressed:bg-sidebar-accent',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              className,
            )}
            onClick={(event) => {
              event.stopPropagation()
              openEntity({ kind, id })
            }}
          />
        }
      >
        <ScenarioTitleBadge
          name={label}
          tone={tone}
          className="pointer-events-none"
        />
        <Info
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground/50',
            'transition-colors duration-(--motion-micro)',
            'group-hover/entity-title:text-foreground',
            'group-focus-visible/entity-title:text-foreground',
          )}
          aria-hidden
        />
      </TooltipTrigger>
      <TooltipContent side="bottom">View details</TooltipContent>
    </Tooltip>
  )
}

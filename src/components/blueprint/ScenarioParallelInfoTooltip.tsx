import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getScenarioParallelTooltip } from '@/lib/scenarioParallelInfo'
import type { NavItem } from '@/types/nav'
import { cn } from '@/lib/utils'

type ScenarioParallelInfoTooltipProps = {
  slide: Pick<NavItem, 'id' | 'label'>
  className?: string
  iconClassName?: string
}

/** Info icon explaining that a scenario runs in parallel with others; renders nothing when it does not. */
export function ScenarioParallelInfoTooltip({
  slide,
  className,
  iconClassName,
}: ScenarioParallelInfoTooltipProps) {
  const tooltip = getScenarioParallelTooltip(slide)
  if (!tooltip) return null

  return (
    <Tooltip>
      <TooltipTrigger
        className={cn(
          'inline-flex size-auto shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-muted-foreground shadow-none transition-colors hover:bg-transparent hover:text-foreground',
          className,
        )}
        aria-label="Parallel scenario information"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <Info className={cn('size-3.5', iconClassName)} aria-hidden />
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-xs text-center">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

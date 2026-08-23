import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { PANEL_TEXT } from '@/lib/panelText'
import { cn } from '@/lib/utils'

/**
 * What this app's own words mean, hung off the words themselves.
 *
 * A dozen section labels named a concept — `Dependencies`, `Evidence`,
 * `Resources`, `Applies when` — and said nothing about it, on the assumption
 * that a reader who has the panel open already knows the vocabulary. The
 * people who most need a blueprint are the ones who do not.
 *
 * No ⓘ beside the label: the label IS the word whose meaning is in question,
 * and hovering the word you do not recognise is where anyone looks first.
 * `tabIndex={0}` because a tooltip on a bare `<span>` cannot be reached by
 * keyboard at all, which is the same failure as touch with a different cause
 * (docs/reference/panel-affordances.md § Hover is never the only way in).
 */
export function PanelTermLabel({
  term,
  definition,
  className,
}: {
  term: string
  definition: string
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            className={cn(
              PANEL_TEXT.sectionLabel,
              'w-fit cursor-default rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              className,
            )}
          />
        }
      >
        {term}
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{definition}</TooltipContent>
    </Tooltip>
  )
}

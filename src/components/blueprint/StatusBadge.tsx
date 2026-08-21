import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ENTITY_STATUS_MEANING,
  ENTITY_STATUS_SHORT,
  type EntityStatus,
} from '@/lib/entityStatus'
import { cn } from '@/lib/utils'

/**
 * How far along a path or a cell is — `live` says nothing, everything else
 * says one word.
 *
 * **Nothing renders for `live`.** It is the default and it is most of the
 * board: a badge on every row saying "Live" is a badge nobody reads, and by the
 * second scenario it would have taught the reader to skip the one place the
 * status actually matters. Same convention cells already use — an unmarked
 * cell is a current one.
 *
 * The word is the whole control, so the definition hovers off the word itself
 * rather than off an icon beside it (see docs/reference/panel-affordances.md).
 */
export function StatusBadge({
  status,
  className,
}: {
  status: EntityStatus | null | undefined
  className?: string
}) {
  if (!status || status === 'live') return null

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="outline"
            className={cn(
              'shrink-0 gap-0 px-1.5 py-0 text-2xs font-normal',
              // Unbuilt is quiet — it describes something nobody can use yet,
              // so it must not out-shout the name it sits beside. `at_risk`
              // and `deprecated` describe something live and going wrong,
              // which is the one case worth a colour.
              (status === 'at_risk' || status === 'deprecated') &&
                'border-warning-400 bg-warning-200 text-foreground',
              className,
            )}
          />
        }
      >
        {ENTITY_STATUS_SHORT[status]}
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        {ENTITY_STATUS_MEANING[status]}
      </TooltipContent>
    </Tooltip>
  )
}

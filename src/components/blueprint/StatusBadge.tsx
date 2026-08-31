import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ENTITY_STATUS_MEANING,
  ENTITY_STATUS_SHORT,
  isUnbuilt,
  type EntityStatus,
} from '@/lib/entityStatus'
import { cn } from '@/lib/utils'

/**
 * How far along a path or a cell is.
 *
 * Every status renders, `live` included. It was hidden at first on the
 * argument that the default is most of the board and a badge nobody reads is
 * worse than no badge — but that reasoning only holds in a dense list. In a
 * properties block a labelled field with no value reads as broken, and "is
 * this live?" is the first question a reader brings to a route they have not
 * seen before. Answering it costs one word.
 *
 * Three treatments, because the six values are not three kinds of the same
 * thing:
 *
 * - **live** — quiet and solid. The norm, stated.
 * - **unbuilt** (proposed / planned / built) — muted, and DASHED, echoing the
 *   dashed border those cells already carry on the canvas. One vocabulary for
 *   "this does not exist yet", in the panel and on the board.
 * - **at_risk / deprecated** — the warning tint. These describe something live
 *   and going wrong, which is the one case worth a colour.
 *
 * The word is the whole control, so the definition hovers off the word itself
 * rather than an icon beside it (docs/reference/panel-affordances.md).
 */
export function StatusBadge({
  status,
  className,
}: {
  status: EntityStatus | null | undefined
  className?: string
}) {
  if (!status) return null

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="outline"
            // Reachable without a pointer, and saying so with the cursor: the
            // word IS the control, so the definition has to be gettable by
            // keyboard too (docs/reference/panel-affordances.md § Hover is
            // never the only way in). No hover colour — see `ui/badge.tsx`.
            tabIndex={0}
            className={cn(
              'shrink-0 cursor-help gap-0 px-1.5 py-0 text-2xs font-normal',
              status === 'live' && 'text-foreground/80',
              isUnbuilt(status) && 'border-dashed text-muted-foreground',
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

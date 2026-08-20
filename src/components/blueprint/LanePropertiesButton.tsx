import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconTooltip } from '@/components/editor/IconTooltip'
import { useEntityDetail } from '@/contexts/EntityDetailContext'
import { cn } from '@/lib/utils'

/**
 * The lane's own affordance — a dedicated control, never a new meaning for the
 * label.
 *
 * A lane label already means two different things depending on where it is
 * rendered: inert prose in the grid, and "select every cell in this lane" in
 * the label rail's Design mode. Neither is "show me its properties", and
 * teaching either of them a third reading would make the rail's selection
 * handle ambiguous. So: a separate button, sized and inked like `SidebarNav`'s
 * row actions — 24px target, 14px glyph, no fill of its own, because the row
 * it sits in already has one.
 *
 * Revealed on hover or focus-within, and ALWAYS in the tab order: it is
 * transparent at rest rather than absent, because a control keyboard users
 * cannot reach is not an affordance.
 */
export function LanePropertiesButton({
  laneId,
  laneName,
  className,
}: {
  laneId: string
  laneName: string
  className?: string
}) {
  const { openEntity } = useEntityDetail()
  return (
    <IconTooltip label="Lane properties">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        // Names the lane, because several of these sit in one column and
        // "Lane properties" five times over tells a screen-reader user
        // nothing. The tooltip says what it does; this says which.
        aria-label={`Lane properties: ${laneName}`}
        className={cn(
          'size-6 shrink-0 text-muted-foreground/50 hover:text-foreground',
          'opacity-0 transition-opacity duration-(--motion-micro)',
          'group-hover/lane-header:opacity-100 group-focus-within/lane-header:opacity-100',
          'focus-visible:opacity-100',
          className,
        )}
        onClick={(event) => {
          // The label rail's lane button and the canvas both listen above
          // this; opening a panel is not a selection and not a pan.
          event.stopPropagation()
          openEntity({ kind: 'lane', id: laneId })
        }}
      >
        <Info className="size-3.5" />
      </Button>
    </IconTooltip>
  )
}

import { Info } from 'lucide-react'
import { useEntityDetail } from '@/contexts/EntityDetailContext'
import { cn } from '@/lib/utils'

/**
 * The lane's name, and the way into its properties — one control filling the
 * label block rather than a 24px icon beside an inert word.
 *
 * The label block is dead space otherwise: it holds one word and the rest of
 * its height is padding. Giving the whole block the hover, the focus ring and
 * the click makes the affordance findable at the size it actually is, and the
 * ⓘ stops being the target and becomes the hint that there is one.
 *
 * NOT used where the label already means something else. In the compare
 * rail's Design mode the label is a *selection* handle — clicking takes every
 * cell in the lane — and a second meaning on the same word would make both
 * ambiguous. There the ⓘ stays a button of its own, beside it.
 */
export function LaneHeaderAffordance({
  laneId,
  laneName,
  color,
  compact = false,
  className,
}: {
  laneId: string
  laneName: string
  /** The lane's own label ink — role-derived, passed by the caller. */
  color?: string
  compact?: boolean
  className?: string
}) {
  const { openEntity, selection } = useEntityDetail()
  const open = selection?.kind === 'lane' && selection.id === laneId

  return (
    <button
      type="button"
      data-blueprint-row-header=""
      data-lane-header-affordance=""
      aria-label={`View details: ${laneName}`}
      aria-pressed={open}
      onClick={(event) => {
        // The canvas pans on pointer-down anywhere it does not recognise;
        // opening a panel is neither a pan nor a selection.
        event.stopPropagation()
        openEntity({ kind: 'lane', id: laneId })
      }}
      className={cn(
        'group/lane-header -mx-1 flex min-w-0 flex-1 items-start gap-1.5 self-stretch',
        'rounded-md px-1 py-0.5 text-left',
        'transition-colors duration-(--motion-micro)',
        'hover:bg-foreground/5 aria-pressed:bg-foreground/5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
    >
      <span
        className={cn(
          'min-w-0 flex-1 font-bold leading-snug tracking-tight whitespace-normal break-words',
          compact ? 'text-xs' : 'text-sm',
        )}
        style={color ? { color } : undefined}
      >
        {laneName}
      </span>
      {/* The hint, not the target: transparent at rest, and it never takes
          the click on its own — the whole block already has it. */}
      <Info
        className={cn(
          'mt-0.5 size-3.5 shrink-0 text-muted-foreground/50 opacity-0',
          'transition-opacity duration-(--motion-micro)',
          'group-hover/lane-header:opacity-100',
          'group-focus-visible/lane-header:opacity-100',
          'group-aria-pressed/lane-header:opacity-100',
        )}
        aria-hidden
      />
    </button>
  )
}

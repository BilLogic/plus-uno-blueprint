import type { CSSProperties } from 'react'
import { PathDescriptionTooltip } from '@/components/blueprint/PathDescriptionTooltip'
import { Badge } from '@/components/ui/badge'
import { getPathBadgeStyle } from '@/lib/pathColorTheme'
import { cn } from '@/lib/utils'
import type { PathType } from '@/types/database'

type PathLabelBadgeProps = {
  name: string
  description: string | null | undefined
  pathType: PathType
  compact?: boolean
  className?: string
  style?: CSSProperties
  side?: 'top' | 'bottom' | 'left' | 'right'
  /**
   * Path descriptions are scenario-specific — set false on overview/phase chrome.
   * Defaults to true.
   */
  showTooltip?: boolean
}

/**
 * The path's name as a BADGE: what this band, column or cell belongs to.
 *
 * One per path, drawn from no set the reader picks from, and not clickable —
 * so it takes the badge's geometry, the path-type colour, and the description
 * on hover and on focus. It carried a dismiss control until #182; nothing ever
 * passed one, and a removable value is a TAG rather than a badge, which is a
 * different component with a different promise (see `OwnerTagSelect`, the only
 * one in the app).
 */
export function PathLabelBadge({
  name,
  description,
  pathType,
  compact = false,
  className,
  style,
  side = 'top',
  showTooltip = true,
}: PathLabelBadgeProps) {
  const badge = (
    <Badge
      // Fill AND its derived ink come from this one attribute (blueprint.css).
      data-blueprint-fill
      // `cursor-help` and the focus ring only where there is a tooltip to
      // reach: on overview chrome this badge explains nothing, and a help
      // cursor over a word with no explanation is a promise it cannot keep.
      {...(showTooltip ? { tabIndex: 0 } : {})}
      className={cn(
        'max-w-full gap-1 border-transparent font-semibold',
        showTooltip ? 'cursor-help' : 'cursor-default',
        compact ? 'h-5 px-2 py-0.5 text-xs' : 'h-auto px-2.5 py-1 text-sm',
        className,
      )}
      style={{
        ...getPathBadgeStyle({ path_type: pathType, name }),
        ...style,
      }}
    >
      <span className="truncate leading-none tracking-tight">{name}</span>
    </Badge>
  )

  if (!showTooltip) return badge

  return (
    <PathDescriptionTooltip
      description={description}
      pathName={name}
      side={side}
    >
      {badge}
    </PathDescriptionTooltip>
  )
}

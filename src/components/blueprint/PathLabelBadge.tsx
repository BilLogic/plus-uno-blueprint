import type { CSSProperties } from 'react'
import { EntityDefinitionPopover } from '@/components/blueprint/EntityDefinitionPopover'
import { DEFINED_LABEL_CUE } from '@/lib/panelText'
import { Badge } from '@/components/ui/badge'
import { getPathBadgeStyle } from '@/lib/pathColorTheme'
import { cn } from '@/lib/utils'
import type { PathKind } from '@/types/database'

type PathLabelBadgeProps = {
  name: string
  description: string | null | undefined
  pathKind: PathKind
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
 * so it takes the badge's geometry, the path-type colour, and what a path IS
 * on hover, on focus and on tap. It carried a dismiss control until #182;
 * nothing ever passed one, and a removable value is a TAG rather than a badge,
 * which is a different component with a different promise (see
 * `OwnerTagSelect`, the only one in the app).
 *
 * The explanation is a POPOVER rather than a tooltip since #140: a tooltip
 * never opens on touch, so on a phone this badge explained nothing at all.
 */
export function PathLabelBadge({
  name,
  description,
  pathKind,
  className,
  style,
  side = 'top',
  showTooltip = true,
}: PathLabelBadgeProps) {
  const badge = (
    <Badge
      // Fill AND its derived ink come from this one attribute (blueprint.css).
      data-blueprint-fill
      // `cursor-help`, the dotted cue and the focus ring only where there is
      // an explanation to reach: on overview chrome this badge explains
      // nothing, and a help cursor over a word with no explanation is a
      // promise it cannot keep. The popover trigger supplies `tabIndex`.
      className={cn(
        'max-w-full gap-1 border-transparent font-semibold',
        showTooltip ? 'cursor-help' : 'cursor-default',
        className,
      )}
      style={{
        ...getPathBadgeStyle({ kind: pathKind, name }),
        ...style,
      }}
    >
      <span
        className={cn(
          'truncate leading-none tracking-tight',
          showTooltip && DEFINED_LABEL_CUE,
        )}
      >
        {name}
      </span>
    </Badge>
  )

  if (!showTooltip) return badge

  return (
    <EntityDefinitionPopover
      kind="path"
      description={description}
      name={name}
      showDescription
      side={side}
    >
      {badge}
    </EntityDefinitionPopover>
  )
}

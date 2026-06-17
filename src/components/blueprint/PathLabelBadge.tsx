import type { CSSProperties } from 'react'
import { PathDescriptionTooltip } from '@/components/blueprint/PathDescriptionTooltip'
import { Badge } from '@/components/ui/badge'
import { PATH_TYPE_BADGE_CLASSES } from '@/lib/pathTypeTheme'
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
}

/** Path name pill with shadcn Badge styling, path-type color, and description tooltip. */
export function PathLabelBadge({
  name,
  description,
  pathType,
  compact = false,
  className,
  style,
  side = 'top',
}: PathLabelBadgeProps) {
  return (
    <PathDescriptionTooltip
      description={description}
      pathName={name}
      side={side}
    >
      <Badge
        className={cn(
          'h-auto max-w-full cursor-default gap-1.5 border-transparent px-2.5 py-1 font-semibold',
          PATH_TYPE_BADGE_CLASSES[pathType],
          compact ? 'text-xs' : 'text-sm',
          className,
        )}
        style={style}
      >
        <span className="truncate leading-none tracking-tight">{name}</span>
      </Badge>
    </PathDescriptionTooltip>
  )
}

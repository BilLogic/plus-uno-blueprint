import type { CSSProperties } from 'react'
import { PathDescriptionTooltip } from '@/components/blueprint/PathDescriptionTooltip'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type ScenarioTitleBadgeProps = {
  name: string
  description?: string | null
  className?: string
  style?: CSSProperties
  side?: 'top' | 'bottom' | 'left' | 'right'
}

/** Default scenario badge with name + description tooltip (phase overview). */
export function ScenarioTitleBadge({
  name,
  description,
  className,
  style,
  side = 'top',
}: ScenarioTitleBadgeProps) {
  return (
    <PathDescriptionTooltip
      description={description}
      pathName={name}
      showNameInTooltip
      side={side}
    >
      <Badge
        className={cn('max-w-full cursor-default truncate', className)}
        style={style}
      >
        {name}
      </Badge>
    </PathDescriptionTooltip>
  )
}

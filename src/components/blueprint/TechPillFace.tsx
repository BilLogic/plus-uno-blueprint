import { BlueprintCellButton } from '@/components/blueprint/BlueprintCellButton'
import { getTechPillStyle } from '@/lib/techPillTheme'
import { cn } from '@/lib/utils'

type TechPillFaceProps = {
  item: string
  compact?: boolean
  className?: string
}

export function TechPillFace({ item, compact = false, className }: TechPillFaceProps) {
  return (
    <BlueprintCellButton
      fill={getTechPillStyle(item).backgroundColor}
      variant="pill"
      compact={compact}
      className={cn('min-w-0 shrink-0 break-words', className)}
    >
      {item}
    </BlueprintCellButton>
  )
}

import { Camera } from 'lucide-react'
import { BlueprintCellButton } from '@/components/blueprint/BlueprintCellButton'
import { BLUEPRINT_CELL_PALETTE } from '@/lib/blueprintTheme'
import type { BlueprintCellSelection } from '@/types/blueprintCellDetail'
import { cn } from '@/lib/utils'

type BlueprintStepVisualProps = {
  compact?: boolean
  className?: string
  fill?: string
  selection?: BlueprintCellSelection
  cellId?: string
  stepIndex?: number
  opacity?: number
}

export function BlueprintStepVisual({
  compact = false,
  className,
  fill = BLUEPRINT_CELL_PALETTE.visual,
  selection,
  cellId,
  stepIndex,
  opacity,
}: BlueprintStepVisualProps) {
  return (
    <BlueprintCellButton
      fill={fill}
      compact={compact}
      variant="visual"
      className={className}
      selection={selection}
      cellId={cellId}
      stepIndex={stepIndex}
      opacity={opacity}
      aria-label="Image placeholder"
    >
      <Camera
        className={cn('shrink-0 text-muted-foreground', compact ? 'size-5' : 'size-6')}
        aria-hidden
      />
    </BlueprintCellButton>
  )
}

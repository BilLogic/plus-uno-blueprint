import { BlueprintCellButton } from '@/components/blueprint/BlueprintCellButton'
import {
  buildTechPillSelection,
  type BlueprintCellSelectionContext,
} from '@/lib/blueprintCellSelection'
import { getTechPillStyle } from '@/lib/techPillTheme'

type BlueprintTechPillProps = {
  item: string
  selectionContext: BlueprintCellSelectionContext
  stepIndex: number
  compact?: boolean
  opacity?: number
  /** Pills share their cell id — only the first pill carries the badge. */
  sliceSequenceBadge?: boolean
}

export function BlueprintTechPill({
  item,
  selectionContext,
  stepIndex,
  compact = false,
  opacity,
  sliceSequenceBadge = false,
}: BlueprintTechPillProps) {
  return (
    <BlueprintCellButton
      fill={getTechPillStyle(item).backgroundColor}
      selection={buildTechPillSelection(selectionContext, item)}
      cellId={selectionContext.cellId}
      stepIndex={stepIndex}
      variant="pill"
      compact={compact}
      opacity={opacity}
      sliceSequenceBadge={sliceSequenceBadge}
      className="min-w-0 shrink-0 break-words"
      data-blueprint-tech-pill={item}
    >
      {item}
    </BlueprintCellButton>
  )
}

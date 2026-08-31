import { BlueprintCellButton } from '@/components/blueprint/BlueprintCellButton'
import type { EntityStatus } from '@/lib/entityStatus'
import {
  buildTouchpointSelection,
  type BlueprintCellSelectionContext,
} from '@/lib/blueprintCellSelection'
import {
  PILL_ITEM_HEIGHT,
  PILL_ITEM_HEIGHT_COMPACT,
} from '@/lib/blueprintLayout'
import { getTouchpointTone } from '@/lib/touchpointColors'
import type { CSSProperties } from 'react'

type BlueprintTouchpointCellProps = {
  item: string
  selectionContext: BlueprintCellSelectionContext
  stepIndex: number
  compact?: boolean
  opacity?: number
  style?: CSSProperties
  className?: string
  /** Pills share their cell id — only the first pill carries the badge. */
  sliceSequenceBadge?: boolean
  /** Passed through so an unbuilt touchpoint does not read as a live one. */
  status?: EntityStatus | null
  'aria-describedby'?: string
}

/**
 * One tech/tool pill inside a Tech-lane cell. Pills share their cell's id, so
 * only the first carries the slice sequence badge.
 */
export function BlueprintTouchpointCell({
  item,
  selectionContext,
  stepIndex,
  compact = false,
  opacity,
  style,
  className,
  sliceSequenceBadge = false,
  status,
  'aria-describedby': ariaDescribedBy,
}: BlueprintTouchpointCellProps) {
  const fixedHeight = compact ? PILL_ITEM_HEIGHT_COMPACT : PILL_ITEM_HEIGHT
  return (
    <BlueprintCellButton
      status={status}
      fill="frontstage-tech"
      tone={getTouchpointTone(item)}
      selection={buildTouchpointSelection(selectionContext, item)}
      cellId={selectionContext.cellId}
      stepIndex={stepIndex}
      variant="touchpoint"
      compact={compact}
      opacity={opacity}
      style={{
        ...style,
        height: fixedHeight,
        minHeight: fixedHeight,
        maxHeight: fixedHeight,
      }}
      aria-label={item}
      aria-describedby={ariaDescribedBy}
      sliceSequenceBadge={sliceSequenceBadge}
      className={`min-w-0 shrink-0 break-words${className ? ` ${className}` : ''}`}
      data-blueprint-touchpoint={item}
    >
      <span className="line-clamp-2 break-words" title={item}>
        {item}
      </span>
    </BlueprintCellButton>
  )
}

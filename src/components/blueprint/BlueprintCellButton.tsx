import { Button } from '@/components/ui/button'
import { useBlueprintCellDetailOptional } from '@/contexts/BlueprintCellDetailContext'
import {
  blueprintCellButtonClassName,
  getBlueprintCellInteractionStyle,
} from '@/lib/blueprintCellStyle'
import { isSameBlueprintCellSelection } from '@/lib/blueprintCellSelection'
import { BLUEPRINT_CELL_DETAIL_UI_ENABLED } from '@/lib/blueprintDisplayFlags'
import type { BlueprintCellSelection } from '@/types/blueprintCellDetail'
import { cn } from '@/lib/utils'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'

type BlueprintCellButtonProps = {
  /** Layer or pill pastel fill — drives button background while keeping shadcn interaction states. */
  fill: string
  compact?: boolean
  className?: string
  selection?: BlueprintCellSelection
  cellId?: string
  stepIndex?: number
  variant?: 'cell' | 'pill' | 'visual'
  opacity?: number
  children: ReactNode
  'aria-label'?: string
  'data-blueprint-tech-pill'?: string
}

export function BlueprintCellButton({
  fill,
  compact = false,
  className,
  selection,
  cellId,
  stepIndex = -1,
  variant = 'cell',
  opacity,
  children,
  'aria-label': ariaLabel,
  'data-blueprint-tech-pill': techPillLabel,
}: BlueprintCellButtonProps) {
  const detail = useBlueprintCellDetailOptional()
  const isInteractive =
    BLUEPRINT_CELL_DETAIL_UI_ENABLED && Boolean(selection && detail)
  const isActive =
    isInteractive &&
    isSameBlueprintCellSelection(detail!.selection, selection!)

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!isInteractive) return
    event.stopPropagation()
    detail!.selectCell(selection!)
  }

  const surfaceStyle = {
    ...getBlueprintCellInteractionStyle(fill),
    ...(opacity != null && opacity < 1 ? { opacity } : undefined),
  } as CSSProperties

  const buttonVariant = variant === 'pill' ? 'blueprintPill' : 'blueprint'

  return (
    <Button
      type="button"
      variant={buttonVariant}
      data-blueprint-cell-anchor=""
      {...(cellId ? { 'data-blueprint-cell': cellId } : {})}
      data-step-index={stepIndex}
      {...(techPillLabel ? { 'data-blueprint-tech-pill': techPillLabel } : {})}
      aria-label={ariaLabel}
      aria-pressed={isInteractive ? isActive : undefined}
      {...(isInteractive ? { 'data-blueprint-cell-interactive': '' } : {})}
      onClick={isInteractive ? handleClick : undefined}
      tabIndex={isInteractive ? 0 : -1}
      className={cn(
        blueprintCellButtonClassName({ compact, variant, className }),
        variant === 'cell' && 'min-h-[80px]',
        variant === 'visual' && (compact ? 'min-h-[5.5rem]' : 'min-h-[7rem]'),
        !isInteractive && 'pointer-events-none cursor-default',
      )}
      style={surfaceStyle}
    >
      {children}
    </Button>
  )
}

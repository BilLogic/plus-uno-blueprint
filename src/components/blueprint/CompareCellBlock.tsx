import { BlueprintCellButton } from '@/components/blueprint/BlueprintCellButton'
import { BlueprintStepVisual } from '@/components/blueprint/BlueprintStepVisual'
import { BlueprintTechPill } from '@/components/blueprint/BlueprintTechPill'
import { TechPillFace } from '@/components/blueprint/TechPillFace'
import {
  STEP_COLUMN_WIDTH,
  getVisualCellButtonMaxHeight,
  type BlueprintCellVariant,
} from '@/lib/blueprintLayout'
import {
  buildBlueprintCellSelection,
  getTechPillItems,
  type BlueprintCellSelectionContext,
} from '@/lib/blueprintCellSelection'
import type { BlueprintLayerStyle } from '@/lib/blueprintTheme'
import { cn } from '@/lib/utils'
import type { BlueprintCell } from '@/types/blueprint'

/**
 * One cell of a compare grid — the same face in every arrangement (stacked
 * bands, overview columns, merged slots), down to its `data-blueprint-cell`
 * anchor, so selection, focus/pulse and arrow geometry behave identically
 * wherever it is drawn.
 */

/**
 * The merged view's path rail: a 3px left edge in the path's colour AND its
 * dash pattern (colour alone would fail SC 1.4.1), plus the path's short
 * label. Only sub-cells of a DIVERGENT slot carry one — a shared cell
 * belongs to every path and is drawn bare.
 */
export type CompareCellPathRail = {
  color: string
  /** Paired with the colour through `getPathDashArray`, never independent. */
  dashed: boolean
  /** Short label ("HP") — see `buildComparePathShortLabels`. */
  label: string
  /** Full path name, for the rail's tooltip/title. */
  pathName: string
}

export function CompareCellBlock({
  cellId,
  stepIndex,
  content,
  laneStyle,
  variant,
  compact,
  flushBottom,
  selectionContext,
  visualPictures,
  slotCells,
  pathRail,
}: {
  cellId?: string
  stepIndex: number
  content?: string
  laneStyle: BlueprintLayerStyle
  variant: BlueprintCellVariant
  compact?: boolean
  flushBottom?: boolean
  selectionContext?: BlueprintCellSelectionContext
  visualPictures?: Array<{ picture: string; label: string }>
  /** Every cell in a tech slot — one per touchpoint since the split. */
  slotCells?: BlueprintCell[]
  pathRail?: CompareCellPathRail
}) {
  const shellPadding = cn(
    compact ? 'px-3' : 'px-3.5',
    compact ? 'pt-3' : 'pt-4',
    flushBottom ? 'pb-0' : compact ? 'pb-3' : 'pb-4',
  )
  const width = STEP_COLUMN_WIDTH
  const isVisual = variant === 'visual'
  const shellVerticalPad = compact ? 24 : 32
  const shellStyle = {
    width,
    minWidth: width,
    maxWidth: width,
    ...(isVisual
      ? { maxHeight: getVisualCellButtonMaxHeight(compact) + shellVerticalPad }
      : undefined),
  }
  const shellClassName = cn(
    'relative z-[1] flex shrink-0 items-stretch',
    shellPadding,
    isVisual && 'min-h-0 overflow-hidden',
  )

  const innerContent =
    variant === 'visual' ? (
      <div className="relative flex h-full min-h-0 max-h-full w-full flex-1 overflow-hidden">
        <BlueprintStepVisual
          compact={compact}
          fill={laneStyle.lane}
          pictures={visualPictures}
          selection={
            selectionContext
              ? buildBlueprintCellSelection(selectionContext)
              : undefined
          }
          cellId={cellId}
          stepIndex={stepIndex}
          className="flex-1"
        />
      </div>
    ) : variant === 'pills' ? (
      <div
        {...(cellId ? { 'data-blueprint-cell': cellId } : {})}
        data-step-index={stepIndex}
        className={cn(
          'flex w-full flex-1 flex-col items-stretch',
          compact ? 'gap-2' : 'gap-2.5',
        )}
      >
        {(slotCells && slotCells.length > 0
          ? slotCells.flatMap((slotCell) =>
              getTechPillItems(slotCell.content ?? '').map((item) => ({
                item,
                slotCell,
              })),
            )
          : getTechPillItems(content).map((item) => ({
              item,
              slotCell: undefined,
            }))
        ).map(({ item, slotCell }, index, all) =>
          selectionContext ? (
            <BlueprintTechPill
              key={`${slotCell?.id ?? 'anon'}-${item}-${index}`}
              item={item}
              // Identity is the split's point: each pill carries its own
              // cell in the selection it hands to the panel and the picker.
              selectionContext={
                slotCell
                  ? {
                      ...selectionContext,
                      cellId: slotCell.id,
                      cellContent: slotCell.content ?? '',
                      cellPicture: slotCell.picture ?? null,
                      cellDescription: slotCell.description ?? null,
                      cellLinks: slotCell.links,
                    }
                  : selectionContext
              }
              stepIndex={stepIndex}
              compact={compact}
              sliceSequenceBadge={
                index === 0 || slotCell?.id !== all[index - 1]?.slotCell?.id
              }
            />
          ) : (
            <TechPillFace
              key={`${item}-${index}`}
              item={item}
              compact={compact}
              className="shrink-0"
            />
          ),
        )}
      </div>
    ) : (
      <BlueprintCellButton
        fill={laneStyle.lane}
        compact={compact}
        selection={
          selectionContext
            ? buildBlueprintCellSelection(selectionContext)
            : undefined
        }
        cellId={cellId}
        stepIndex={stepIndex}
      >
        <p className="w-full whitespace-pre-wrap">{content}</p>
      </BlueprintCellButton>
    )

  return (
    <div className={shellClassName} style={shellStyle}>
      {pathRail ? (
        <>
          {/* Affiliation by TINT, not by rail (plan 2026-08-17-002 U3):
              the colored side-lines read as noise; a low-alpha wash of the
              path color over the cell says "this one belongs to that path"
              without adding a stroke. The short label stays — it is the
              non-color identification the dashed/solid pairing used to
              carry (SC 1.4.1). */}
          <span
            aria-hidden
            className="pointer-events-none absolute z-[2] rounded-2xl"
            style={{
              left: compact ? 12 : 14,
              right: compact ? 12 : 14,
              top: compact ? 12 : 16,
              bottom: flushBottom ? 0 : compact ? 12 : 16,
              backgroundColor: `color-mix(in oklab, ${pathRail.color} 14%, transparent)`,
            }}
          />
          <span
            title={pathRail.pathName}
            className="pointer-events-none absolute left-2.5 top-0 z-[3] font-mono text-3xs font-semibold tabular-nums"
            style={{ color: pathRail.color }}
          >
            {pathRail.label}
            <span className="sr-only">{` (${pathRail.pathName})`}</span>
          </span>
        </>
      ) : null}
      {innerContent}
    </div>
  )
}

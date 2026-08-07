import { Fragment, useMemo, useRef, type RefObject } from 'react'
import { BlueprintCellButton } from '@/components/blueprint/BlueprintCellButton'
import { BlueprintColumnHandles } from '@/components/blueprint/BlueprintColumnHandles'
import { BlueprintLaneHandles } from '@/components/blueprint/BlueprintLaneHandles'
import { BlueprintEmptyCellSlot } from '@/components/blueprint/BlueprintEmptyCellSlot'
import { BlueprintStepVisual } from '@/components/blueprint/BlueprintStepVisual'
import { BlueprintTechPill } from '@/components/blueprint/BlueprintTechPill'
import { TechPillFace } from '@/components/blueprint/TechPillFace'
import {
  BlueprintDividerRow,
  BlueprintLabelRow,
  BlueprintStickyLabelBackdrop,
  BlueprintSwimLaneDivider,
} from '@/components/blueprint/BlueprintLabelRail'
import { ComparePathSectionFrame } from '@/components/blueprint/ComparePathSectionFrame'
import { IntegratedTriggerArrows } from '@/components/blueprint/IntegratedTriggerArrows'
import { BlueprintVisualPlayButton } from '@/components/blueprint/BlueprintVisualPlayButton'
import {
  BLUEPRINT_DISCOVERY_RAIL_CORRIDOR_MARGIN,
  BLUEPRINT_LAYER_ROW_GAP,
  BLUEPRINT_REGULAR_TUTOR_LOOP_CORRIDOR_MARGIN,
  BLUEPRINT_WRAP_CORRIDOR_MARGIN,
  STEP_COLUMN_GAP,
  STEP_COLUMN_WIDTH,
  layerPrecedesBlueprintDivider,
  getVisualCellButtonMaxHeight,
  shouldUsePillCellContent,
  shouldUseVisualContent,
} from '@/lib/blueprintLayout'
import { buildCellLookup, getCellAt, getCellsAt } from '@/lib/normalizeBlueprint'
import { parseCellContentItems } from '@/lib/parseCellContent'
import {
  getBlueprintLayerStyle,
  getBlueprintLayerZone,
  type BlueprintLayerStyle,
} from '@/lib/blueprintTheme'
import {
  type BlueprintLabelRowSpec,
  getComparePathArrowData,
  resolveBlueprintLayer,
} from '@/lib/sideBySideCompareLayout'
import { cn } from '@/lib/utils'
import {
  buildBlueprintCellSelection,
  getTechPillItems,
  type BlueprintCellSelectionContext,
} from '@/lib/blueprintCellSelection'
import { resolveVisualStepPictureEntries } from '@/lib/visualWalkthrough'
import { isBlueprintVisualWalkthroughEnabled } from '@/lib/blueprintDisplayFlags'
import { buildVisualWalkthroughSession } from '@/lib/visualWalkthrough'
import type { BlueprintData, BlueprintCell, BlueprintStep } from '@/types/blueprint'

/** Left gutter on the white board so the play control clears Visual cells. */
const VISUAL_PLAY_GUTTER = 28

/**
 * How one band is placed inside its parent grid.
 *
 * - `column`: the horizontal (overview) arrangement — the band is one grid
 *   COLUMN whose row tracks come from the parent via `gridTemplateRows:
 *   subgrid`, so lane rows stay aligned across paths.
 * - `row`: the stacked (focused scenario) arrangement — the band is one grid
 *   ROW whose column tracks come from the parent via `gridTemplateColumns:
 *   subgrid` (one canonical step axis shared by every band), and the band
 *   owns its lane-row tracks.
 */
export type PathBandArrangement =
  | { kind: 'column'; columnIndex: number; withLaneHandles: boolean }
  | {
      kind: 'row'
      gridRow: number
      columns: readonly StackedBandColumn[]
      rowTrackCss: string
      marginTop?: number
      onToggleLayer?: (layerId: string) => void
    }

/** One canonical step column of the stacked arrangement. */
export type StackedBandColumn = {
  key: string
  label: string
  /** This column's backing step id per path — absent path ⇒ inert spacer. */
  stepIdByPath: Readonly<Record<string, string>>
  /** Column-level verdict !== 'shared' (drives the light column tint). */
  divergent: boolean
}

type BlueprintPathBandProps = {
  blueprint: BlueprintData
  layers: BlueprintData['layers']
  rows: BlueprintLabelRowSpec[]
  arrangement: PathBandArrangement
  compact?: boolean
  scrollContainerRef?: RefObject<HTMLDivElement | null>
  scenarioName?: string
  phaseName?: string
  showPathTypeBadge?: boolean
  fillSwimlaneHeight?: boolean
}

/**
 * One path's full lane-row band — section frame, trigger arrows, design-mode
 * handles and the cells themselves. Both compare arrangements compose this
 * component; only the placement (`arrangement`) differs. The rendering of a
 * cell is identical in both, down to its `data-blueprint-cell` anchors.
 */
export function BlueprintPathBand({
  blueprint,
  layers,
  rows,
  arrangement,
  compact,
  scrollContainerRef,
  scenarioName,
  phaseName,
  showPathTypeBadge = false,
  fillSwimlaneHeight = false,
}: BlueprintPathBandProps) {
  const bandRef = useRef<HTMLDivElement>(null)
  const fallbackScrollRef = useRef<HTMLDivElement>(null)
  const resolvedScrollRef = scrollContainerRef ?? fallbackScrollRef
  const arrowData = useMemo(
    () => getComparePathArrowData(blueprint),
    [blueprint],
  )
  const showPlay =
    isBlueprintVisualWalkthroughEnabled() &&
    buildVisualWalkthroughSession(blueprint).steps.length > 0
  // The stacked arrangement cannot shift cells right for the play control —
  // cells must stay on the canonical column tracks — so the control hangs in
  // the rail gap instead (see CompareLayerRow).
  const playGutter =
    showPlay && arrangement.kind === 'column' ? VISUAL_PLAY_GUTTER : 0

  const placementStyle =
    arrangement.kind === 'column'
      ? {
          gridColumn: arrangement.columnIndex,
          gridRow: `1 / ${rows.length + 1}`,
          gridTemplateRows: 'subgrid',
        }
      : {
          gridRow: arrangement.gridRow,
          gridColumn: '1 / -1',
          gridTemplateColumns: 'subgrid',
          gridTemplateRows: arrangement.rowTrackCss,
          // Do NOT rely on gap inheritance into the subgrid — explicit here.
          columnGap: STEP_COLUMN_GAP,
          rowGap: BLUEPRINT_LAYER_ROW_GAP,
          marginTop: arrangement.marginTop,
        }

  return (
    <div
      ref={bandRef}
      className="relative z-0 grid overflow-visible"
      style={placementStyle}
    >
      <BlueprintColumnHandles
        steps={blueprint.steps}
        bodyRef={bandRef}
        pathId={blueprint.path.id}
      />
      {/* Lanes are scenario-wide, so the horizontal arrangement carries one
          set of handles on its first band; stacked bands are vertically
          disjoint, so each carries its own. */}
      {arrangement.kind === 'column' ? (
        arrangement.withLaneHandles ? (
          <BlueprintLaneHandles bodyRef={bandRef} />
        ) : null
      ) : (
        <BlueprintLaneHandles bodyRef={bandRef} />
      )}
      <ComparePathSectionFrame
        blueprint={blueprint}
        compact={compact}
        showPathTypeBadge={showPathTypeBadge}
      />
      {arrangement.kind === 'row' ? (
        <>
          {/* Divergent columns tint the full band height — the v3 diff
              signal is column-level; cells themselves never carry paint.
              `relative` so the tint paints above the absolutely-positioned
              section frame while staying under the z-[1] cells. */}
          {arrangement.columns.map((column, columnIndex) =>
            column.divergent ? (
              <div
                key={`tint-${column.key}`}
                aria-hidden
                data-blueprint-compare-diffcolumn=""
                className="pointer-events-none relative rounded-md"
                style={{
                  gridColumn: columnIndex + 2,
                  gridRow: '1 / -1',
                  marginLeft: -STEP_COLUMN_GAP / 2,
                  marginRight: -STEP_COLUMN_GAP / 2,
                }}
              />
            ) : null,
          )}
          {/* The label rail re-emits per band: every band names its own
              lanes, in DOM order matching the path order. */}
          <BlueprintStickyLabelBackdrop rowCount={rows.length} />
          {rows.map((row, rowIndex) =>
            row.kind === 'interaction' ||
            row.kind === 'visibility' ||
            row.kind === 'internalInteraction' ? (
              <BlueprintDividerRow
                key={`rail-${row.key}`}
                rowIndex={rowIndex}
                label={row.label}
                lineStyle={
                  row.kind === 'interaction'
                    ? 'dashed'
                    : row.kind === 'internalInteraction'
                      ? 'dotted'
                      : 'solid'
                }
              />
            ) : (
              <Fragment key={`rail-${row.key}`}>
                <BlueprintLabelRow
                  row={row}
                  layers={layers}
                  compact={compact}
                  onToggleLayer={arrangement.onToggleLayer}
                  style={{
                    gridColumn: 1,
                    gridRow: rowIndex + 1,
                    alignSelf: 'start',
                    height: '100%',
                  }}
                />
                {row.showDividerBelow ? (
                  <BlueprintSwimLaneDivider rowIndex={rowIndex} />
                ) : null}
              </Fragment>
            ),
          )}
        </>
      ) : null}
      <IntegratedTriggerArrows
        layer="forward"
        triggers={arrowData.triggers}
        cells={arrowData.cells}
        steps={arrowData.steps}
        paths={[blueprint.path]}
        contentRef={bandRef}
        scrollContainerRef={resolvedScrollRef}
      />
      {rows.map((row, rowIndex) => (
        <CompareCardRow
          key={row.key}
          row={row}
          rowIndex={rowIndex}
          blueprint={blueprint}
          layers={layers}
          compact={compact}
          scenarioName={scenarioName}
          phaseName={phaseName}
          fillSwimlaneHeight={fillSwimlaneHeight}
          playGutter={playGutter}
          showPlay={showPlay}
          stackedColumns={
            arrangement.kind === 'row' ? arrangement.columns : undefined
          }
        />
      ))}
      <IntegratedTriggerArrows
        layer="wrap"
        triggers={arrowData.triggers}
        cells={arrowData.cells}
        steps={arrowData.steps}
        paths={[blueprint.path]}
        contentRef={bandRef}
        scrollContainerRef={resolvedScrollRef}
      />
    </div>
  )
}

function CompareCardRow({
  row,
  rowIndex,
  blueprint,
  layers,
  compact,
  scenarioName,
  phaseName,
  fillSwimlaneHeight = false,
  playGutter = 0,
  showPlay = false,
  stackedColumns,
}: {
  row: BlueprintLabelRowSpec
  rowIndex: number
  blueprint: BlueprintData
  layers: BlueprintData['layers']
  compact?: boolean
  scenarioName?: string
  phaseName?: string
  fillSwimlaneHeight?: boolean
  playGutter?: number
  showPlay?: boolean
  stackedColumns?: readonly StackedBandColumn[]
}) {
  const isDivider =
    row.kind === 'interaction' ||
    row.kind === 'visibility' ||
    row.kind === 'internalInteraction'
  const isLayerRow = row.kind === 'layer'
  const corridorAbove = row.wrapCorridorAbove
    ? BLUEPRINT_DISCOVERY_RAIL_CORRIDOR_MARGIN
    : 0
  const corridorBelow = row.wrapCorridorBelow
    ? BLUEPRINT_WRAP_CORRIDOR_MARGIN
    : 0
  const inLaneLoopCorridorAbove = row.inLaneLoopCorridorAbove
    ? BLUEPRINT_REGULAR_TUTOR_LOOP_CORRIDOR_MARGIN
    : 0

  return (
    <div
      {...(isLayerRow && row.layer
        ? {
            'data-blueprint-swimlane': '',
            'data-blueprint-row': '',
            'data-layer-id': row.layer.id,
            // Lets a picked cell name its lane without the selection
            // carrying the whole blueprint (see lib/canvasCellQuery).
            'data-layer-name': row.layer.name,
          }
        : {})}
      {...(isDivider
        ? {
            'data-blueprint-divider':
              row.kind === 'interaction' ? 'interaction' : 'visibility',
          }
        : {})}
      className={cn(
        'flex h-full min-h-0 flex-col',
        isDivider && 'relative z-[1] overflow-hidden bg-transparent',
        isLayerRow && 'overflow-visible',
      )}
      style={{
        gridRow: rowIndex + 1,
        // Stacked bands span the rail column too; cells start at track 2.
        ...(stackedColumns ? { gridColumn: '2 / -1' } : {}),
        backgroundColor: isDivider ? undefined : 'transparent',
      }}
      {...(isDivider ? { role: 'separator' as const } : {})}
    >
      {corridorAbove > 0 && (
        <div aria-hidden className="shrink-0" style={{ height: corridorAbove }} />
      )}
      <div
        className={cn(
          'min-h-0',
          isDivider
            ? 'flex h-full items-center overflow-hidden'
            : 'flex flex-1 flex-col',
        )}
      >
        {inLaneLoopCorridorAbove > 0 && (
          <div
            aria-hidden
            data-blueprint-loop-corridor="above"
            className="shrink-0"
            style={{ height: inLaneLoopCorridorAbove }}
          />
        )}
        {row.kind === 'layer' && row.layer ? (
          row.collapsed ? (
            <div className="h-full" aria-hidden />
          ) : (
            <CompareLayerRow
              blueprint={blueprint}
              layer={row.layer}
              layers={layers}
              compact={compact}
              scenarioName={scenarioName}
              phaseName={phaseName}
              fillSwimlaneHeight={fillSwimlaneHeight}
              playGutter={playGutter}
              showPlay={showPlay}
              stackedColumns={stackedColumns}
            />
          )
        ) : isDivider ? (
          <div className="h-full" aria-hidden />
        ) : null}
      </div>
      {corridorBelow > 0 && (
        <div
          aria-hidden
          data-blueprint-wrap-corridor="below"
          className="shrink-0"
          style={{ height: corridorBelow }}
        />
      )}
    </div>
  )
}

function CompareLayerRow({
  blueprint,
  layer,
  layers,
  compact,
  scenarioName,
  phaseName,
  fillSwimlaneHeight = false,
  playGutter = 0,
  showPlay = false,
  stackedColumns,
}: {
  blueprint: BlueprintData
  layer: BlueprintData['layers'][number]
  layers: BlueprintData['layers']
  compact?: boolean
  scenarioName?: string
  phaseName?: string
  fillSwimlaneHeight?: boolean
  playGutter?: number
  showPlay?: boolean
  stackedColumns?: readonly StackedBandColumn[]
}) {
  const blueprintLayer = useMemo(
    () => resolveBlueprintLayer(layer, blueprint),
    [blueprint, layer],
  )
  const cellLookup = useMemo(
    () => buildCellLookup(blueprint.cells),
    [blueprint.cells],
  )
  const stepIndexById = useMemo(
    () => new Map(blueprint.steps.map((step, index) => [step.id, index])),
    [blueprint.steps],
  )
  const isPillLayer = shouldUsePillCellContent(layer)
  const laneStyle = getBlueprintLayerStyle(
    layer.name,
    getBlueprintLayerZone(layer, layers),
    layer.role,
  )
  const flushBottom = layerPrecedesBlueprintDivider(layer, layers)
  const isVisualLayer = shouldUseVisualContent(layer)
  const renderPlay =
    showPlay && isVisualLayer && (playGutter > 0 || stackedColumns !== undefined)

  const renderStepCell = (step: BlueprintStep, stepIndex: number) => {
    const cell = getCellAt(cellLookup, blueprintLayer.id, step.id)
    // Tech slots hold one cell per touchpoint since the split.
    const slotCells = isPillLayer
      ? getCellsAt(cellLookup, blueprintLayer.id, step.id)
      : undefined
    const variant = isVisualLayer ? 'visual' : isPillLayer ? 'pills' : 'default'
    const visualPictures = isVisualLayer
      ? resolveVisualStepPictureEntries(blueprint, step.id)
      : undefined
    const showCell = isVisualLayer
      ? (visualPictures?.length ?? 0) > 0
      : isPillLayer
        ? (slotCells ?? []).some((entry) =>
            hasCellContent(entry.content, variant),
          )
        : hasCellContent(cell?.content, variant)

    if (!showCell) {
      // Empty in Edit mode is not nothing: it is where a cell can go.
      // Outside Edit it stays the inert spacer it has always been.
      return (
        <BlueprintEmptyCellSlot
          pathId={blueprint.path.id}
          layerId={blueprintLayer.id}
          stepId={step.id}
          layerName={layer.name}
          stepName={step.name}
          stepIndex={stepIndex}
          scenarioName={scenarioName}
          phaseName={phaseName}
          width={STEP_COLUMN_WIDTH}
          selfStretch
        />
      )
    }

    return (
      <CompareCellBlock
        cellId={cell?.id ?? (isVisualLayer ? `visual-${step.id}` : undefined)}
        stepIndex={stepIndex}
        content={cell?.content}
        laneStyle={laneStyle}
        variant={variant}
        compact={compact}
        flushBottom={flushBottom}
        visualPictures={visualPictures}
        slotCells={slotCells}
        selectionContext={
          scenarioName && (cell?.id || isVisualLayer)
            ? {
                scenarioName,
                phaseName,
                layerName: layer.name,
                stepId: step.id,
                stepName: step.name,
                stepIndex,
                cellId: cell?.id ?? `visual-${step.id}`,
                cellContent: cell?.content ?? '',
                cellPicture: cell?.picture ?? null,
                cellDescription: cell?.description ?? null,
                cellLinks: cell?.links,
                pathId: blueprint.path.id,
                pathName: blueprint.path.name,
                pathDescription: blueprint.path.description,
                pathType: blueprint.path.path_type,
              }
            : undefined
        }
      />
    )
  }

  const playButton = renderPlay ? (
    <div
      className="pointer-events-auto absolute z-50"
      style={{
        // Stacked bands keep cells on the canonical tracks, so the play
        // control hangs in the rail gap to their left instead of a gutter.
        left: stackedColumns ? -(STEP_COLUMN_GAP + 2) : 6,
        top: compact ? 10 : 14,
      }}
    >
      <BlueprintVisualPlayButton
        blueprint={blueprint}
        scenarioName={scenarioName}
        phaseName={phaseName}
      />
    </div>
  ) : null

  if (stackedColumns) {
    // Stacked arrangement: same fixed cell widths and gaps as the canonical
    // column tracks, so a flex row lines up with the parent grid exactly.
    // Columns this path lacks hold inert spacers (not `BlueprintEmptyCellSlot`
    // — that is an edit-mode drop target for steps the path actually has).
    const pathId = blueprint.path.id
    const stepById = new Map(blueprint.steps.map((step) => [step.id, step]))

    return (
      <div
        className={cn(
          'relative flex items-stretch rounded-sm',
          fillSwimlaneHeight ? 'h-full min-h-0 w-full' : 'shrink-0',
        )}
        style={{ backgroundColor: 'transparent' }}
      >
        {playButton}
        {stackedColumns.map((column, columnIndex) => {
          const stepId = column.stepIdByPath[pathId]
          const step = stepId !== undefined ? stepById.get(stepId) : undefined
          const stepIndex =
            stepId !== undefined ? stepIndexById.get(stepId) : undefined

          return (
            <Fragment key={column.key}>
              {step !== undefined && stepIndex !== undefined ? (
                renderStepCell(step, stepIndex)
              ) : (
                <div
                  aria-hidden
                  data-compare-column-spacer=""
                  className="shrink-0"
                  style={{
                    width: STEP_COLUMN_WIDTH,
                    minWidth: STEP_COLUMN_WIDTH,
                  }}
                />
              )}
              {columnIndex < stackedColumns.length - 1 && (
                <div
                  aria-hidden
                  className="shrink-0"
                  style={{ width: STEP_COLUMN_GAP, minWidth: STEP_COLUMN_GAP }}
                  {...(stepIndex !== undefined &&
                  stepIndex < blueprint.steps.length - 1
                    ? { 'data-step-gap': stepIndex }
                    : {})}
                />
              )}
            </Fragment>
          )
        })}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative flex items-stretch rounded-sm',
        fillSwimlaneHeight ? 'h-full min-h-0 w-full' : 'shrink-0',
      )}
      style={{
        backgroundColor: 'transparent',
        paddingLeft: playGutter || undefined,
      }}
    >
      {playButton}
      {blueprint.steps.map((step, stepIndex) => (
        <Fragment key={`${layer.id}-${step.id}`}>
          {renderStepCell(step, stepIndex)}
          {stepIndex < blueprint.steps.length - 1 && (
            <div
              aria-hidden
              className="shrink-0"
              style={{ width: STEP_COLUMN_GAP, minWidth: STEP_COLUMN_GAP }}
              data-step-gap={stepIndex}
            />
          )}
        </Fragment>
      ))}
    </div>
  )
}

function hasCellContent(
  content: string | undefined,
  variant: 'default' | 'pills' | 'visual',
): boolean {
  if (variant === 'visual') return true
  if (!content?.trim()) return false
  if (variant === 'pills') {
    return parseCellContentItems(content).length > 0
  }
  return true
}

function CompareCellBlock({
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
}: {
  cellId?: string
  stepIndex: number
  content?: string
  laneStyle: BlueprintLayerStyle
  variant: 'default' | 'pills' | 'visual'
  compact?: boolean
  flushBottom?: boolean
  selectionContext?: BlueprintCellSelectionContext
  visualPictures?: Array<{ picture: string; label: string }>
  /** Every cell in a tech slot — one per touchpoint since the split. */
  slotCells?: BlueprintCell[]
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
      {innerContent}
    </div>
  )
}

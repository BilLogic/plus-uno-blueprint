import { Fragment, useMemo, useRef, type RefObject } from 'react'
import { BlueprintCellButton } from '@/components/blueprint/BlueprintCellButton'
import { BlueprintStepVisual } from '@/components/blueprint/BlueprintStepVisual'
import { BlueprintTechPill } from '@/components/blueprint/BlueprintTechPill'
import { TechPillFace } from '@/components/blueprint/TechPillFace'
import {
  BlueprintDividerRow,
  BlueprintLabelRow,
  BlueprintStickyLabelBackdrop,
  BlueprintSwimLaneDivider,
} from '@/components/blueprint/BlueprintLabelRail'
import { IntegratedPathSectionFrame } from '@/components/blueprint/IntegratedPathSectionFrame'
import { IntegratedTriggerArrows } from '@/components/blueprint/IntegratedTriggerArrows'
import { PathLabelBadge } from '@/components/blueprint/PathLabelBadge'
import {
  formatPathPickerLabel,
  PathToolbarButton,
} from '@/components/blueprint/PathMultiSelect'
import { useCollapsedBlueprintLayers } from '@/hooks/useCollapsedBlueprintLayers'
import { itemsInSelectionOrder } from '@/lib/pathSelection'
import {
  BLUEPRINT_DISCOVERY_RAIL_CORRIDOR_MARGIN,
  BLUEPRINT_LAYER_ROW_GAP,
  BLUEPRINT_WRAP_CORRIDOR_MARGIN,
  STEP_COLUMN_GAP,
  STEP_COLUMN_WIDTH,
  getCellContentMinHeight,
  layerPrecedesBlueprintDivider,
  shouldUsePillCellContent,
  shouldUseVisualContent,
} from '@/lib/blueprintLayout'
import { ARROW_VIEWPORT_PAD } from '@/lib/blueprintArrowGeometry'
import { parseCellContentItems } from '@/lib/parseCellContent'
import {
  buildIntegratedLabelRowSpecs,
  COMPARE_CARD_GAP,
  COMPARE_LABEL_WIDTH,
  COMPARE_PANEL_PADDING,
  COMPARE_PANEL_PADDING_RIGHT,
  COMPARE_PATH_SECTION_TOP_INSET,
  getCompareRowTrackCss,
  getIntegratedContentCardWidth,
  getIntegratedGridBodyHeight,
  getIntegratedGridMinWidth,
  type BlueprintLabelRowSpec,
} from '@/lib/sideBySideCompareLayout'
import {
  BLUEPRINT_THEME,
  getBlueprintLayerStyle,
  getBlueprintLayerZone,
  type BlueprintLayerStyle,
} from '@/lib/blueprintTheme'
import type { BlueprintData } from '@/types/blueprint'
import { cn } from '@/lib/utils'
import {
  buildBlueprintCellSelection,
  getTechPillItems,
  type BlueprintCellSelectionContext,
} from '@/lib/blueprintCellSelection'
import type { PathType } from '@/types/database'
import type { IntegratedBlueprintCell, IntegratedBlueprintData } from '@/types/integratedBlueprint'
import type { BlueprintLayer, BlueprintStep } from '@/types/blueprint'

type IntegratedBlueprintGridProps = {
  data: IntegratedBlueprintData
  className?: string
  compact?: boolean
  fitVertically?: boolean
  /** When true, omits the outer scroll shell (parent panel owns scrolling). */
  embedded?: boolean
  scrollContainerRef?: RefObject<HTMLDivElement | null>
  selectedPathIds?: string[]
  onTogglePath?: (pathId: string) => void
  scenarioName?: string
  walkthroughBlueprints?: BlueprintData[]
}

function getCellsAt(
  cells: IntegratedBlueprintCell[],
  layerId: string,
  stepId: string,
): IntegratedBlueprintCell[] {
  return cells.filter(
    (cell) => cell.layer_id === layerId && cell.step_id === stepId,
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

export function IntegratedBlueprintGrid({
  data,
  className,
  compact = false,
  fitVertically = false,
  embedded = false,
  scrollContainerRef: scrollContainerRefProp,
  selectedPathIds = [],
  onTogglePath,
  scenarioName,
  walkthroughBlueprints = [],
}: IntegratedBlueprintGridProps) {
  const { layers, steps, cells, triggers, paths } = data
  const pathNameById = useMemo(
    () => new Map(paths.map((path) => [path.id, path.name])),
    [paths],
  )
  const gridBodyRef = useRef<HTMLDivElement>(null)
  const contentColumnRef = useRef<HTMLDivElement>(null)
  const fallbackScrollRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = scrollContainerRefProp ?? fallbackScrollRef
  const { collapsedLayerIds, toggleLayer } = useCollapsedBlueprintLayers()

  const activePaths = useMemo(
    () =>
      itemsInSelectionOrder(selectedPathIds, (id) =>
        paths.find((path) => path.id === id),
      ),
    [selectedPathIds, paths],
  )

  if (steps.length === 0 && layers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No integrated blueprint data yet.
      </p>
    )
  }

  const rows = useMemo(
    () =>
      buildIntegratedLabelRowSpecs(
        layers,
        data,
        compact,
        collapsedLayerIds,
        { fitVertically },
      ),
    [layers, data, compact, collapsedLayerIds, fitVertically],
  )

  const rowTrackSizes = useMemo(
    () => rows.map((row) => getCompareRowTrackCss(row)).join(' '),
    [rows],
  )

  const contentCardWidth = getIntegratedContentCardWidth(steps.length, compact)
  const gridMinWidth = getIntegratedGridMinWidth(steps.length, compact)
  const gridBodyMinHeight = useMemo(
    () =>
      getIntegratedGridBodyHeight(
        layers,
        data,
        compact,
        collapsedLayerIds,
        { fitVertically },
      ),
    [layers, data, compact, collapsedLayerIds, fitVertically],
  )

  const scrollMinHeight = gridBodyMinHeight + ARROW_VIEWPORT_PAD * 2

  const pathsLegend = (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-1',
        embedded ? 'mb-0' : compact ? 'mb-2' : 'mb-4 gap-x-5',
      )}
    >
      <span
        className={cn(
          'font-semibold text-foreground',
          compact ? 'text-xs' : 'text-sm',
        )}
      >
        Integrated paths
      </span>
      {paths.map((path) =>
        onTogglePath ? (
          <PathToolbarButton
            key={path.id}
            path={path}
            checked={selectedPathIds.includes(path.id)}
            onToggle={onTogglePath}
          />
        ) : (
          <PathLabelBadge
            key={path.id}
            name={formatPathPickerLabel(path.name)}
            description={path.description}
            pathType={path.path_type}
            compact={compact}
          />
        ),
      )}
    </div>
  )

  const gridBody = (
    <div
      className="w-max shrink-0"
      style={{
        paddingTop: COMPARE_PANEL_PADDING,
        paddingBottom: COMPARE_PANEL_PADDING,
        paddingLeft: COMPARE_PANEL_PADDING,
        paddingRight: COMPARE_PANEL_PADDING_RIGHT,
      }}
    >
      <div
        ref={gridBodyRef}
        className="relative grid w-max shrink-0 overflow-visible"
        style={{
          gridTemplateColumns: `${COMPARE_LABEL_WIDTH}px ${contentCardWidth}px`,
          gridTemplateRows: rowTrackSizes,
          columnGap: COMPARE_CARD_GAP,
          rowGap: BLUEPRINT_LAYER_ROW_GAP,
          paddingTop: COMPARE_PATH_SECTION_TOP_INSET,
          paddingBottom: COMPARE_PATH_SECTION_TOP_INSET,
        }}
      >
        <BlueprintStickyLabelBackdrop rowCount={rows.length} />
        {rows.map((row, rowIndex) =>
          row.kind === 'interaction' ||
          row.kind === 'visibility' ||
          row.kind === 'internalInteraction' ? (
            <BlueprintDividerRow
              key={row.key}
              rowIndex={rowIndex}
              label={row.label}
              lineStyle={row.kind === 'interaction' ? 'dashed' : 'solid'}
            />
          ) : (
            <Fragment key={`label-${row.key}`}>
              <BlueprintLabelRow
                row={row}
                layers={layers}
                compact={compact}
                onToggleLayer={toggleLayer}
                walkthroughBlueprints={walkthroughBlueprints}
                style={{ gridColumn: 1, gridRow: rowIndex + 1 }}
              />
              {row.showDividerBelow ? (
                <BlueprintSwimLaneDivider rowIndex={rowIndex} />
              ) : null}
            </Fragment>
          ),
        )}
        <div
          ref={contentColumnRef}
          className="relative z-0 grid overflow-visible"
          style={{
            gridColumn: 2,
            gridRow: `1 / ${rows.length + 1}`,
            gridTemplateRows: 'subgrid',
          }}
        >
          <IntegratedPathSectionFrame paths={activePaths} compact={compact} />
          <IntegratedTriggerArrows
            layer="forward"
            triggers={triggers}
            cells={cells}
            steps={steps}
            contentRef={contentColumnRef}
            scrollContainerRef={scrollContainerRef}
          />
          {rows.map((row, rowIndex) => (
            <IntegratedContentRow
              key={row.key}
              row={row}
              rowIndex={rowIndex}
              steps={steps}
              cells={cells}
              layers={layers}
              compact={compact}
              fitVertically={fitVertically}
              scenarioName={scenarioName}
              pathNameById={pathNameById}
            />
          ))}
          <IntegratedTriggerArrows
            layer="wrap"
            triggers={triggers}
            cells={cells}
            steps={steps}
            contentRef={contentColumnRef}
            scrollContainerRef={scrollContainerRef}
          />
        </div>
      </div>
    </div>
  )

  if (embedded) {
    return (
      <div className={cn('w-max shrink-0', className)}>
        {gridBody}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col',
        fitVertically && 'h-full min-h-0',
        className,
      )}
    >
      {pathsLegend}
      <div
        ref={scrollContainerRef}
        className={cn(
          'rounded-lg blueprint-scroll',
          fitVertically
            ? 'min-h-0 flex-1 overflow-auto'
            : 'shrink-0 overflow-x-auto',
          compact && 'rounded-md',
        )}
        style={{
          ...(fitVertically ? {} : { minHeight: scrollMinHeight }),
          backgroundColor: BLUEPRINT_THEME.labelRail,
        }}
      >
        <div
          className={fitVertically ? 'min-h-full' : undefined}
          style={{
            minWidth: gridMinWidth,
            padding: ARROW_VIEWPORT_PAD,
          }}
        >
          {gridBody}
        </div>
      </div>
    </div>
  )
}

function IntegratedContentRow({
  row,
  rowIndex,
  steps,
  cells,
  layers,
  compact,
  fitVertically,
  scenarioName,
  pathNameById,
}: {
  row: BlueprintLabelRowSpec
  rowIndex: number
  steps: BlueprintStep[]
  cells: IntegratedBlueprintCell[]
  layers: BlueprintLayer[]
  compact?: boolean
  fitVertically?: boolean
  scenarioName?: string
  pathNameById: Map<string, string>
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

  return (
    <div
      {...(isLayerRow && row.layer
        ? {
            'data-blueprint-swimlane': '',
            'data-blueprint-row': '',
            'data-layer-id': row.layer.id,
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
          isDivider ? 'flex h-full items-center overflow-hidden' : 'flex-1',
        )}
      >
        {row.kind === 'layer' && row.layer ? (
          row.collapsed ? (
            <div className="h-full" aria-hidden />
          ) : (
            <IntegratedLayerContent
              layer={row.layer}
              layers={layers}
              steps={steps}
              cells={cells}
              compact={compact}
              fitVertically={fitVertically}
              scenarioName={scenarioName}
              pathNameById={pathNameById}
            />
          )
        ) : isDivider ? (
          <div className="h-full" aria-hidden />
        ) : null}
      </div>
      {corridorBelow > 0 && (
        <div aria-hidden className="shrink-0" style={{ height: corridorBelow }} />
      )}
    </div>
  )
}

function IntegratedLayerContent({
  layer,
  layers,
  steps,
  cells,
  compact,
  fitVertically,
  scenarioName,
  pathNameById,
}: {
  layer: BlueprintLayer
  layers: BlueprintLayer[]
  steps: BlueprintStep[]
  cells: IntegratedBlueprintCell[]
  compact?: boolean
  fitVertically?: boolean
  scenarioName?: string
  pathNameById: Map<string, string>
}) {
  const isPillLayer = shouldUsePillCellContent(layer.name)
  const laneStyle = getBlueprintLayerStyle(
    layer.name,
    getBlueprintLayerZone(layer, layers),
  )
  const flushBottom = layerPrecedesBlueprintDivider(layer, layers)

  return (
    <div
      className="flex h-full min-h-0 w-full shrink-0 items-stretch rounded-sm"
      style={{ backgroundColor: 'transparent' }}
    >
      {steps.map((step, stepIndex) => {
        const slotCells = getCellsAt(cells, layer.id, step.id)
        const isVisualLayer = shouldUseVisualContent(layer.name)
        const variant = isVisualLayer ? 'visual' : isPillLayer ? 'pills' : 'default'
        const showCell =
          isVisualLayer ||
          slotCells.some((cell) => hasCellContent(cell.content, variant))

        return (
          <Fragment key={`${layer.id}-${step.id}`}>
            {showCell ? (
              isVisualLayer ? (
                <IntegratedVisualCell
                  layer={layer}
                  step={step}
                  stepIndex={stepIndex}
                  slotCells={slotCells}
                  laneStyle={laneStyle}
                  compact={compact}
                  fitVertically={fitVertically}
                  flushBottom={flushBottom}
                  scenarioName={scenarioName}
                  pathNameById={pathNameById}
                />
              ) : (
                <IntegratedCellSlot
                  layer={layer}
                  stepIndex={stepIndex}
                  stepName={step.name}
                  slotCells={slotCells}
                  laneStyle={laneStyle}
                  variant={isPillLayer ? 'pills' : 'default'}
                  width={STEP_COLUMN_WIDTH}
                  compact={compact}
                  fitVertically={fitVertically}
                  flushBottom={flushBottom}
                  scenarioName={scenarioName}
                  pathNameById={pathNameById}
                />
              )
            ) : (
              <div
                aria-hidden
                className="shrink-0 self-stretch"
                style={{
                  width: STEP_COLUMN_WIDTH,
                  minWidth: STEP_COLUMN_WIDTH,
                }}
              />
            )}
            {stepIndex < steps.length - 1 && (
              <div
                aria-hidden
                className="shrink-0"
                style={{
                  width: STEP_COLUMN_GAP,
                  minWidth: STEP_COLUMN_GAP,
                }}
                data-step-gap={stepIndex}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

function pickTallestIntegratedCell(
  layer: BlueprintLayer,
  cells: IntegratedBlueprintCell[],
  compact: boolean,
): IntegratedBlueprintCell {
  return cells.reduce((tallest, cell) =>
    getCellContentMinHeight(layer, cell.content, compact) >
    getCellContentMinHeight(layer, tallest.content, compact)
      ? cell
      : tallest,
  )
}

function IntegratedVisualCell({
  layer,
  step,
  stepIndex,
  slotCells,
  laneStyle,
  compact = false,
  fitVertically,
  flushBottom,
  scenarioName,
  pathNameById,
}: {
  layer: BlueprintLayer
  step: BlueprintStep
  stepIndex: number
  slotCells: IntegratedBlueprintCell[]
  laneStyle: BlueprintLayerStyle
  compact?: boolean
  fitVertically?: boolean
  flushBottom?: boolean
  scenarioName?: string
  pathNameById: Map<string, string>
}) {
  const shellPadding = cn(
    compact ? 'px-3' : 'px-3.5',
    compact ? 'pt-3' : 'pt-4',
    flushBottom ? 'pb-0' : compact ? 'pb-3' : 'pb-4',
  )
  const representative = slotCells[0]
  const selectionContext: BlueprintCellSelectionContext | undefined =
    scenarioName
      ? {
          scenarioName,
          layerName: layer.name,
          stepId: step.id,
          stepName: step.name,
          stepIndex,
          cellId: representative?.id ?? `visual-${step.id}`,
          cellContent: '',
          pathId: representative?.path_id ?? 'visual',
          pathName:
            (representative
              ? pathNameById.get(representative.path_id)
              : undefined) ?? 'Warm-Up',
          pathType: (representative?.path_type ?? 'happy') as PathType,
        }
      : undefined

  const shellClassName = cn(
    'relative z-[1] flex shrink-0 items-stretch self-stretch min-w-0',
    shellPadding,
    fitVertically && 'h-full',
  )
  const shellStyle = {
    width: STEP_COLUMN_WIDTH,
    minWidth: STEP_COLUMN_WIDTH,
    maxWidth: STEP_COLUMN_WIDTH,
  }
  const visual = (
    <BlueprintStepVisual
      compact={compact}
      fill={laneStyle.lane}
      selection={
        selectionContext
          ? buildBlueprintCellSelection(selectionContext)
          : undefined
      }
      cellId={representative?.id ?? `visual-${step.id}`}
      stepIndex={stepIndex}
    />
  )

  return (
    <div className={shellClassName} style={shellStyle}>
      {visual}
    </div>
  )
}

function IntegratedCellSlot({
  layer,
  stepIndex,
  stepName,
  slotCells,
  laneStyle,
  variant,
  width,
  compact = false,
  fitVertically,
  flushBottom,
  scenarioName,
  pathNameById,
}: {
  layer: BlueprintLayer
  stepIndex: number
  stepName: string
  slotCells: IntegratedBlueprintCell[]
  laneStyle: BlueprintLayerStyle
  variant: 'default' | 'pills'
  width: number
  compact?: boolean
  fitVertically?: boolean
  flushBottom?: boolean
  scenarioName?: string
  pathNameById: Map<string, string>
}) {
  const shellStyle = {
    width,
    minWidth: width,
    maxWidth: width,
  }

  const sortedCells = [...slotCells].sort(
    (a, b) => b.opacity - a.opacity,
  )
  const stacked = sortedCells.length > 1
  const sizingCell = stacked
    ? pickTallestIntegratedCell(layer, sortedCells, compact)
    : sortedCells[0]
  const overlayCells = stacked
    ? sortedCells.filter((cell) => cell.id !== sizingCell.id)
    : []

  return (
    <div
      className={cn(
        'relative flex min-w-0 shrink-0 items-stretch self-stretch',
        fitVertically && 'h-full',
      )}
      style={shellStyle}
    >
      <IntegratedCellBlock
        key={sizingCell.id}
        stepIndex={stepIndex}
        stepName={stepName}
        layerName={layer.name}
        cell={sizingCell}
        laneStyle={laneStyle}
        variant={variant}
        compact={compact}
        fitVertically={fitVertically}
        flushBottom={flushBottom}
        stacked={false}
        scenarioName={scenarioName}
        pathNameById={pathNameById}
      />
      {overlayCells.map((cell) => (
        <IntegratedCellBlock
          key={cell.id}
          stepIndex={stepIndex}
          stepName={stepName}
          layerName={layer.name}
          cell={cell}
          laneStyle={laneStyle}
          variant={variant}
          compact={compact}
          fitVertically={fitVertically}
          flushBottom={flushBottom}
          stacked
          scenarioName={scenarioName}
          pathNameById={pathNameById}
        />
      ))}
    </div>
  )
}

function IntegratedCellBlock({
  stepIndex,
  stepName,
  layerName,
  cell,
  laneStyle,
  variant,
  compact,
  fitVertically,
  flushBottom,
  stacked,
  scenarioName,
  pathNameById,
}: {
  stepIndex: number
  stepName: string
  layerName: string
  cell: IntegratedBlueprintCell
  laneStyle: BlueprintLayerStyle
  variant: 'default' | 'pills'
  compact?: boolean
  fitVertically?: boolean
  flushBottom?: boolean
  stacked?: boolean
  scenarioName?: string
  pathNameById: Map<string, string>
}) {
  const shellPadding = cn(
    compact ? 'px-3' : 'px-3.5',
    compact ? 'pt-3' : 'pt-4',
    flushBottom ? 'pb-0' : compact ? 'pb-3' : 'pb-4',
  )
  const width = STEP_COLUMN_WIDTH
  const shellStyle = {
    width,
    minWidth: width,
    maxWidth: width,
  }
  const shellClass = cn(
    stacked
      ? 'absolute inset-0 flex min-h-0 min-w-0 items-stretch overflow-visible'
      : 'relative z-[1] flex shrink-0 items-stretch self-stretch min-w-0',
    shellPadding,
  )

  const selectionContext: BlueprintCellSelectionContext | undefined =
    scenarioName
      ? {
          scenarioName,
          layerName,
          stepId: cell.step_id,
          stepName,
          stepIndex,
          cellId: cell.id,
          cellContent: cell.content,
          pathId: cell.path_id,
          pathName: pathNameById.get(cell.path_id) ?? 'Unknown path',
          pathType: cell.path_type,
        }
      : undefined

  const stackedStyle = stacked
    ? { zIndex: cell.opacity >= 1 ? 2 : 1 }
    : undefined

  const innerContent =
    variant === 'pills' ? (
      <div
        data-blueprint-cell={cell.id}
        data-step-index={stepIndex}
        className={cn(
          'flex w-full min-w-0 flex-1 flex-col items-stretch',
          stacked && 'h-full min-h-0 overflow-y-auto blueprint-scroll',
          compact ? 'gap-2' : 'gap-2.5',
        )}
      >
        {getTechPillItems(cell.content).map((item, index) =>
          selectionContext ? (
            <BlueprintTechPill
              key={`${item}-${index}`}
              item={item}
              selectionContext={selectionContext}
              stepIndex={stepIndex}
              compact={compact}
            />
          ) : (
            <TechPillFace
              key={`${item}-${index}`}
              item={item}
              compact={compact}
              className="min-w-0 shrink-0 break-words"
            />
          ),
        )}
      </div>
    ) : (
      <BlueprintCellButton
        fill={laneStyle.lane}
        compact={compact}
        opacity={cell.opacity}
        selection={
          selectionContext
            ? buildBlueprintCellSelection(selectionContext)
            : undefined
        }
        cellId={cell.id}
        stepIndex={stepIndex}
        className={cn(
          'box-border min-w-0',
          stacked && 'h-full min-h-0',
          (fitVertically || stacked) &&
            'min-h-0 overflow-y-auto blueprint-scroll',
        )}
      >
        <p className="w-full min-w-0 break-words whitespace-pre-wrap">
          {cell.content}
        </p>
      </BlueprintCellButton>
    )

  return (
    <div
      className={shellClass}
      style={{ ...shellStyle, ...stackedStyle }}
    >
      {innerContent}
    </div>
  )
}


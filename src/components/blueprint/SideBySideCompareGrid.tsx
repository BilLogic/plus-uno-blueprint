import {
  createContext,
  Fragment,
  useContext,
  useMemo,
  useRef,
  type RefObject,
} from 'react'
import { BlueprintCellButton } from '@/components/blueprint/BlueprintCellButton'
import { getPathColor } from '@/lib/pathColorTheme'
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
import { useCollapsedBlueprintLayers } from '@/hooks/useCollapsedBlueprintLayers'
import {
  BLUEPRINT_LAYER_ROW_GAP,
  BLUEPRINT_DISCOVERY_RAIL_CORRIDOR_MARGIN,
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
  COMPARE_CARD_GAP,
  COMPARE_LABEL_WIDTH,
  getCompareBoardWrapperPadding,
  type BlueprintLabelRowSpec,
  buildSideBySideLabelRowSpecs,
  getCanonicalLayers,
  getCompareCardWidth,
  getComparePathArrowData,
  expandRowSpecsToSwimlaneBodyHeight,
  getCompareRowTrackCss,
  COMPARE_PATH_SECTION_TOP_INSET,
  COMPARE_PATH_SECTION_BOTTOM_INSET,
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
import type { BlueprintData, BlueprintCell } from '@/types/blueprint'
import type { CompareStatus } from '@/types/integratedBlueprint'

/** Left gutter on the white board so the play control clears Visual cells. */
const VISUAL_PLAY_GUTTER = 28


type SideBySideCompareGridProps = {
  blueprints: BlueprintData[]
  className?: string
  compact?: boolean
  scrollContainerRef?: RefObject<HTMLDivElement | null>
  scenarioName?: string
  phaseName?: string
  /** When set, scenario title sits on the gray panel edge; path frames show path type. */
  sectionTitleLabel?: string
  sectionTitleDescription?: string | null
  /** Shared swimlane board height for phase overview alignment. */
  fixedSwimlaneBodyHeight?: number
  fillSwimlaneHeight?: boolean
  /**
   * Compare highlight pass: a verdict per cell id. Shared cells dim,
   * only-in-one cells wear their path's ring, divergent cells add a ≠
   * badge. The layout does not move — this is paint, not structure.
   */
  compareStatusByCellId?: ReadonlyMap<string, CompareStatus>
}

/**
 * File-local channel for the highlight verdicts — the map would otherwise
 * thread through four components that have no other use for it.
 */
const CompareHighlightContext =
  createContext<ReadonlyMap<string, CompareStatus> | null>(null)

type CompareRowSpec = BlueprintLabelRowSpec

/**
 * Side-by-side comparison is a general primitive: it renders ANY set of
 * labeled blueprint variants (paths) as columns — "designed vs. reality" is
 * just one possible labeling, not an assumption. Column order follows the
 * caller's `blueprints` array (path-selection activation order upstream; see
 * `itemsInSelectionOrder`), and each column is labeled with its own path's
 * `name` and `description` (`PathLabelBadge`) with `path_type` driving only
 * the frame styling. No path ids, path names, or fixed variant pairs are
 * hardcoded here or in `sideBySideCompareLayout.ts`.
 */
export function SideBySideCompareGrid({
  blueprints,
  className,
  compact = false,
  scrollContainerRef: scrollContainerRefProp,
  scenarioName,
  phaseName,
  sectionTitleLabel,
  sectionTitleDescription,
  fixedSwimlaneBodyHeight,
  fillSwimlaneHeight = false,
  compareStatusByCellId,
}: SideBySideCompareGridProps) {
  const { collapsedLayerIds, toggleLayer } = useCollapsedBlueprintLayers()
  const layers = useMemo(() => getCanonicalLayers(blueprints), [blueprints])

  const rows = useMemo(() => {
    const specs = buildSideBySideLabelRowSpecs(
      blueprints,
      compact,
      collapsedLayerIds,
    )

    if (fixedSwimlaneBodyHeight !== undefined) {
      return expandRowSpecsToSwimlaneBodyHeight(specs, fixedSwimlaneBodyHeight)
    }

    return specs
  }, [blueprints, collapsedLayerIds, compact, fixedSwimlaneBodyHeight])

  const bodyRowTrackSizes = useMemo(
    () =>
      rows
        .map((row) =>
          getCompareRowTrackCss(row),
        )
        .join(' '),
    [rows],
  )

  const gridTemplateColumns = useMemo(
    () =>
      `${COMPARE_LABEL_WIDTH}px ${blueprints
        .map(
          (blueprint) =>
            `${getCompareCardWidth(blueprint.steps.length, compact)}px`,
        )
        .join(' ')}`,
    [blueprints, compact],
  )

  const showPathTypeBadge = Boolean(sectionTitleLabel)

  if (blueprints.length === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Select at least one path to compare.
      </p>
    )
  }

  return (
    <CompareHighlightContext.Provider value={compareStatusByCellId ?? null}>
    <div
      className={cn('w-max shrink-0', className)}
      style={getCompareBoardWrapperPadding()}
    >
      <div
        className="relative grid w-max"
        style={{
          gridTemplateColumns,
          gridTemplateRows: bodyRowTrackSizes,
          columnGap: COMPARE_CARD_GAP,
          rowGap: BLUEPRINT_LAYER_ROW_GAP,
          paddingTop: COMPARE_PATH_SECTION_TOP_INSET,
          paddingBottom: COMPARE_PATH_SECTION_BOTTOM_INSET,
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
                lineStyle={
                  row.kind === 'interaction'
                    ? 'dashed'
                    : row.kind === 'internalInteraction'
                      ? 'dotted'
                      : 'solid'
                }
              />
            ) : (
              <Fragment key={`label-${row.key}`}>
                <BlueprintLabelRow
                  row={row}
                  layers={layers}
                  compact={compact}
                  onToggleLayer={toggleLayer}
                  style={{ gridColumn: 1, gridRow: rowIndex + 1 }}
                />
                {row.showDividerBelow ? (
                  <BlueprintSwimLaneDivider rowIndex={rowIndex} />
                ) : null}
              </Fragment>
            ),
          )}
          {blueprints.map((blueprint, columnIndex) => (
            <ComparePathColumn
              key={blueprint.path.id}
              blueprint={blueprint}
              layers={layers}
              rows={rows}
              columnIndex={columnIndex + 2}
              compact={compact}
              scrollContainerRef={scrollContainerRefProp}
              scenarioName={scenarioName}
              phaseName={phaseName}
              sectionTitleLabel={sectionTitleLabel}
              sectionTitleDescription={sectionTitleDescription}
              showPathTypeBadge={showPathTypeBadge}
              fillSwimlaneHeight={fillSwimlaneHeight}
            />
          ))}
      </div>
    </div>
    </CompareHighlightContext.Provider>
  )
}

function ComparePathColumn({
  blueprint,
  layers,
  rows,
  columnIndex,
  compact,
  scrollContainerRef,
  scenarioName,
  phaseName,
  showPathTypeBadge = false,
  fillSwimlaneHeight = false,
}: {
  blueprint: BlueprintData
  layers: BlueprintData['layers']
  rows: CompareRowSpec[]
  columnIndex: number
  compact?: boolean
  scrollContainerRef?: RefObject<HTMLDivElement | null>
  scenarioName?: string
  phaseName?: string
  sectionTitleLabel?: string
  sectionTitleDescription?: string | null
  showPathTypeBadge?: boolean
  fillSwimlaneHeight?: boolean
}) {
  const columnRef = useRef<HTMLDivElement>(null)
  const fallbackScrollRef = useRef<HTMLDivElement>(null)
  const resolvedScrollRef = scrollContainerRef ?? fallbackScrollRef
  const arrowData = useMemo(
    () => getComparePathArrowData(blueprint),
    [blueprint],
  )
  const showPlay =
    isBlueprintVisualWalkthroughEnabled() &&
    buildVisualWalkthroughSession(blueprint).steps.length > 0
  const playGutter = showPlay ? VISUAL_PLAY_GUTTER : 0

  return (
    <div
      ref={columnRef}
      className="relative z-0 grid overflow-visible"
      style={{
        gridColumn: columnIndex,
        gridRow: `1 / ${rows.length + 1}`,
        gridTemplateRows: 'subgrid',
      }}
    >
      <BlueprintColumnHandles
        steps={blueprint.steps}
        bodyRef={columnRef}
        pathId={blueprint.path.id}
      />
      {/* Lanes are scenario-wide, so one set of handles is enough — the
          first path column carries them (the grid reserves columns 1–2 for
          the label rail), the rest would only double the targets. */}
      {columnIndex === 2 ? <BlueprintLaneHandles bodyRef={columnRef} /> : null}
      <ComparePathSectionFrame
        blueprint={blueprint}
        compact={compact}
        showPathTypeBadge={showPathTypeBadge}
      />
      <IntegratedTriggerArrows
        layer="forward"
        triggers={arrowData.triggers}
        cells={arrowData.cells}
        steps={arrowData.steps}
        paths={[blueprint.path]}
        contentRef={columnRef}
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
        />
      ))}
      <IntegratedTriggerArrows
        layer="wrap"
        triggers={arrowData.triggers}
        cells={arrowData.cells}
        steps={arrowData.steps}
        paths={[blueprint.path]}
        contentRef={columnRef}
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
}: {
  row: CompareRowSpec
  rowIndex: number
  blueprint: BlueprintData
  layers: BlueprintData['layers']
  compact?: boolean
  scenarioName?: string
  phaseName?: string
  fillSwimlaneHeight?: boolean
  playGutter?: number
  showPlay?: boolean
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
}) {
  const blueprintLayer = useMemo(
    () => resolveBlueprintLayer(layer, blueprint),
    [blueprint, layer],
  )
  const cellLookup = useMemo(
    () => buildCellLookup(blueprint.cells),
    [blueprint.cells],
  )
  const isPillLayer = shouldUsePillCellContent(layer)
  const laneStyle = getBlueprintLayerStyle(
    layer.name,
    getBlueprintLayerZone(layer, layers),
    layer.role,
  )
  const flushBottom = layerPrecedesBlueprintDivider(layer, layers)
  const isVisualLayer = shouldUseVisualContent(layer)
  const renderPlay = showPlay && isVisualLayer && playGutter > 0

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
      {renderPlay ? (
        <div
          className="pointer-events-auto absolute z-50"
          style={{
            left: 6,
            top: compact ? 10 : 14,
          }}
        >
          <BlueprintVisualPlayButton
            blueprint={blueprint}
            scenarioName={scenarioName}
            phaseName={phaseName}
          />
        </div>
      ) : null}
      {blueprint.steps.map((step, stepIndex) => {
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

        return (
          <Fragment key={`${layer.id}-${step.id}`}>
            {showCell ? (
              <CompareCellBlock
                cellId={
                  cell?.id ??
                  (isVisualLayer ? `visual-${step.id}` : undefined)
                }
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
            ) : (
              // Empty in Edit mode is not nothing: it is where a cell can go.
              // Outside Edit it stays the inert spacer it has always been.
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
            )}
            {stepIndex < blueprint.steps.length - 1 && (
              <div
                aria-hidden
                className="shrink-0"
                style={{ width: STEP_COLUMN_GAP, minWidth: STEP_COLUMN_GAP }}
                data-step-gap={stepIndex}
              />
            )}
          </Fragment>
        )
      })}
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
  const highlight = useContext(CompareHighlightContext)
  /*
    The highlight pass. Verdicts paint, never move: shared cells recede to
    context, a cell only one path has wears that path's color as a ring,
    and a divergent counterpart adds the ≠ badge. Visual-lane cells are
    synthetic (no real id) and stay out of it.
  */
  const compareStatus =
    highlight && cellId && variant !== 'visual'
      ? (highlight.get(cellId) ?? null)
      : null
  const pathAccent =
    compareStatus && selectionContext
      ? getPathColor({
          path_type: selectionContext.pathType,
          name: selectionContext.pathName,
        })
      : null

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
    compareStatus === 'shared' &&
      'opacity-40 saturate-[.6] transition-[opacity,filter]',
  )
  const compareRing =
    compareStatus === 'only' || compareStatus === 'divergent'
      ? {
          outline: `2px solid ${pathAccent ?? 'var(--primary)'}`,
          outlineOffset: -2,
          borderRadius: 12,
        }
      : undefined

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
    <div className={shellClassName} style={{ ...shellStyle, ...compareRing }}>
      {compareStatus === 'divergent' ? (
        <span
          aria-hidden
          title="Differs from its counterpart in the other path"
          className="absolute -top-2 -right-2 z-10 grid size-5 place-items-center rounded-full text-2xs font-semibold text-white shadow-sm"
          style={{ backgroundColor: pathAccent ?? 'var(--primary)' }}
        >
          ≠
        </span>
      ) : null}
      {innerContent}
    </div>
  )
}

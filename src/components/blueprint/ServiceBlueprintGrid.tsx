import { Fragment, useMemo, useRef } from 'react'
import { BlueprintCellButton } from '@/components/blueprint/BlueprintCellButton'
import { BlueprintStepVisual } from '@/components/blueprint/BlueprintStepVisual'
import { BlueprintTechPill } from '@/components/blueprint/BlueprintTechPill'
import { TechPillFace } from '@/components/blueprint/TechPillFace'
import {
  BlueprintDividerRow,
} from '@/components/blueprint/BlueprintLabelRail'
import { BlueprintTriggerArrows } from '@/components/blueprint/BlueprintTriggerArrows'
import {
  ComparePathSectionFrame,
  SERVICE_PATH_SECTION_INSET,
} from '@/components/blueprint/ComparePathSectionFrame'
import {
  COMPARE_PATH_SECTION_BOTTOM_INSET,
  COMPARE_PATH_SECTION_TOP_INSET,
} from '@/lib/sideBySideCompareLayout'
import { PathLabelBadge } from '@/components/blueprint/PathLabelBadge'
import { BlueprintVisualPlayButton } from '@/components/blueprint/BlueprintVisualPlayButton'
import { LayerCollapseToggle } from '@/components/blueprint/LayerCollapseToggle'
import { useCollapsedBlueprintLayers } from '@/hooks/useCollapsedBlueprintLayers'
import {
  BLUEPRINT_DISCOVERY_RAIL_CORRIDOR_MARGIN,
  BLUEPRINT_WRAP_CORRIDOR_MARGIN,
  BLUEPRINT_ROW_MIN_HEIGHT,
  INTERACTION_LINE_LABEL,
  INTERNAL_INTERACTION_LINE_LABEL,
  LAYER_COLUMN_WIDTH,
  STEP_COLUMN_GAP,
  STEP_COLUMN_WIDTH,
  getStepColumnsWidth,
  VISIBILITY_LINE_LABEL,
  getBlueprintGridMinHeight,
  getBlueprintGridMinWidth,
  getLayerRowMinHeight,
  layerHasDiscoveryRailCorridor,
  layerPrecedesBlueprintDivider,
  shouldShowInteractionLineAfter,
  shouldShowInternalInteractionLineAfter,
  shouldShowLaneDividerAfter,
  shouldShowVisibilityLineAfter,
  shouldUsePillCellContent,
  shouldUseVisualContent,
} from '@/lib/blueprintLayout'
import { ARROW_VIEWPORT_PAD } from '@/lib/blueprintArrowGeometry'
import { buildCellLookup, getCellAt } from '@/lib/normalizeBlueprint'
import { parseCellContentItems } from '@/lib/parseCellContent'
import {
  BLUEPRINT_THEME,
  blueprintPanelCanvasColor,
  blueprintPanelDividerBgColor,
  blueprintPanelLabelRailColor,
  getBlueprintLayerStyle,
  getBlueprintLayerZone,
  type BlueprintLayerStyle,
} from '@/lib/blueprintTheme'
import {
  BLUEPRINT_LAYER_COLLAPSE_ENABLED,
  BLUEPRINT_LAYER_COLLAPSED_HEIGHT,
} from '@/lib/blueprintLayerCollapse'
import { cn } from '@/lib/utils'
import {
  buildBlueprintCellSelection,
  getTechPillItems,
  type BlueprintCellSelectionContext,
} from '@/lib/blueprintCellSelection'
import type { BlueprintData } from '@/types/blueprint'

type ServiceBlueprintGridProps = {
  data: BlueprintData
  className?: string
  compact?: boolean
  fitVertically?: boolean
  scenarioName?: string
  walkthroughBlueprints?: BlueprintData[]
  /** When set, scenario title sits on the gray panel; path frame shows path type. */
  headerTitleLabel?: string
  headerTitleDescription?: string | null
  showPathTypeBadge?: boolean
  fixedSwimlaneBodyHeight?: number
  fillSwimlaneHeight?: boolean
}

export function ServiceBlueprintGrid({
  data,
  className,
  compact = false,
  fitVertically = false,
  scenarioName,
  walkthroughBlueprints,
  headerTitleLabel,
  showPathTypeBadge = false,
  fixedSwimlaneBodyHeight,
  fillSwimlaneHeight = false,
}: ServiceBlueprintGridProps) {
  const { path, layers, steps, triggers } = data
  const gridBodyRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { toggleLayer, isLayerCollapsed } = useCollapsedBlueprintLayers()
  const cellLookup = useMemo(() => buildCellLookup(data.cells), [data.cells])

  if (steps.length === 0 && layers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This path has no layers or steps yet.
      </p>
    )
  }

  const gridMinWidth = getBlueprintGridMinWidth(steps.length)
  const naturalGridBodyMinHeight = useMemo(
    () =>
      getBlueprintGridMinHeight(data, {
        compact,
        includeHeader: false,
      }),
    [data, compact],
  )

  const gridBodyMinHeight = useMemo(() => {
    if (fixedSwimlaneBodyHeight === undefined) return naturalGridBodyMinHeight

    const compareInset =
      COMPARE_PATH_SECTION_TOP_INSET + COMPARE_PATH_SECTION_BOTTOM_INSET
    const serviceInset = SERVICE_PATH_SECTION_INSET * 2
    return fixedSwimlaneBodyHeight - compareInset + serviceInset
  }, [fixedSwimlaneBodyHeight, naturalGridBodyMinHeight])

  const scrollMinHeight =
    gridBodyMinHeight + ARROW_VIEWPORT_PAD * 2

  return (
    <div
      className={cn(
        'flex flex-col',
        fitVertically && 'h-full min-h-0',
        className,
      )}
    >
      {!compact && !headerTitleLabel && (
        <div
          className="mb-4 flex shrink-0 flex-wrap items-center gap-2 border-b pb-3"
          style={{ borderColor: BLUEPRINT_THEME.canvasBorder }}
        >
          <PathLabelBadge
            name={path.name}
            description={path.description}
            pathType={path.path_type}
            className="text-base"
          />
        </div>
      )}

      {compact && !headerTitleLabel && (
        <div className="mb-2 flex shrink-0 items-center gap-2 px-1">
          <PathLabelBadge
            name={path.name}
            description={path.description}
            pathType={path.path_type}
            compact
          />
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className={cn(
          'rounded-lg blueprint-scroll blueprint-panel-surface',
          fitVertically
            ? 'min-h-0 flex-1 overflow-auto'
            : 'shrink-0 overflow-x-auto',
          compact && 'rounded-md',
        )}
        style={{
          backgroundColor: blueprintPanelCanvasColor(),
          border: `1px solid ${BLUEPRINT_THEME.canvasBorder}`,
          ...(fitVertically ? {} : { minHeight: scrollMinHeight }),
        }}
      >
        <div
          className={fitVertically ? 'min-h-full' : undefined}
          style={{
            minWidth: gridMinWidth,
            padding: ARROW_VIEWPORT_PAD,
          }}
        >
          <div
            ref={gridBodyRef}
            className="blueprint-panel-surface relative flex shrink-0 flex-col gap-0 overflow-visible"
            style={{
              minHeight: gridBodyMinHeight,
              backgroundColor: blueprintPanelCanvasColor(),
            }}
          >
            <ComparePathSectionFrame
              blueprint={data}
              compact={compact}
              showTitle={showPathTypeBadge}
              showPathTypeBadge={showPathTypeBadge}
              variant="service"
            />
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-[1]"
              style={{
                left: LAYER_COLUMN_WIDTH,
                width: 1,
                backgroundColor: BLUEPRINT_THEME.laneDivider,
              }}
              aria-hidden
            />
            <BlueprintTriggerArrows
              layer="forward"
              triggers={triggers}
              contentRef={gridBodyRef}
              scrollContainerRef={scrollContainerRef}
              pathType={path.path_type}
            />
            {layers.map((layer, layerIndex) => {
              const collapsed = isLayerCollapsed(layer.id)
              const isPillLayer = shouldUsePillCellContent(layer.name)
              const rowMinHeight = collapsed
                ? BLUEPRINT_LAYER_COLLAPSED_HEIGHT
                : getLayerRowMinHeight(layer, data, compact, {
                    fitVertically: fillSwimlaneHeight,
                  })
              const zone = getBlueprintLayerZone(layer, layers)
              const laneStyle = getBlueprintLayerStyle(layer.name, zone)
              const showLaneDivider = shouldShowLaneDividerAfter(
                layer,
                layerIndex,
                layers,
              )

              const flushBottom = layerPrecedesBlueprintDivider(layer, layers)
              const showDiscoveryCorridorAbove =
                !collapsed && layerHasDiscoveryRailCorridor(layer, data)
              const showInteractionDivider =
                !collapsed && shouldShowInteractionLineAfter(layer)

              return (
                <Fragment key={layer.id}>
                  <div className="flex shrink-0 flex-col">
                    {showDiscoveryCorridorAbove && (
                      <div
                        aria-hidden
                        className="shrink-0"
                        style={{
                          height: BLUEPRINT_DISCOVERY_RAIL_CORRIDOR_MARGIN,
                        }}
                      />
                    )}
                    <BlueprintSwimLane
                      layerId={layer.id}
                      layerName={layer.name}
                      laneStyle={laneStyle}
                      rowMinHeight={rowMinHeight}
                      isPillLayer={isPillLayer}
                      compact={compact}
                      steps={steps}
                      cellLookup={cellLookup}
                      fitVertically={fillSwimlaneHeight || fitVertically}
                      showDividerBelow={showLaneDivider}
                      collapsed={collapsed}
                      flushBottom={flushBottom}
                      onToggleCollapse={() => toggleLayer(layer.id)}
                      blueprint={data}
                      scenarioName={scenarioName}
                      walkthroughBlueprints={walkthroughBlueprints}
                    />
                    {showInteractionDivider && (
                      <div
                        aria-hidden
                        className="shrink-0"
                        style={{ height: BLUEPRINT_WRAP_CORRIDOR_MARGIN }}
                      />
                    )}
                  </div>

                  {showInteractionDivider && (
                    <BlueprintDividerRow
                      label={INTERACTION_LINE_LABEL}
                      lineStyle="dashed"
                      compact={compact}
                      labelWidth={LAYER_COLUMN_WIDTH}
                      labelRailBg={blueprintPanelLabelRailColor(
                        BLUEPRINT_THEME.dividerBg,
                      )}
                      className="relative flex w-full shrink-0"
                      style={{
                        minWidth:
                          LAYER_COLUMN_WIDTH + getStepColumnsWidth(steps.length),
                        backgroundColor: blueprintPanelDividerBgColor(),
                      }}
                    />
                  )}

                  {!collapsed && shouldShowVisibilityLineAfter(layer, layers) && (
                    <BlueprintDividerRow
                      label={VISIBILITY_LINE_LABEL}
                      lineStyle="solid"
                      compact={compact}
                      labelWidth={LAYER_COLUMN_WIDTH}
                      labelRailBg={blueprintPanelLabelRailColor(
                        BLUEPRINT_THEME.dividerBg,
                      )}
                      className="relative flex w-full shrink-0"
                      style={{
                        minWidth:
                          LAYER_COLUMN_WIDTH + getStepColumnsWidth(steps.length),
                        backgroundColor: blueprintPanelDividerBgColor(),
                      }}
                    />
                  )}

                  {!collapsed && shouldShowInternalInteractionLineAfter(layer) && (
                    <BlueprintDividerRow
                      label={INTERNAL_INTERACTION_LINE_LABEL}
                      lineStyle="solid"
                      compact={compact}
                      labelWidth={LAYER_COLUMN_WIDTH}
                      labelRailBg={blueprintPanelLabelRailColor(
                        BLUEPRINT_THEME.dividerBg,
                      )}
                      className="relative flex w-full shrink-0"
                      style={{
                        minWidth:
                          LAYER_COLUMN_WIDTH + getStepColumnsWidth(steps.length),
                        backgroundColor: blueprintPanelDividerBgColor(),
                      }}
                    />
                  )}
                </Fragment>
              )
            })}
            <BlueprintTriggerArrows
              layer="wrap"
              triggers={triggers}
              contentRef={gridBodyRef}
              scrollContainerRef={scrollContainerRef}
              pathType={path.path_type}
            />
          </div>

          {layers.length === 0 && steps.length > 0 && (
            <p className="p-6 text-sm text-muted-foreground">No layers defined.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function BlueprintSwimLane({
  layerId,
  layerName,
  laneStyle,
  rowMinHeight,
  isPillLayer,
  compact,
  steps,
  cellLookup,
  fitVertically,
  showDividerBelow,
  collapsed = false,
  flushBottom,
  onToggleCollapse,
  blueprint,
  scenarioName,
  walkthroughBlueprints,
}: {
  layerId: string
  layerName: string
  laneStyle: BlueprintLayerStyle
  rowMinHeight: number
  isPillLayer: boolean
  compact?: boolean
  steps: BlueprintData['steps']
  cellLookup: ReturnType<typeof buildCellLookup>
  fitVertically?: boolean
  showDividerBelow?: boolean
  collapsed?: boolean
  flushBottom?: boolean
  onToggleCollapse?: () => void
  blueprint: BlueprintData
  scenarioName?: string
  walkthroughBlueprints?: BlueprintData[]
}) {
  const isVisualLayer = shouldUseVisualContent(layerName)

  return (
    <div
      data-blueprint-swimlane=""
      data-blueprint-row=""
      data-layer-id={layerId}
      className={cn(
        'blueprint-panel-surface flex shrink-0 overflow-visible rounded-sm',
        showDividerBelow && 'border-b',
      )}
      style={{
        minHeight: rowMinHeight,
        backgroundColor: blueprintPanelCanvasColor(),
        ...(showDividerBelow
          ? { borderColor: BLUEPRINT_THEME.laneDivider }
          : undefined),
      }}
    >
      <div
        className={cn(
          'blueprint-panel-surface blueprint-panel-label-surface sticky left-0 z-10 flex shrink-0 items-start gap-2 border-r self-start',
          compact ? 'px-3.5 pt-4 pb-4' : 'pt-5 pb-5 pl-5 pr-3',
        )}
        style={{
          width: LAYER_COLUMN_WIDTH,
          minWidth: LAYER_COLUMN_WIDTH,
          maxWidth: LAYER_COLUMN_WIDTH,
          backgroundColor: blueprintPanelLabelRailColor(BLUEPRINT_THEME.canvas),
          borderColor: BLUEPRINT_THEME.laneDivider,
        }}
      >
        {isVisualLayer ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <BlueprintVisualPlayButton
              blueprint={blueprint}
              blueprints={walkthroughBlueprints}
            />
            <span
              className={cn(
                'min-w-0 flex-1 text-left font-bold leading-snug tracking-tight whitespace-normal break-words',
                compact ? 'text-xs' : 'text-sm',
              )}
              style={{ color: laneStyle.label }}
            >
              {layerName}
            </span>
          </div>
        ) : (
          <span
            className={cn(
              'min-w-0 flex-1 text-left font-bold leading-snug tracking-tight whitespace-normal break-words',
              compact ? 'text-xs' : 'text-sm',
            )}
            style={{ color: laneStyle.label }}
          >
            {layerName}
          </span>
        )}
        {BLUEPRINT_LAYER_COLLAPSE_ENABLED && onToggleCollapse && (
          <LayerCollapseToggle
            layerName={layerName}
            collapsed={collapsed}
            onToggle={onToggleCollapse}
            className="size-6 shrink-0"
          />
        )}
      </div>

      {!collapsed &&
        steps.map((step, stepIndex) => {
        const cell = getCellAt(cellLookup, layerId, step.id)
        const isVisualLayer = shouldUseVisualContent(layerName)
        const variant = isVisualLayer ? 'visual' : isPillLayer ? 'pills' : 'default'
        const showCell =
          isVisualLayer || hasCellContent(cell?.content, variant)

        return (
          <Fragment key={`${layerId}-${step.id}`}>
            {showCell ? (
              <BlueprintCellBlock
                stepIndex={stepIndex}
                cellId={
                  cell?.id ??
                  (isVisualLayer ? `visual-${step.id}` : undefined)
                }
                content={cell?.content}
                laneStyle={laneStyle}
                variant={variant}
                width={STEP_COLUMN_WIDTH}
                compact={compact}
                fitVertically={fitVertically}
                rowMinHeight={rowMinHeight}
                flushBottom={flushBottom}
                selectionContext={
                  scenarioName && (cell?.id || isVisualLayer)
                    ? {
                        scenarioName,
                        layerName,
                        stepId: step.id,
                        stepName: step.name,
                        stepIndex,
                        cellId: cell?.id ?? `visual-${step.id}`,
                        cellContent: cell?.content ?? '',
                        pathId: blueprint.path.id,
                        pathName: blueprint.path.name,
                        pathType: blueprint.path.path_type,
                      }
                    : undefined
                }
              />
            ) : (
              <div
                aria-hidden
                className="shrink-0"
                style={{
                  width: STEP_COLUMN_WIDTH,
                  minWidth: STEP_COLUMN_WIDTH,
                  maxWidth: STEP_COLUMN_WIDTH,
                  minHeight: rowMinHeight,
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

function BlueprintCellBlock({
  stepIndex,
  cellId,
  content,
  laneStyle,
  variant = 'default',
  width,
  compact,
  fitVertically,
  rowMinHeight,
  flushBottom,
  selectionContext,
}: {
  stepIndex: number
  cellId?: string
  content?: string
  laneStyle: BlueprintLayerStyle
  variant?: 'default' | 'pills' | 'visual'
  width: number
  compact?: boolean
  fitVertically?: boolean
  rowMinHeight?: number
  flushBottom?: boolean
  selectionContext?: BlueprintCellSelectionContext
}) {
  const shellPadding = cn(
    compact ? 'px-3' : 'px-3.5',
    compact ? 'pt-3' : 'pt-4',
    flushBottom ? 'pb-0' : compact ? 'pb-3' : 'pb-4',
  )
  const pillItems =
    variant === 'pills' && content ? getTechPillItems(content) : []

  const shellStyle = {
    width,
    minWidth: width,
    maxWidth: width,
    minHeight: fitVertically
      ? variant === 'pills'
        ? rowMinHeight
        : 0
      : BLUEPRINT_ROW_MIN_HEIGHT,
  }

  const shellClassName = cn(
    'relative z-[1] flex shrink-0 items-stretch',
    shellPadding,
    fitVertically && (variant === 'pills' ? 'h-full' : 'h-full min-h-0'),
  )

  const innerContent =
    variant === 'visual' ? (
      <BlueprintStepVisual
        compact={compact}
        fill={laneStyle.lane}
        selection={
          selectionContext
            ? buildBlueprintCellSelection(selectionContext)
            : undefined
        }
        cellId={cellId}
        stepIndex={stepIndex}
      />
    ) : variant === 'pills' ? (
      <div
        {...(cellId ? { 'data-blueprint-cell': cellId } : {})}
        data-step-index={stepIndex}
        className={cn(
          'flex w-full flex-1 flex-col items-stretch justify-start',
          compact ? 'gap-2' : 'gap-2.5',
          !fitVertically && 'min-h-[80px] justify-center',
        )}
      >
        {pillItems.map((item, index) =>
          selectionContext ? (
            <BlueprintTechPill
              key={`${item}-${index}`}
              item={item}
              selectionContext={selectionContext}
              stepIndex={stepIndex}
              compact={compact}
            />
          ) : (
            <TechPillFace key={`${item}-${index}`} item={item} compact={compact} />
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
        className={cn(
          fitVertically && 'min-h-0 overflow-y-auto blueprint-scroll',
        )}
      >
        <p className="m-auto w-full whitespace-pre-wrap">{content}</p>
      </BlueprintCellButton>
    )

  return (
    <div className={shellClassName} style={shellStyle}>
      {innerContent}
    </div>
  )
}

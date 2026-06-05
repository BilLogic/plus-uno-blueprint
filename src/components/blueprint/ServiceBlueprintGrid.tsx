import { Fragment, useMemo, useRef } from 'react'
import { BlueprintTriggerArrows } from '@/components/blueprint/BlueprintTriggerArrows'
import { PathTypeColorKey } from '@/components/blueprint/PathTypeColorKey'
import {
  BLUEPRINT_DIVIDER_ROW_HEIGHT,
  BLUEPRINT_WRAP_CORRIDOR_MARGIN,
  BLUEPRINT_ROW_MIN_HEIGHT,
  INTERACTION_LINE_LABEL,
  LAYER_COLUMN_WIDTH,
  STEP_COLUMN_GAP,
  STEP_COLUMN_WIDTH,
  getStepColumnsWidth,
  VISIBILITY_LINE_LABEL,
  getBlueprintGridMinHeight,
  getBlueprintGridMinWidth,
  getLayerRowMinHeight,
  shouldShowInteractionLineAfter,
  shouldShowLaneDividerAfter,
  shouldShowVisibilityLineAfter,
  shouldUsePillCellContent,
} from '@/lib/blueprintLayout'
import { ARROW_VIEWPORT_PAD } from '@/lib/blueprintArrowGeometry'
import { buildCellLookup, getCellAt } from '@/lib/normalizeBlueprint'
import { parseCellContentItems } from '@/lib/parseCellContent'
import {
  BLUEPRINT_THEME,
  getBlueprintLayerStyle,
  getBlueprintLayerZone,
  type BlueprintLayerStyle,
} from '@/lib/blueprintTheme'
import { cn } from '@/lib/utils'
import type { BlueprintData } from '@/types/blueprint'

type ServiceBlueprintGridProps = {
  data: BlueprintData
  className?: string
  compact?: boolean
  fitVertically?: boolean
}

export function ServiceBlueprintGrid({
  data,
  className,
  compact = false,
  fitVertically = false,
}: ServiceBlueprintGridProps) {
  const { path, layers, steps, triggers } = data
  const gridBodyRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const cellLookup = useMemo(() => buildCellLookup(data.cells), [data.cells])

  if (steps.length === 0 && layers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This path has no layers or steps yet.
      </p>
    )
  }

  const gridMinWidth = getBlueprintGridMinWidth(steps.length)
  const gridBodyMinHeight = useMemo(
    () =>
      getBlueprintGridMinHeight(data, {
        compact,
        includeHeader: false,
      }),
    [data, compact],
  )

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
      {!compact && (
        <div
          className="mb-4 flex shrink-0 flex-wrap items-center gap-2 border-b pb-3"
          style={{ borderColor: BLUEPRINT_THEME.canvasBorder }}
        >
          <PathTypeColorKey type={path.path_type} size="md" />
          <h2
            className="text-lg font-semibold tracking-tight"
            style={{ color: BLUEPRINT_THEME.headerText }}
          >
            {path.name}
          </h2>
        </div>
      )}

      {compact && (
        <div className="mb-2 flex shrink-0 items-center gap-2 px-1">
          <PathTypeColorKey type={path.path_type} />
          <span
            className="text-xs font-semibold"
            style={{ color: BLUEPRINT_THEME.headerText }}
          >
            {path.name}
          </span>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className={cn(
          'rounded-lg',
          fitVertically
            ? 'min-h-0 flex-1 overflow-auto'
            : 'shrink-0 overflow-x-auto',
          compact && 'rounded-md',
        )}
        style={{
          backgroundColor: BLUEPRINT_THEME.canvas,
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
            className="relative flex shrink-0 flex-col gap-1 overflow-visible"
            style={{
              minHeight: gridBodyMinHeight,
              backgroundColor: BLUEPRINT_THEME.canvas,
            }}
          >
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
              const isPillLayer = shouldUsePillCellContent(layer.name)
              const rowMinHeight = getLayerRowMinHeight(layer, data, compact, {
                fitVertically,
              })
              const zone = getBlueprintLayerZone(layer, layers)
              const laneStyle = getBlueprintLayerStyle(layer.name, zone)
              const showLaneDivider = shouldShowLaneDividerAfter(
                layer,
                layerIndex,
                layers,
              )

              return (
                <Fragment key={layer.id}>
                  <BlueprintSwimLane
                    layerId={layer.id}
                    layerName={layer.name}
                    laneStyle={laneStyle}
                    rowMinHeight={rowMinHeight}
                    isPillLayer={isPillLayer}
                    compact={compact}
                    steps={steps}
                    cellLookup={cellLookup}
                    fitVertically={fitVertically}
                    showDividerBelow={showLaneDivider}
                  />

                  {shouldShowInteractionLineAfter(layer) && (
                    <BlueprintDividerRow
                      label={INTERACTION_LINE_LABEL}
                      lineStyle="dashed"
                      stepCount={steps.length}
                      compact={compact}
                      wrapCorridor
                    />
                  )}

                  {shouldShowVisibilityLineAfter(layer) && (
                    <BlueprintDividerRow
                      label={VISIBILITY_LINE_LABEL}
                      lineStyle="solid"
                      stepCount={steps.length}
                      compact={compact}
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
}) {
  return (
    <div
      data-blueprint-swimlane=""
      data-blueprint-row=""
      data-layer-id={layerId}
      className={cn(
        'flex shrink-0 overflow-hidden rounded-sm',
        showDividerBelow && 'border-b',
      )}
      style={{
        minHeight: rowMinHeight,
        backgroundColor: BLUEPRINT_THEME.canvas,
        ...(showDividerBelow
          ? { borderColor: BLUEPRINT_THEME.laneDivider }
          : undefined),
      }}
    >
      <div
        className={cn(
          'sticky left-0 z-10 flex shrink-0 flex-col justify-center',
          compact ? 'px-3.5 py-4' : 'px-4 py-5',
          isPillLayer && 'justify-start pt-4',
        )}
        style={{
          width: LAYER_COLUMN_WIDTH,
          minWidth: LAYER_COLUMN_WIDTH,
          maxWidth: LAYER_COLUMN_WIDTH,
          backgroundColor: BLUEPRINT_THEME.canvas,
        }}
      >
        <span
          className={cn(
            'font-semibold leading-snug',
            compact ? 'text-[11px]' : 'text-xs',
          )}
          style={{ color: laneStyle.label }}
        >
          {layerName}
        </span>
      </div>

      {steps.map((step, stepIndex) => {
        const cell = getCellAt(cellLookup, layerId, step.id)
        const variant = isPillLayer ? 'pills' : 'default'
        const showCell = hasCellContent(cell?.content, variant)

        return (
          <Fragment key={`${layerId}-${step.id}`}>
            {showCell ? (
              <BlueprintCellBlock
                stepIndex={stepIndex}
                cellId={cell?.id}
                content={cell?.content}
                laneStyle={laneStyle}
                variant={variant}
                width={STEP_COLUMN_WIDTH}
                compact={compact}
                fitVertically={fitVertically}
                rowMinHeight={rowMinHeight}
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

function BlueprintDividerRow({
  label,
  lineStyle,
  stepCount,
  compact,
  wrapCorridor,
}: {
  label: string
  lineStyle: 'dashed' | 'solid'
  stepCount: number
  compact?: boolean
  wrapCorridor?: boolean
}) {
  const rowMinWidth = LAYER_COLUMN_WIDTH + getStepColumnsWidth(stepCount)

  return (
    <div
      data-blueprint-divider={lineStyle === 'dashed' ? 'interaction' : 'visibility'}
      className="flex shrink-0 items-center pr-4"
      style={{
        height: BLUEPRINT_DIVIDER_ROW_HEIGHT,
        minWidth: rowMinWidth,
        backgroundColor: BLUEPRINT_THEME.dividerBg,
        ...(wrapCorridor
          ? { marginTop: BLUEPRINT_WRAP_CORRIDOR_MARGIN }
          : undefined),
      }}
      role="separator"
      aria-label={label}
    >
      <div
        className={cn(
          'sticky left-0 z-10 flex min-w-0 flex-1 items-center',
          compact ? 'pl-3.5' : 'pl-4',
        )}
      >
        <span
          className={cn(
            'shrink-0 font-medium uppercase leading-none tracking-[0.12em]',
            compact ? 'text-[9px]' : 'text-[10px]',
          )}
          style={{ color: BLUEPRINT_THEME.dividerLabel }}
        >
          {label}
        </span>
        <div
          className={cn(
            'h-px min-w-0 flex-1 border-t',
            lineStyle === 'dashed' ? 'border-dashed' : 'border-solid',
          )}
          style={{ borderColor: BLUEPRINT_THEME.divider }}
          aria-hidden
        />
      </div>
    </div>
  )
}

function hasCellContent(
  content: string | undefined,
  variant: 'default' | 'pills',
): boolean {
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
}: {
  stepIndex: number
  cellId?: string
  content?: string
  laneStyle: BlueprintLayerStyle
  variant?: 'default' | 'pills'
  width: number
  compact?: boolean
  fitVertically?: boolean
  rowMinHeight?: number
}) {
  const pillItems =
    variant === 'pills' && content
      ? parseCellContentItems(content)
      : []

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

  const cardClass = cn(
    'w-full flex-1 rounded-sm border leading-relaxed shadow-sm',
    compact ? 'px-3 py-2.5 text-[11px]' : 'px-4 py-3.5 text-sm',
  )

  const cardStyle = {
    color: laneStyle.label,
    backgroundColor: laneStyle.lane,
    borderColor: `${laneStyle.accent}66`,
    boxShadow: '0 1px 3px rgba(45, 42, 38, 0.06)',
  }

  if (variant === 'pills') {
    return (
      <div
        {...(cellId ? { 'data-blueprint-cell': cellId } : {})}
        data-step-index={stepIndex}
        className={cn(
          'relative z-[1] flex shrink-0 items-stretch',
          compact ? 'px-3 py-3' : 'px-3.5 py-4',
          fitVertically && 'h-full',
        )}
        style={shellStyle}
      >
        <div
          data-blueprint-cell-anchor=""
          className={cn(
            'flex w-full flex-1 flex-col items-stretch justify-start',
            compact ? 'gap-2' : 'gap-2.5',
            !fitVertically && 'min-h-[80px] justify-center',
          )}
        >
          {pillItems.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className={cn(
                'flex w-full items-center justify-center whitespace-normal rounded-sm border text-center font-normal leading-snug',
                compact ? 'px-2.5 py-2 text-[10px]' : 'px-3 py-2.5 text-xs',
              )}
              style={cardStyle}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      {...(cellId ? { 'data-blueprint-cell': cellId } : {})}
      data-step-index={stepIndex}
      className={cn(
        'relative z-[1] flex shrink-0 items-stretch',
        compact ? 'px-3 py-3' : 'px-3.5 py-4',
        fitVertically && 'h-full min-h-0',
      )}
      style={shellStyle}
    >
      <div
        data-blueprint-cell-anchor=""
        className={cn(
          cardClass,
          'flex',
          fitVertically ? 'min-h-0 overflow-y-auto' : 'min-h-[80px]',
        )}
        style={cardStyle}
      >
        <p className="m-auto w-full whitespace-pre-wrap font-normal">{content}</p>
      </div>
    </div>
  )
}

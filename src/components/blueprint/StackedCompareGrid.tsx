import { Fragment, useMemo, type RefObject } from 'react'
import {
  BlueprintPathBand,
  type StackedBandColumn,
} from '@/components/blueprint/BlueprintPathBand'
import { useCollapsedBlueprintLayers } from '@/hooks/useCollapsedBlueprintLayers'
import { STEP_COLUMN_GAP, STEP_COLUMN_WIDTH } from '@/lib/blueprintLayout'
import {
  COMPARE_LABEL_WIDTH,
  COMPARE_STACKED_BAND_GAP,
  COMPARE_STACKED_HEADER_GAP,
  COMPARE_STEP_HEADER_HEIGHT,
  buildSideBySideLabelRowSpecs,
  getCanonicalLayers,
  getCompareBoardWrapperPadding,
  getCompareRowTrackCss,
} from '@/lib/sideBySideCompareLayout'
import { cn } from '@/lib/utils'
import type { CompareModel } from '@/lib/compareSlots'
import type { BlueprintData } from '@/types/blueprint'

type StackedCompareGridProps = {
  blueprints: BlueprintData[]
  /**
   * The compare model owned by `ScenarioBlueprintPanel` (one `useMemo`,
   * gated on every selected blueprint being loaded). Null with a single
   * path — the band still stacks, there is just nothing to compare.
   */
  model: CompareModel | null
  className?: string
  compact?: boolean
  scrollContainerRef?: RefObject<HTMLDivElement | null>
  scenarioName?: string
  phaseName?: string
  /** When set, scenario title sits on the gray panel edge; path frames show path type. */
  sectionTitleLabel?: string
}

/**
 * The stacked ARRANGEMENT of `BlueprintPathBand` (focused scenario view):
 * every compared path renders as a full-width band, one below the other, on
 * ONE canonical step-column axis owned by this parent grid. Bands pick their
 * column tracks up via `gridTemplateColumns: subgrid`; columns a path lacks
 * hold inert spacers inside its band. Divergent columns (column verdict !==
 * 'shared') carry a light tint — the v3 diff signal is column-level, never
 * per-cell paint.
 *
 * No `position: sticky` in here: the grid lives inside the zoom-transformed
 * canvas, where sticky both misbehaves and has nothing to stick to.
 */
export function StackedCompareGrid({
  blueprints,
  model,
  className,
  compact = false,
  scrollContainerRef,
  scenarioName,
  phaseName,
  sectionTitleLabel,
}: StackedCompareGridProps) {
  const { collapsedLayerIds, toggleLayer } = useCollapsedBlueprintLayers()
  const layers = useMemo(() => getCanonicalLayers(blueprints), [blueprints])

  const rows = useMemo(
    () => buildSideBySideLabelRowSpecs(blueprints, compact, collapsedLayerIds),
    [blueprints, collapsedLayerIds, compact],
  )

  const rowTrackCss = useMemo(
    () => rows.map((row) => getCompareRowTrackCss(row)).join(' '),
    [rows],
  )

  const columns: StackedBandColumn[] = useMemo(() => {
    if (model) {
      return model.columns.map((column) => ({
        key: column.columnKey,
        label: column.label,
        stepIdByPath: column.stepIdByPath,
        divergent: column.verdict !== 'shared',
      }))
    }
    // No model: a single path, or a selection whose blueprints have not all
    // arrived (the panel keeps its skeleton through that while loading).
    // Each path's steps become their own columns, in band order.
    return blueprints.flatMap((blueprint) =>
      [...blueprint.steps]
        .sort((a, b) => a.column_position - b.column_position)
        .map((step) => ({
          key: `${blueprint.path.id}:${step.id}`,
          label: step.name,
          stepIdByPath: { [blueprint.path.id]: step.id },
          divergent: false,
        })),
    )
  }, [blueprints, model])

  const gridTemplateColumns = useMemo(
    () =>
      `${COMPARE_LABEL_WIDTH}px repeat(${Math.max(1, columns.length)}, ${STEP_COLUMN_WIDTH}px)`,
    [columns.length],
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
    <div
      className={cn('w-max shrink-0', className)}
      style={getCompareBoardWrapperPadding()}
    >
      <div
        className="relative grid w-max"
        style={{
          gridTemplateColumns,
          gridTemplateRows: `${COMPARE_STEP_HEADER_HEIGHT}px repeat(${blueprints.length}, auto)`,
          columnGap: STEP_COLUMN_GAP,
        }}
      >
        {columns.map((column, columnIndex) => (
          <div
            key={column.key}
            className="flex min-w-0 items-end justify-center overflow-hidden rounded-md px-2 pb-1.5"
            style={{ gridColumn: columnIndex + 2, gridRow: 1 }}
            {...(column.divergent
              ? { 'data-blueprint-compare-diffcolumn': 'header' }
              : {})}
          >
            <span
              className="truncate text-xs font-medium text-muted-foreground"
              title={column.label}
            >
              {column.label}
            </span>
          </div>
        ))}
        {blueprints.map((blueprint, bandIndex) => (
          <Fragment key={blueprint.path.id}>
            <BlueprintPathBand
              blueprint={blueprint}
              layers={layers}
              rows={rows}
              arrangement={{
                kind: 'row',
                gridRow: bandIndex + 2,
                columns,
                rowTrackCss,
                marginTop:
                  bandIndex === 0
                    ? COMPARE_STACKED_HEADER_GAP
                    : COMPARE_STACKED_BAND_GAP,
                onToggleLayer: toggleLayer,
              }}
              compact={compact}
              scrollContainerRef={scrollContainerRef}
              scenarioName={scenarioName}
              phaseName={phaseName}
              showPathTypeBadge={showPathTypeBadge}
            />
          </Fragment>
        ))}
      </div>
    </div>
  )
}

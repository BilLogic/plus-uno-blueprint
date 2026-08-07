import { Fragment, useMemo, type RefObject } from 'react'
import { Link2 } from 'lucide-react'
import {
  BlueprintPathBand,
  type StackedBandTrack,
} from '@/components/blueprint/BlueprintPathBand'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCollapsedBlueprintLayers } from '@/hooks/useCollapsedBlueprintLayers'
import { STEP_COLUMN_GAP, STEP_COLUMN_WIDTH } from '@/lib/blueprintLayout'
import {
  buildCompareDisplayTracks,
  compareFoldPleatTitle,
  computeFoldedColumnKeys,
  computeFoldedStepIdsByPath,
  EMPTY_COMPARE_FOLD_STATE,
} from '@/lib/compareFold'
import { expandComparePleat, useCompareReviewState } from '@/lib/compareReviewStore'
import {
  COMPARE_LABEL_WIDTH,
  COMPARE_PLEAT_TRACK_WIDTH,
  COMPARE_STACKED_BAND_GAP,
  COMPARE_STACKED_HEADER_GAP,
  COMPARE_STEP_HEADER_HEIGHT,
  buildSideBySideLabelRowSpecs,
  getCanonicalLayers,
  getCompareBoardWrapperPadding,
  getCompareRowTrackCss,
} from '@/lib/sideBySideCompareLayout'
import { cn } from '@/lib/utils'
import { computePinnedColumns, type CompareModel } from '@/lib/compareSlots'
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

const EMPTY_PINNED: ReadonlySet<string> = new Set()

/**
 * The stacked ARRANGEMENT of `BlueprintPathBand` (focused scenario view):
 * every compared path renders as a full-width band, one below the other, on
 * ONE canonical step-column axis owned by this parent grid. Bands pick their
 * column tracks up via `gridTemplateColumns: subgrid`; columns a path lacks
 * hold inert spacers inside its band. Divergent columns (column verdict !==
 * 'shared') carry a light tint — the v3 diff signal is column-level, never
 * per-cell paint.
 *
 * Fold (Phase 4a): when the shared fold state is on, each run of shared
 * columns — minus pinned columns and individually re-expanded pleats —
 * collapses to one fixed pleat track. The PARENT's `gridTemplateColumns`
 * changes (instantly, never animated) and the bands re-derive via subgrid.
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
  const { registration, fold } = useCompareReviewState()

  const rows = useMemo(
    () => buildSideBySideLabelRowSpecs(blueprints, compact, collapsedLayerIds),
    [blueprints, collapsedLayerIds, compact],
  )

  const rowTrackCss = useMemo(
    () => rows.map((row) => getCompareRowTrackCss(row)).join(' '),
    [rows],
  )

  // The store's fold state belongs to the registered comparison; object
  // identity ties it to THIS grid's model (the panel registers the same
  // model instance it passes down), so an overview grid rendering another
  // scenario never picks up the focused scenario's fold.
  const activeFold =
    model !== null && registration?.model === model
      ? fold
      : EMPTY_COMPARE_FOLD_STATE

  const pinnedColumns = useMemo(
    () => (model ? computePinnedColumns(model, blueprints) : EMPTY_PINNED),
    [blueprints, model],
  )

  const tracks: StackedBandTrack[] = useMemo(() => {
    if (model) {
      const columnByKey = new Map(
        model.columns.map((column) => [column.columnKey, column]),
      )
      return buildCompareDisplayTracks(model, pinnedColumns, activeFold).map(
        (track): StackedBandTrack => {
          if (track.kind === 'pleat') {
            return {
              kind: 'pleat',
              key: track.fragment.key,
              columnCount: track.fragment.columnKeys.length,
              title: compareFoldPleatTitle(track.fragment),
            }
          }
          const column = columnByKey.get(track.columnKey)
          return {
            kind: 'column',
            key: track.columnKey,
            label: column?.label ?? track.columnKey,
            stepIdByPath: column?.stepIdByPath ?? {},
            divergent: column ? column.verdict !== 'shared' : false,
            pinned: pinnedColumns.has(track.columnKey),
          }
        },
      )
    }
    // No model: a single path, or a selection whose blueprints have not all
    // arrived (the panel keeps its skeleton through that while loading).
    // Each path's steps become their own columns, in band order.
    return blueprints.flatMap((blueprint) =>
      [...blueprint.steps]
        .sort((a, b) => a.column_position - b.column_position)
        .map(
          (step): StackedBandTrack => ({
            kind: 'column',
            key: `${blueprint.path.id}:${step.id}`,
            label: step.name,
            stepIdByPath: { [blueprint.path.id]: step.id },
            divergent: false,
            pinned: false,
          }),
        ),
    )
  }, [activeFold, blueprints, model, pinnedColumns])

  /*
    Per-path step ids hidden inside collapsed pleats — the DATA-level input
    for each band's arrow filtering. Derived from the model + fold state,
    never the DOM. Null while nothing is folded so bands skip the pass.
  */
  const foldedStepIdsByPath = useMemo(() => {
    if (!model) return null
    const foldedColumns = computeFoldedColumnKeys(
      model,
      pinnedColumns,
      activeFold,
    )
    if (foldedColumns.size === 0) return null
    return computeFoldedStepIdsByPath(model, foldedColumns)
  }, [activeFold, model, pinnedColumns])

  /*
    Fold changes the PARENT's tracks; bands re-derive via subgrid. Never
    animated — a `gridTemplateColumns` transition would relayout the whole
    subgrid per frame and draw arrows against intermediate geometry.
  */
  const gridTemplateColumns = useMemo(() => {
    if (tracks.length === 0) {
      return `${COMPARE_LABEL_WIDTH}px ${STEP_COLUMN_WIDTH}px`
    }
    const trackWidths = tracks
      .map((track) =>
        track.kind === 'pleat'
          ? `${COMPARE_PLEAT_TRACK_WIDTH}px`
          : `${STEP_COLUMN_WIDTH}px`,
      )
      .join(' ')
    return `${COMPARE_LABEL_WIDTH}px ${trackWidths}`
  }, [tracks])

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
        {tracks.map((track, trackIndex) =>
          track.kind === 'pleat' ? null : (
            <div
              key={track.key}
              className="flex min-w-0 items-end justify-center gap-1 overflow-hidden rounded-md px-2 pb-1.5"
              style={{ gridColumn: trackIndex + 2, gridRow: 1 }}
              {...(track.divergent
                ? { 'data-blueprint-compare-diffcolumn': 'header' }
                : {})}
            >
              <span
                className="truncate text-xs font-medium text-muted-foreground"
                title={track.label}
              >
                {track.label}
              </span>
              {track.pinned && activeFold.folded ? (
                <Tooltip>
                  <TooltipTrigger
                    render={<span className="inline-flex shrink-0 pb-px" />}
                  >
                    <Link2
                      className="size-3 text-muted-foreground"
                      aria-label="Pinned column"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    kept expanded — feeds a divergent step
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          ),
        )}
        {blueprints.map((blueprint, bandIndex) => (
          <Fragment key={blueprint.path.id}>
            <BlueprintPathBand
              blueprint={blueprint}
              layers={layers}
              rows={rows}
              arrangement={{
                kind: 'row',
                gridRow: bandIndex + 2,
                tracks,
                rowTrackCss,
                marginTop:
                  bandIndex === 0
                    ? COMPARE_STACKED_HEADER_GAP
                    : COMPARE_STACKED_BAND_GAP,
                onToggleLayer: toggleLayer,
                onExpandPleat: expandComparePleat,
                foldedStepIds:
                  foldedStepIdsByPath?.get(blueprint.path.id) ?? undefined,
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

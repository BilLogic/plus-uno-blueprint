import { useMemo } from 'react'
import { useCollapsedBlueprintLayers } from '@/hooks/useCollapsedBlueprintLayers'
import { STEP_COLUMN_WIDTH } from '@/lib/blueprintLayout'
import {
  computeFoldedColumnKeys,
  computeFoldedStepIdsByPath,
  EMPTY_COMPARE_FOLD_STATE,
  type CompareFoldState,
} from '@/lib/compareFold'
import {
  buildCompareGridTracks,
  type CompareGridTrack,
} from '@/lib/compareGridTracks'
import { useCompareReviewState } from '@/lib/compareReviewStore'
import { computePinnedColumns, type CompareModel } from '@/lib/compareSlots'
import {
  COMPARE_LABEL_WIDTH,
  COMPARE_PLEAT_TRACK_WIDTH,
  buildSideBySideLabelRowSpecs,
  getCanonicalLayers,
  type BlueprintLabelRowSpec,
} from '@/lib/sideBySideCompareLayout'
import type { BlueprintData, BlueprintLayer } from '@/types/blueprint'

const EMPTY_PINNED: ReadonlySet<string> = new Set()

export type CompareGridAxis = {
  /** Canonical lanes across the compared paths. */
  layers: BlueprintLayer[]
  /** Lane row specs (one set — both canvases share the lane axis). */
  rows: BlueprintLabelRowSpec[]
  toggleLayer: (layerId: string) => void
  /** The fold state that belongs to THIS grid's model. */
  activeFold: CompareFoldState
  tracks: CompareGridTrack[]
  /** Per-path step ids hidden inside collapsed pleats; null when nothing is
   *  folded, so consumers skip the arrow-filtering pass entirely. */
  foldedStepIdsByPath: ReadonlyMap<string, ReadonlySet<string>> | null
  gridTemplateColumns: string
}

/**
 * The column + lane axis both compare canvases are drawn against — the
 * stacked bands and the merged grid. One derivation means fold, pleats, the
 * pin rule and the divergent-column tint behave identically in both modes
 * instead of drifting apart in two copies.
 *
 * Everything here is derived from the compare model + fold state, never the
 * DOM, so "is this column folded?" has exactly one answer everywhere.
 */
export function useCompareGridAxis(
  model: CompareModel | null,
  blueprints: BlueprintData[],
  compact = false,
): CompareGridAxis {
  const { collapsedLayerIds, toggleLayer } = useCollapsedBlueprintLayers()
  const { registration, fold } = useCompareReviewState()

  const layers = useMemo(() => getCanonicalLayers(blueprints), [blueprints])

  const rows = useMemo(
    () => buildSideBySideLabelRowSpecs(blueprints, compact, collapsedLayerIds),
    [blueprints, collapsedLayerIds, compact],
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

  const tracks = useMemo(
    () => buildCompareGridTracks(model, blueprints, pinnedColumns, activeFold),
    [activeFold, blueprints, model, pinnedColumns],
  )

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
    Fold changes the PARENT's tracks; the bands (or the merged band) re-derive
    via subgrid. Never animated — a `gridTemplateColumns` transition would
    relayout the whole subgrid per frame and draw arrows against intermediate
    geometry.
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

  return {
    layers,
    rows,
    toggleLayer,
    activeFold,
    tracks,
    foldedStepIdsByPath,
    gridTemplateColumns,
  }
}

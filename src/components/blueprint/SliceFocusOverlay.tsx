import { useMemo } from 'react'
import { ARROW_VIEWPORT_PAD } from '@/lib/blueprintArrowGeometry'
import {
  BLUEPRINT_DISCOVERY_RAIL_CORRIDOR_MARGIN,
  BLUEPRINT_DIVIDER_ROW_HEIGHT,
  BLUEPRINT_REGULAR_TUTOR_LOOP_CORRIDOR_MARGIN,
  BLUEPRINT_WRAP_CORRIDOR_MARGIN,
  VISUAL_PLAY_GUTTER,
  getLayerRowMinHeight,
  getStepColumnLeft,
  layerHasDiscoveryRailCorridor,
  layerHasRegularTutorInLaneLoopCorridor,
  layerHasWrapCorridorBelow,
  shouldShowInteractionLineAfter,
  shouldShowInternalInteractionLineAfter,
  shouldShowVisibilityLineAfter,
} from '@/lib/blueprintLayout'
import { isBlueprintVisualWalkthroughEnabled } from '@/lib/blueprintDisplayFlags'
import { buildVisualWalkthroughSession } from '@/lib/visualWalkthrough'
import type { SliceCellPlacement } from '@/lib/sliceCells'
import type { BlueprintData } from '@/types/blueprint'

const BADGE_SIZE = 24

type SliceFocusOverlayProps = {
  blueprint: BlueprintData
  placements: readonly SliceCellPlacement[]
  /** Scrim only while focused; badges persist when de-focused. */
  focused: boolean
  compact?: boolean
}

/**
 * Scrim + numbered badges over a ServiceBlueprintGrid, positioned with the
 * same arithmetic the grid uses (blueprintLayout row math + step columns).
 * Rendered inside the grid body via the grid's `focusOverlay` prop, so it
 * scrolls with the content. z-order: scrim (40) sits above the forward
 * (z-[2]) and wrap (z-[30]) arrow layers; badges and slice-member cells
 * (lifted via `data-slice-member` CSS) sit at 50.
 */
export function SliceFocusOverlay({
  blueprint,
  placements,
  focused,
  compact = false,
}: SliceFocusOverlayProps) {
  const layers = useMemo(
    () => [...blueprint.layers].sort((a, b) => a.row_position - b.row_position),
    [blueprint.layers],
  )

  // Mirror of the grid's vertical stacking: corridors above, row min-height
  // (with in-lane loop corridor), corridors below, then divider rows.
  const layerCellTops = useMemo(() => {
    const tops = new Map<string, number>()
    let top = 0
    for (const layer of layers) {
      if (layerHasDiscoveryRailCorridor(layer, blueprint)) {
        top += BLUEPRINT_DISCOVERY_RAIL_CORRIDOR_MARGIN
      }
      const loopCorridor = layerHasRegularTutorInLaneLoopCorridor(
        layer,
        blueprint,
      )
        ? BLUEPRINT_REGULAR_TUTOR_LOOP_CORRIDOR_MARGIN
        : 0
      tops.set(layer.id, top + loopCorridor)
      top += getLayerRowMinHeight(layer, blueprint, compact) + loopCorridor
      if (layerHasWrapCorridorBelow(layer, blueprint)) {
        top += BLUEPRINT_WRAP_CORRIDOR_MARGIN
      }
      if (shouldShowInteractionLineAfter(layer)) {
        top += BLUEPRINT_DIVIDER_ROW_HEIGHT
      }
      if (shouldShowVisibilityLineAfter(layer, layers)) {
        top += BLUEPRINT_DIVIDER_ROW_HEIGHT
      }
      if (shouldShowInternalInteractionLineAfter(layer, layers)) {
        top += BLUEPRINT_DIVIDER_ROW_HEIGHT
      }
    }
    return tops
  }, [blueprint, compact, layers])

  const playGutter = useMemo(() => {
    if (!isBlueprintVisualWalkthroughEnabled()) return 0
    return buildVisualWalkthroughSession(blueprint).steps.some(
      (step) => step.pictures.length > 0,
    )
      ? VISUAL_PLAY_GUTTER
      : 0
  }, [blueprint])

  const cellShellPadX = compact ? 12 : 14
  const cellShellPadTop = compact ? 12 : 16

  return (
    <>
      {focused && (
        <div
          aria-hidden
          data-slice-focus-scrim=""
          className="slice-focus-scrim pointer-events-none absolute z-40"
          style={{ inset: -ARROW_VIEWPORT_PAD }}
        />
      )}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-50">
        {placements.map((placement) => {
          const layerTop = layerCellTops.get(placement.layerId)
          if (layerTop === undefined) return null
          const left =
            getStepColumnLeft(placement.stepIndex) +
            playGutter +
            cellShellPadX -
            BADGE_SIZE / 2
          const top = layerTop + cellShellPadTop - BADGE_SIZE / 2
          return (
            <div
              key={`${placement.cellId}-${placement.order}`}
              className="absolute flex items-center justify-center rounded-full border-2 border-background bg-foreground text-xs font-bold text-background shadow-md"
              style={{ left, top, width: BADGE_SIZE, height: BADGE_SIZE }}
            >
              {placement.order}
            </div>
          )
        })}
      </div>
    </>
  )
}

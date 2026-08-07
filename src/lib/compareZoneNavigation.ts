import { resolveFocusCells, type FocusCellsResult } from '@/lib/canvasFocusCells'
import { computePleatsToExpandForCells } from '@/lib/compareFold'
import {
  compareStepFocusCellIds,
  type CompareStepGroup,
} from '@/lib/compareLedger'
import {
  expandComparePleat,
  getCompareReviewState,
  setCompareActiveStep,
} from '@/lib/compareReviewStore'
import { computePinnedColumns } from '@/lib/compareSlots'

/**
 * Monotonic generation for expand-then-fly: a newer focus request aborts
 * an older one that is still waiting out its post-expand layout settle —
 * ▶-spam while folded must never land stacked flights.
 */
let compareFocusGeneration = 0

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/**
 * THE compare focus gesture — every caller that flies to compare cells
 * (ledger rows, zone jumps, agent commands) goes through here so fold
 * auto-expand lives in exactly one place: a target hidden inside a
 * collapsed pleat expands its pleat FIRST, waits two rAFs for the new
 * grid tracks to settle (the codebase's layout-settle pattern), then
 * flies. Whether a cell is folded is answered by the model + fold state,
 * never the DOM. Null when no viewport serves the scenario.
 */
export async function focusCompareCells(
  cellIds: string[],
  slideId: string,
): Promise<FocusCellsResult | null> {
  const generation = ++compareFocusGeneration

  const state = getCompareReviewState()
  const registration = state.registration
  if (registration && registration.slideId === slideId && state.fold.folded) {
    const pleats = computePleatsToExpandForCells(
      registration.model,
      computePinnedColumns(registration.model, registration.blueprints),
      state.fold,
      cellIds,
    )
    if (pleats.length > 0) {
      for (const pleatKey of pleats) expandComparePleat(pleatKey)
      // Layout settle: the parent grid's tracks just changed; measuring the
      // targets before React commits + the browser lays out would fly to
      // stale geometry. Abort if a newer focus claimed the generation.
      await nextFrame()
      await nextFrame()
      if (generation !== compareFocusGeneration) return null
    }
  }

  const focusCells = resolveFocusCells(slideId)
  if (!focusCells) return null
  return focusCells(cellIds)
}

/**
 * The one step-activation gesture, shared by the ledger accordion, the
 * divergence strip's segments/stepper and the `jump_divergence` agent
 * command: mark the step active in the store (the ledger's open group and
 * the strip's highlighted segment both derive from it) and fly the camera to
 * that step's differing cells. Returns the camera outcome, or null when no
 * viewport serves the scenario.
 */
export function jumpToCompareStep(
  group: CompareStepGroup,
  slideId: string,
): Promise<FocusCellsResult | null> {
  setCompareActiveStep(group.columnKey)
  return focusCompareCells(compareStepFocusCellIds(group), slideId)
}

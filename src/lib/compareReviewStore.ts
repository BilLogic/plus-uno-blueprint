import type { BlueprintData } from '@/types/blueprint'
import type { CompareModel, CompareStatus } from '@/lib/compareSlots'

/**
 * Cross-surface state for the compare review cockpit (Compare v3, Phase 3).
 *
 * The compare model is computed once in `ScenarioBlueprintPanel` and its
 * consumers are scattered across React trees that share no provider: the
 * menubar `[≠ N]` chip, the portalled difference-ledger drawer, the
 * divergence strip on the canvas, and the agent's `get_ui_state`
 * contributor. Module-level store + `useSyncExternalStore` is the house
 * pattern for exactly this shape (see `CanvasModeProvider`,
 * `src/lib/agent/settings.ts`).
 */

export type CompareReviewRegistration = {
  /** Focused scenario's nav slide id — also the `focusCells` registry key. */
  slideId: string
  scenarioName: string
  phaseName?: string
  /** Client view token in effect ('stacked' | 'merged'). */
  viewMode: string
  model: CompareModel
  /** Selection-ordered blueprints the model was built from. */
  blueprints: readonly BlueprintData[]
}

export type CompareDifferencesFilters = {
  /** Normalized lane keys; empty = all lanes. */
  lanes: readonly string[]
  /** Verdicts to keep; empty = all. */
  verdicts: readonly CompareStatus[]
}

export type CompareReviewState = {
  registration: CompareReviewRegistration | null
  /** 1-based divergence-zone index shared by strip, ledger and agent. */
  activeZone: number | null
  filters: CompareDifferencesFilters
  /** Mirrored by the panel while the Differences surface is showing. */
  ledgerOpen: boolean
}

const EMPTY_FILTERS: CompareDifferencesFilters = { lanes: [], verdicts: [] }

let state: CompareReviewState = {
  registration: null,
  activeZone: null,
  filters: EMPTY_FILTERS,
  ledgerOpen: false,
}

const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeCompareReview(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getCompareReviewState(): CompareReviewState {
  return state
}

/**
 * Publish the focused scenario's compare context. Zone + filters reset when
 * the scenario changes — they are per-comparison state, not preferences.
 */
export function registerCompareReview(
  registration: CompareReviewRegistration,
): () => void {
  const scenarioChanged = state.registration?.slideId !== registration.slideId
  state = {
    ...state,
    registration,
    activeZone: scenarioChanged ? null : state.activeZone,
    filters: scenarioChanged ? EMPTY_FILTERS : state.filters,
  }
  emit()
  return () => {
    if (state.registration !== registration) return
    state = {
      ...state,
      registration: null,
      activeZone: null,
      filters: EMPTY_FILTERS,
    }
    emit()
  }
}

export function setCompareActiveZone(zone: number | null) {
  if (state.activeZone === zone) return
  state = { ...state, activeZone: zone }
  emit()
}

export function setCompareFilters(filters: CompareDifferencesFilters) {
  state = { ...state, filters }
  emit()
}

export function clearCompareFilters() {
  setCompareFilters(EMPTY_FILTERS)
}

export function setCompareLedgerOpen(open: boolean) {
  if (state.ledgerOpen === open) return
  state = { ...state, ledgerOpen: open }
  emit()
}

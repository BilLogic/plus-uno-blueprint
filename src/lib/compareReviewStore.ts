import { useSyncExternalStore } from 'react'
import type { BlueprintData } from '@/types/blueprint'
import {
  EMPTY_COMPARE_FOLD_STATE,
  type CompareFoldState,
} from '@/lib/compareFold'
import type { CompareModel, CompareStatus } from '@/lib/compareSlots'

/**
 * Cross-surface state for the compare review cockpit (Compare v3, Phase 3).
 *
 * The compare model is computed once in `ScenarioBlueprintPanel` and its
 * consumers are scattered across React trees that share no provider: the
 * menubar `[Diff N]` button, the portalled difference-ledger drawer, the
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
  /** Canonical columnKeys; empty = all steps. */
  steps: readonly string[]
}

export type CompareReviewState = {
  registration: CompareReviewRegistration | null
  /**
   * The active DIVERGENT STEP, as a canonical columnKey — the one navigation
   * cursor shared by the ledger's open accordion group, the strip's
   * highlighted segment (the run containing this step) and
   * `jump_divergence`. Finer than the old zone index: a run of six divergent
   * steps is six stops, not one.
   */
  activeStepKey: string | null
  filters: CompareDifferencesFilters
  /** Mirrored by the panel while the Differences surface is showing. */
  ledgerOpen: boolean
  /**
   * Fold (Phase 4a): per-scenario, session-only, MODE-AGNOSTIC — one
   * fold fact shared across Stacked/Merged switches (locked decision).
   */
  fold: CompareFoldState
}

const EMPTY_FILTERS: CompareDifferencesFilters = {
  lanes: [],
  verdicts: [],
  steps: [],
}

let state: CompareReviewState = {
  registration: null,
  activeStepKey: null,
  filters: EMPTY_FILTERS,
  ledgerOpen: false,
  fold: EMPTY_COMPARE_FOLD_STATE,
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

/** React subscription — the state object is replaced on every change. */
export function useCompareReviewState(): CompareReviewState {
  return useSyncExternalStore(subscribeCompareReview, getCompareReviewState)
}

/**
 * The last slideId that registered, surviving unregistration. "Scenario
 * changed" must be judged against this, not `state.registration`: a mode
 * switch (or blueprint refetch) re-registers the SAME scenario through an
 * effect cleanup that has already nulled the live registration, and
 * judging against the null would wrongly treat every re-register as a new
 * scenario — wiping the fold that is contracted to survive mode switches.
 */
let lastRegisteredSlideId: string | null = null

/**
 * Publish the focused scenario's compare context. The active step + filters
 * reset when the scenario changes — they are per-comparison state, not
 * preferences.
 */
export function registerCompareReview(
  registration: CompareReviewRegistration,
): () => void {
  const scenarioChanged = lastRegisteredSlideId !== registration.slideId
  lastRegisteredSlideId = registration.slideId
  state = {
    ...state,
    registration,
    activeStepKey: scenarioChanged ? null : state.activeStepKey,
    filters: scenarioChanged ? EMPTY_FILTERS : state.filters,
    // Fold survives mode switches (same slideId re-registers) but resets
    // with the scenario — it is per-comparison state, not a preference.
    fold: scenarioChanged ? EMPTY_COMPARE_FOLD_STATE : state.fold,
  }
  emit()
  return () => {
    if (state.registration !== registration) return
    // Fold deliberately survives here: this cleanup also runs mid-flight
    // during a same-scenario re-register (mode switch, refetch), and the
    // register above owns the reset decision via `scenarioChanged`.
    state = {
      ...state,
      registration: null,
      activeStepKey: null,
      filters: EMPTY_FILTERS,
    }
    emit()
  }
}

/** The one write path for the navigation cursor; null = nothing active. */
export function setCompareActiveStep(columnKey: string | null) {
  if (state.activeStepKey === columnKey) return
  state = { ...state, activeStepKey: columnKey }
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

/** Unfolding clears the per-pleat expansions — they only mean anything folded. */
export function setCompareFolded(folded: boolean) {
  if (state.fold.folded === folded) return
  state = {
    ...state,
    fold: folded
      ? { folded: true, expandedPleats: state.fold.expandedPleats }
      : EMPTY_COMPARE_FOLD_STATE,
  }
  emit()
}

/** Pleat click / focus auto-expand: open one pleat, keep the rest folded. */
export function expandComparePleat(pleatKey: string) {
  if (!state.fold.folded || state.fold.expandedPleats.has(pleatKey)) return
  const expandedPleats = new Set(state.fold.expandedPleats)
  expandedPleats.add(pleatKey)
  state = { ...state, fold: { folded: true, expandedPleats } }
  emit()
}

/** Agent `toggle_pleat`: re-collapse an expanded pleat or expand a folded one. */
export function toggleComparePleat(pleatKey: string) {
  if (!state.fold.folded) return
  const expandedPleats = new Set(state.fold.expandedPleats)
  if (!expandedPleats.delete(pleatKey)) expandedPleats.add(pleatKey)
  state = { ...state, fold: { folded: true, expandedPleats } }
  emit()
}

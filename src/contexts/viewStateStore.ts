import { createContext, useContext } from 'react'
import { parseUrlViewState, type UrlViewState } from '@/lib/urlViewState'

/**
 * Tab model for the editor shell — a pinned blueprint tab plus slice focus /
 * presentation tabs. Pure reducer + key helpers live here (unit-testable, no
 * React rendering); the provider that owns the reducer and URL sync is
 * `ViewStateContext.tsx`.
 */

export type TabDescriptor =
  | { kind: 'blueprint' }
  | { kind: 'slice'; sliceId: string }
  | { kind: 'present'; sliceId: string }

export type TabKey = 'blueprint' | `slice:${string}` | `present:${string}`

export const tabKey = (t: TabDescriptor): TabKey =>
  t.kind === 'blueprint' ? 'blueprint' : `${t.kind}:${t.sliceId}`

export type ViewStateAction =
  | { type: 'open'; tab: TabDescriptor }
  | { type: 'close'; key: TabKey }
  | { type: 'activate'; key: TabKey }
  | { type: 'closeForSlice'; sliceId: string }
  | { type: 'resolvePending'; availableSliceIds: readonly string[] }
  | { type: 'setLens'; lens: 'assumption' | null }

export type ViewState = {
  tabs: TabDescriptor[]
  activeKey: TabKey
  /** Parsed boot URL, held until the slice list loads (never applied blind). */
  pendingUrlState: UrlViewState | null
  /** Frame restored from a `?mode=present&frame=` deep link. */
  restoredFrame: { sliceId: string; frame: number } | null
  /** Active view lens (`?lens=assumption`) — rides the URL for sharing. */
  lens: 'assumption' | null
}

export const BLUEPRINT_TAB: TabDescriptor = { kind: 'blueprint' }

export function createInitialViewState(search: string): ViewState {
  const pendingUrlState = parseUrlViewState(search)
  return {
    tabs: [BLUEPRINT_TAB],
    activeKey: 'blueprint',
    pendingUrlState,
    restoredFrame: null,
    lens:
      pendingUrlState && pendingUrlState.kind !== 'present'
        ? (pendingUrlState.lens ?? null)
        : null,
  }
}

/** Close a set of tab keys; the pinned blueprint tab never closes. */
function closeKeys(state: ViewState, keysToClose: ReadonlySet<TabKey>): ViewState {
  const keys = new Set<TabKey>(
    [...keysToClose].filter((key) => key !== 'blueprint'),
  )
  if (keys.size === 0) return state

  const tabs = state.tabs.filter((tab) => !keys.has(tabKey(tab)))
  if (tabs.length === state.tabs.length) return state

  let activeKey = state.activeKey
  if (keys.has(state.activeKey)) {
    // Closing the active tab activates its nearest surviving left neighbor
    // (the blueprint tab at index 0 always survives).
    const activeIndex = state.tabs.findIndex((tab) => tabKey(tab) === state.activeKey)
    activeKey = 'blueprint'
    for (let index = activeIndex - 1; index >= 0; index -= 1) {
      const candidate = state.tabs[index]
      if (candidate && !keys.has(tabKey(candidate))) {
        activeKey = tabKey(candidate)
        break
      }
    }
  }

  return { ...state, tabs, activeKey }
}

export function viewStateReducer(state: ViewState, action: ViewStateAction): ViewState {
  switch (action.type) {
    case 'open': {
      const key = tabKey(action.tab)
      if (state.tabs.some((tab) => tabKey(tab) === key)) {
        return state.activeKey === key ? state : { ...state, activeKey: key }
      }
      return { ...state, tabs: [...state.tabs, action.tab], activeKey: key }
    }
    case 'close':
      return closeKeys(state, new Set([action.key]))
    case 'activate': {
      if (action.key === state.activeKey) return state
      if (!state.tabs.some((tab) => tabKey(tab) === action.key)) return state
      return { ...state, activeKey: action.key }
    }
    case 'closeForSlice':
      return closeKeys(
        state,
        new Set(
          state.tabs
            .filter((tab) => tab.kind !== 'blueprint' && tab.sliceId === action.sliceId)
            .map(tabKey),
        ),
      )
    case 'resolvePending': {
      const pending = state.pendingUrlState
      if (pending === null) return state

      const cleared: ViewState = { ...state, pendingUrlState: null }
      if (pending.kind === 'blueprint') return cleared
      // The deep-linked slice never materialized — drop it, stay on blueprint.
      if (!action.availableSliceIds.includes(pending.sliceId)) return cleared

      const tab: TabDescriptor =
        pending.kind === 'present'
          ? { kind: 'present', sliceId: pending.sliceId }
          : { kind: 'slice', sliceId: pending.sliceId }
      const opened = viewStateReducer(cleared, { type: 'open', tab })
      return pending.kind === 'present'
        ? { ...opened, restoredFrame: { sliceId: pending.sliceId, frame: pending.frame } }
        : opened
    }
    case 'setLens':
      return state.lens === action.lens ? state : { ...state, lens: action.lens }
  }
}

export type ViewStateContextValue = {
  tabs: TabDescriptor[]
  activeKey: TabKey
  activeTab: TabDescriptor
  pendingUrlState: UrlViewState | null
  restoredFrame: { sliceId: string; frame: number } | null
  /** Active view lens; mirrored to the `lens` URL param. */
  lens: 'assumption' | null
  setLens: (lens: 'assumption' | null) => void
  openTab: (tab: TabDescriptor) => void
  closeTab: (key: TabKey) => void
  activateTab: (key: TabKey) => void
  closeTabsForSlice: (sliceId: string) => void
  /** Activate a pending URL deep link once the slice list has loaded. */
  resolvePending: (availableSliceIds: readonly string[]) => void
  /** Presentation frame changes mirror to the URL (debounced). */
  reportPresentFrame: (frame: number) => void
}

export const ViewStateContext = createContext<ViewStateContextValue | null>(null)

export function useViewState(): ViewStateContextValue {
  const context = useContext(ViewStateContext)
  if (!context) {
    throw new Error('useViewState must be used within ViewStateProvider')
  }
  return context
}

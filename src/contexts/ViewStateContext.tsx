import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import { serializeUrlViewState, type UrlViewState } from '@/lib/urlViewState'
import {
  createInitialViewState,
  tabKey,
  ViewStateContext,
  viewStateReducer,
  type TabDescriptor,
  type TabKey,
  type ViewState,
} from '@/contexts/viewStateStore'

export type {
  TabDescriptor,
  TabKey,
  ViewState,
  ViewStateAction,
  ViewStateContextValue,
} from '@/contexts/viewStateStore'

/** Safari throttles history.replaceState — debounce per-frame writes. */
const FRAME_URL_DEBOUNCE_MS = 250

function urlStateForTab(
  tab: TabDescriptor | null,
  frame: number,
  lens: 'assumption' | null,
): UrlViewState {
  if (tab === null) {
    // Base blueprint view — no tab is active.
    return lens ? { kind: 'blueprint', lens } : { kind: 'blueprint' }
  }
  switch (tab.kind) {
    case 'slice':
      return lens
        ? { kind: 'slice', sliceId: tab.sliceId, lens }
        : { kind: 'slice', sliceId: tab.sliceId }
    case 'present':
      return { kind: 'present', sliceId: tab.sliceId, frame }
  }
}

/**
 * One hook owns URL writes: the active tab serializes via
 * `history.replaceState` (no popstate listener — we never pushState), frame
 * writes debounce, and nothing is written while a boot deep link is pending.
 */
function useUrlViewState(
  state: ViewState,
  activeTab: TabDescriptor | null,
): (frame: number) => void {
  const pending = state.pendingUrlState !== null
  const restoredFrame = state.restoredFrame
  const lens = state.lens
  const frameRef = useRef(0)
  const debounceRef = useRef<number | null>(null)
  const activeTabRef = useRef(activeTab)
  const pendingRef = useRef(pending)
  const lensRef = useRef(lens)

  useEffect(() => {
    activeTabRef.current = activeTab
    pendingRef.current = pending
    lensRef.current = lens
  })

  const writeUrl = useCallback(
    (tab: TabDescriptor | null, frame: number, lensValue: 'assumption' | null) => {
      const search = serializeUrlViewState(urlStateForTab(tab, frame, lensValue))
      window.history.replaceState(null, '', `${window.location.pathname}${search}`)
    },
    [],
  )

  // Immediate write on tab or lens change; a pending in-flight frame write
  // is stale for the previous tab, so drop it.
  useEffect(() => {
    if (pending) return
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    if (activeTab?.kind === 'present') {
      frameRef.current =
        restoredFrame && restoredFrame.sliceId === activeTab.sliceId
          ? restoredFrame.frame
          : 0
    }
    writeUrl(activeTab, frameRef.current, lens)
  }, [activeTab, lens, pending, restoredFrame, writeUrl])

  useEffect(
    () => () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    },
    [],
  )

  return useCallback(
    (frame: number) => {
      frameRef.current = frame
      const tab = activeTabRef.current
      if (pendingRef.current || tab?.kind !== 'present') return
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null
        writeUrl(tab, frame, lensRef.current)
      }, FRAME_URL_DEBOUNCE_MS)
    },
    [writeUrl],
  )
}

type ViewStateProviderProps = {
  children: ReactNode
}

export function ViewStateProvider({ children }: ViewStateProviderProps) {
  const [state, dispatch] = useReducer(
    viewStateReducer,
    window.location.search,
    createInitialViewState,
  )

  const activeTab = useMemo(
    () =>
      state.activeKey === null
        ? null
        : (state.tabs.find((tab) => tabKey(tab) === state.activeKey) ?? null),
    [state.tabs, state.activeKey],
  )

  const reportPresentFrame = useUrlViewState(state, activeTab)

  const openTab = useCallback(
    (tab: TabDescriptor) => dispatch({ type: 'open', tab }),
    [],
  )
  const closeTab = useCallback(
    (key: TabKey) => dispatch({ type: 'close', key }),
    [],
  )
  const activateTab = useCallback(
    (key: TabKey | null) => dispatch({ type: 'activate', key }),
    [],
  )
  const closeTabsForSlice = useCallback(
    (sliceId: string) => dispatch({ type: 'closeForSlice', sliceId }),
    [],
  )
  const resolvePending = useCallback(
    (availableSliceIds: readonly string[]) =>
      dispatch({ type: 'resolvePending', availableSliceIds }),
    [],
  )
  const setLens = useCallback(
    (lens: 'assumption' | null) => dispatch({ type: 'setLens', lens }),
    [],
  )

  const value = useMemo(
    () => ({
      tabs: state.tabs,
      activeKey: state.activeKey,
      activeTab,
      pendingUrlState: state.pendingUrlState,
      restoredFrame: state.restoredFrame,
      lens: state.lens,
      setLens,
      openTab,
      closeTab,
      activateTab,
      closeTabsForSlice,
      resolvePending,
      reportPresentFrame,
    }),
    [
      state.tabs,
      state.activeKey,
      state.pendingUrlState,
      state.restoredFrame,
      state.lens,
      activeTab,
      setLens,
      openTab,
      closeTab,
      activateTab,
      closeTabsForSlice,
      resolvePending,
      reportPresentFrame,
    ],
  )

  return (
    <ViewStateContext.Provider value={value}>
      {children}
    </ViewStateContext.Provider>
  )
}

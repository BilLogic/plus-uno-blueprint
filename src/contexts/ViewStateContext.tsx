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
  BLUEPRINT_TAB,
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

function urlStateForTab(tab: TabDescriptor, frame: number): UrlViewState {
  switch (tab.kind) {
    case 'blueprint':
      return { kind: 'blueprint' }
    case 'slice':
      return { kind: 'slice', sliceId: tab.sliceId }
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
  activeTab: TabDescriptor,
): (frame: number) => void {
  const pending = state.pendingUrlState !== null
  const restoredFrame = state.restoredFrame
  const frameRef = useRef(0)
  const debounceRef = useRef<number | null>(null)
  const activeTabRef = useRef(activeTab)
  const pendingRef = useRef(pending)

  useEffect(() => {
    activeTabRef.current = activeTab
    pendingRef.current = pending
  })

  const writeUrl = useCallback((tab: TabDescriptor, frame: number) => {
    const search = serializeUrlViewState(urlStateForTab(tab, frame))
    window.history.replaceState(null, '', `${window.location.pathname}${search}`)
  }, [])

  // Immediate write on tab change; a pending in-flight frame write is stale
  // for the previous tab, so drop it.
  useEffect(() => {
    if (pending) return
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    if (activeTab.kind === 'present') {
      frameRef.current =
        restoredFrame && restoredFrame.sliceId === activeTab.sliceId
          ? restoredFrame.frame
          : 0
    }
    writeUrl(activeTab, frameRef.current)
  }, [activeTab, pending, restoredFrame, writeUrl])

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
      if (pendingRef.current || tab.kind !== 'present') return
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null
        writeUrl(tab, frame)
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
      state.tabs.find((tab) => tabKey(tab) === state.activeKey) ?? BLUEPRINT_TAB,
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
    (key: TabKey) => dispatch({ type: 'activate', key }),
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

  const value = useMemo(
    () => ({
      tabs: state.tabs,
      activeKey: state.activeKey,
      activeTab,
      pendingUrlState: state.pendingUrlState,
      restoredFrame: state.restoredFrame,
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
      activeTab,
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

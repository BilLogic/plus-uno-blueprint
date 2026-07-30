import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLifecyclePhases } from '@/hooks/useLifecyclePhases'
import { mergeSlidesWithFallback } from '@/lib/mergeSlidesWithFallback'
import {
  FALLBACK_NAV,
  type EditorView,
  type NavItem,
  type SlideViewType,
} from '@/types/nav'

type EditorContextValue = {
  view: EditorView
  setView: (view: EditorView) => void
  /** Orientation homepage (sidebar Home destination). */
  goLanding: () => void
  /** Birds-eye service overview canvas (animates fit when leaving detail). */
  goHome: () => void
  /** Enter the overview canvas from the homepage without a fit zoom animation. */
  enterCanvas: () => void
  /**
   * When true, the next overview fit should jump instead of animating
   * (set by enterCanvas; cleared by goHome).
   */
  skipCanvasFitAnimation: boolean
  openDetail: (slideId: string) => void
  slides: NavItem[]
  /** Slides from DB/fallback (same as slides; kept for callers). */
  baseSlides: NavItem[]
  getScenarioDisplayViewType: (slide: NavItem) => SlideViewType
  setScenarioDisplayViewType: (
    scenarioId: string,
    viewType: SlideViewType,
  ) => void
  slidesLoading: boolean
  slidesError: string | null
  activeSlideId: string
  setActiveSlideId: (id: string) => void
  activeSlide: NavItem
}

const EditorContext = createContext<EditorContextValue | null>(null)

type EditorProviderProps = {
  children: ReactNode
}

export function EditorProvider({ children }: EditorProviderProps) {
  const { slides: dbSlides, loading, error, configured } = useLifecyclePhases()

  const slides = useMemo(() => {
    if (dbSlides.length === 0) return FALLBACK_NAV
    return mergeSlidesWithFallback(dbSlides)
  }, [dbSlides])

  const [view, setView] = useState<EditorView>('landing')
  const [activeSlideId, setActiveSlideId] = useState(FALLBACK_NAV[0].id)
  const [skipCanvasFitAnimation, setSkipCanvasFitAnimation] = useState(false)

  const goLanding = useCallback(() => {
    setView('landing')
  }, [])

  const goHome = useCallback(() => {
    setSkipCanvasFitAnimation(false)
    setView('home')
  }, [])

  const enterCanvas = useCallback(() => {
    setSkipCanvasFitAnimation(true)
    setView('home')
  }, [])

  const openDetail = useCallback((slideId: string) => {
    setActiveSlideId(slideId)
    setView('detail')
  }, [])

  const getScenarioDisplayViewType = useCallback(
    (_slide: NavItem): SlideViewType => 'side-by-side',
    [],
  )

  const setScenarioDisplayViewType = useCallback(
    (_scenarioId: string, _viewType: SlideViewType) => {
      // Integrated view is disabled; display is always side-by-side.
    },
    [],
  )

  useEffect(() => {
    if (slides.length === 0) return
    const exists = slides.some((s) => s.id === activeSlideId)
    if (!exists) setActiveSlideId(slides[0].id)
  }, [slides, activeSlideId])

  const activeSlide = useMemo(
    () =>
      slides.find((s) => s.id === activeSlideId) ??
      slides[0] ??
      FALLBACK_NAV[0],
    [activeSlideId, slides],
  )

  const slidesLoading = configured && loading && dbSlides.length === 0
  const slidesError = configured ? error : null

  const value = useMemo(
    () => ({
      view,
      setView,
      goLanding,
      goHome,
      enterCanvas,
      skipCanvasFitAnimation,
      openDetail,
      slides,
      baseSlides: slides,
      getScenarioDisplayViewType,
      setScenarioDisplayViewType,
      slidesLoading,
      slidesError,
      activeSlideId,
      setActiveSlideId,
      activeSlide,
    }),
    [
      view,
      goLanding,
      goHome,
      enterCanvas,
      skipCanvasFitAnimation,
      openDetail,
      slides,
      getScenarioDisplayViewType,
      setScenarioDisplayViewType,
      slidesLoading,
      slidesError,
      activeSlideId,
      activeSlide,
    ],
  )

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  )
}

export function useEditor() {
  const context = useContext(EditorContext)
  if (!context) {
    throw new Error('useEditor must be used within EditorProvider')
  }
  return context
}

type EditorDetailScopeProps = {
  /** Slide (scenario) the scope opens focused on. */
  slideId: string
  children: ReactNode
}

/**
 * Local editor-state override for tabs that embed the normal blueprint view
 * (slice focus tabs). Slides and loading state come from the app-level
 * EditorProvider; `view` / `activeSlideId` are tab-local so navigating
 * inside a slice tab never disturbs the blueprint tab, and the tab opens in
 * detail view on the given slide.
 *
 * Invariant: every view-writing method of EditorContext must be overridden
 * here — anything left to the parent would silently retarget the base
 * blueprint view underneath the tab.
 */
export function EditorDetailScope({ slideId, children }: EditorDetailScopeProps) {
  const parent = useEditor()
  const [view, setView] = useState<EditorView>('detail')
  const [activeSlideId, setActiveSlideId] = useState(slideId)
  const [skipCanvasFitAnimation, setSkipCanvasFitAnimation] = useState(false)

  // Re-anchor when the scope is re-pointed at a different slide.
  const [lastSlideId, setLastSlideId] = useState(slideId)
  if (lastSlideId !== slideId) {
    setLastSlideId(slideId)
    setActiveSlideId(slideId)
    setView('detail')
  }

  // Landing navigation from inside a slice tab is not a supported
  // affordance (the scope cannot reach the tab store to leave the tab, and
  // the parent's goLanding would switch the base view underneath it), so
  // the override is a deliberate no-op.
  const goLanding = useCallback(() => {}, [])

  const goHome = useCallback(() => {
    setSkipCanvasFitAnimation(false)
    setView('home')
  }, [])

  const enterCanvas = useCallback(() => {
    setSkipCanvasFitAnimation(true)
    setView('home')
  }, [])

  const openDetail = useCallback((nextSlideId: string) => {
    setActiveSlideId(nextSlideId)
    setView('detail')
  }, [])

  const activeSlide = useMemo(
    () =>
      parent.slides.find((slide) => slide.id === activeSlideId) ??
      parent.slides[0] ??
      FALLBACK_NAV[0],
    [activeSlideId, parent.slides],
  )

  const value = useMemo(
    () => ({
      ...parent,
      view,
      setView,
      goLanding,
      goHome,
      enterCanvas,
      skipCanvasFitAnimation,
      openDetail,
      activeSlideId,
      setActiveSlideId,
      activeSlide,
    }),
    [
      parent,
      view,
      goLanding,
      goHome,
      enterCanvas,
      skipCanvasFitAnimation,
      openDetail,
      activeSlideId,
      activeSlide,
    ],
  )

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  )
}

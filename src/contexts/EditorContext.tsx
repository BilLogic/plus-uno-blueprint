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
  FALLBACK_SLIDES,
  type EditorView,
  type Slide,
  type SlideViewType,
} from '@/types/slides'

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
  slides: Slide[]
  /** Slides from DB/fallback (same as slides; kept for callers). */
  baseSlides: Slide[]
  getScenarioDisplayViewType: (slide: Slide) => SlideViewType
  setScenarioDisplayViewType: (
    scenarioId: string,
    viewType: SlideViewType,
  ) => void
  slidesLoading: boolean
  slidesError: string | null
  activeSlideId: string
  setActiveSlideId: (id: string) => void
  activeSlide: Slide
}

const EditorContext = createContext<EditorContextValue | null>(null)

type EditorProviderProps = {
  children: ReactNode
}

export function EditorProvider({ children }: EditorProviderProps) {
  const { slides: dbSlides, loading, error, configured } = useLifecyclePhases()

  const slides = useMemo(() => {
    if (dbSlides.length === 0) return FALLBACK_SLIDES
    return mergeSlidesWithFallback(dbSlides)
  }, [dbSlides])

  const [view, setView] = useState<EditorView>('landing')
  const [activeSlideId, setActiveSlideId] = useState(FALLBACK_SLIDES[0].id)
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
    (_slide: Slide): SlideViewType => 'side-by-side',
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
      FALLBACK_SLIDES[0],
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

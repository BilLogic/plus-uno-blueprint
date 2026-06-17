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
  CANVAS_VIEW_ENABLED,
  FALLBACK_SLIDES,
  getSlideViewType,
  type EditorMode,
  type Slide,
  type SlideViewType,
} from '@/types/slides'

type EditorContextValue = {
  mode: EditorMode
  setMode: (mode: EditorMode) => void
  slides: Slide[]
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
  const [mode, setModeState] = useState<EditorMode>('stack')
  const setMode = useCallback((next: EditorMode) => {
    if (!CANVAS_VIEW_ENABLED && next === 'canvas') return
    setModeState(next)
  }, [])
  const { slides: dbSlides, loading, error, configured } = useLifecyclePhases()

  const slides = useMemo(() => {
    if (dbSlides.length === 0) return FALLBACK_SLIDES
    return mergeSlidesWithFallback(dbSlides)
  }, [dbSlides])

  const [scenarioViewTypeOverrides, setScenarioViewTypeOverrides] = useState<
    Record<string, SlideViewType>
  >({})
  const [activeSlideId, setActiveSlideId] = useState(FALLBACK_SLIDES[0].id)

  const getScenarioDisplayViewType = useCallback(
    (slide: Slide) =>
      scenarioViewTypeOverrides[slide.id] ?? getSlideViewType(slide),
    [scenarioViewTypeOverrides],
  )

  const setScenarioDisplayViewType = useCallback(
    (scenarioId: string, viewType: SlideViewType) => {
      setScenarioViewTypeOverrides((prev) => ({
        ...prev,
        [scenarioId]: viewType,
      }))
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

  const value = useMemo(
    () => ({
      mode,
      setMode,
      slides,
      getScenarioDisplayViewType,
      setScenarioDisplayViewType,
      slidesLoading: configured && loading && dbSlides.length === 0,
      slidesError: configured ? error : null,
      activeSlideId,
      setActiveSlideId,
      activeSlide,
    }),
    [
      mode,
      slides,
      getScenarioDisplayViewType,
      setScenarioDisplayViewType,
      configured,
      loading,
      error,
      activeSlideId,
      activeSlide,
      dbSlides.length,
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

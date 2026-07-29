import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  type CanvasAnnotation,
  type CanvasAnnotationTool,
  ANNOTATION_DEFAULT_PEN_STROKE,
  ANNOTATION_INK,
} from '@/lib/canvasAnnotations'
import { CanvasAnnotationContext } from '@/contexts/canvasAnnotationContext'

type CanvasAnnotationProviderProps = {
  children: ReactNode
}

export function CanvasAnnotationProvider({
  children,
}: CanvasAnnotationProviderProps) {
  const [tool, setTool] = useState<CanvasAnnotationTool>('select')
  const [penColor, setPenColor] = useState(ANNOTATION_INK)
  const [penStrokeWidth, setPenStrokeWidth] = useState(
    ANNOTATION_DEFAULT_PEN_STROKE,
  )
  const [annotations, setAnnotations] = useState<CanvasAnnotation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const addAnnotation = useCallback((annotation: CanvasAnnotation) => {
    setAnnotations((current) => [...current, annotation])
  }, [])

  const updateAnnotation = useCallback(
    (id: string, patch: Partial<CanvasAnnotation>) => {
      setAnnotations((current) =>
        current.map((item) =>
          item.id === id ? ({ ...item, ...patch } as CanvasAnnotation) : item,
        ),
      )
    },
    [],
  )

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations((current) => current.filter((item) => item.id !== id))
    setSelectedId((current) => (current === id ? null : current))
  }, [])

  const replaceAnnotations = useCallback(
    (updater: (current: CanvasAnnotation[]) => CanvasAnnotation[]) => {
      setAnnotations(updater)
    },
    [],
  )

  const clearAnnotations = useCallback(() => {
    setAnnotations([])
    setSelectedId(null)
  }, [])

  const value = useMemo(
    () => ({
      tool,
      setTool,
      penColor,
      setPenColor,
      penStrokeWidth,
      setPenStrokeWidth,
      annotations,
      addAnnotation,
      updateAnnotation,
      removeAnnotation,
      replaceAnnotations,
      clearAnnotations,
      selectedId,
      setSelectedId,
      isAnnotating: tool !== 'select',
    }),
    [
      tool,
      penColor,
      penStrokeWidth,
      annotations,
      addAnnotation,
      updateAnnotation,
      removeAnnotation,
      replaceAnnotations,
      clearAnnotations,
      selectedId,
    ],
  )

  return (
    <CanvasAnnotationContext.Provider value={value}>
      {children}
    </CanvasAnnotationContext.Provider>
  )
}

import { createContext, useContext } from 'react'
import type {
  CanvasAnnotation,
  CanvasAnnotationTool,
} from '@/lib/canvasAnnotations'

export type CanvasAnnotationContextValue = {
  tool: CanvasAnnotationTool
  setTool: (tool: CanvasAnnotationTool) => void
  penColor: string
  setPenColor: (color: string) => void
  penStrokeWidth: number
  setPenStrokeWidth: (width: number) => void
  annotations: CanvasAnnotation[]
  addAnnotation: (annotation: CanvasAnnotation) => void
  updateAnnotation: (id: string, patch: Partial<CanvasAnnotation>) => void
  removeAnnotation: (id: string) => void
  replaceAnnotations: (
    updater: (current: CanvasAnnotation[]) => CanvasAnnotation[],
  ) => void
  clearAnnotations: () => void
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  isAnnotating: boolean
}

export const CanvasAnnotationContext =
  createContext<CanvasAnnotationContextValue | null>(null)

export function useCanvasAnnotations() {
  const context = useContext(CanvasAnnotationContext)
  if (!context) {
    throw new Error(
      'useCanvasAnnotations must be used within CanvasAnnotationProvider',
    )
  }
  return context
}

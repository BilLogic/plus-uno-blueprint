export type CanvasAnnotationTool =
  | 'select'
  | 'pen'
  | 'rect'
  | 'ellipse'
  | 'text'
  | 'sticky'
  | 'eraser'

export type CanvasPoint = { x: number; y: number }

type AnnotationBase = {
  id: string
  color: string
}

export type PenAnnotation = AnnotationBase & {
  type: 'pen'
  points: CanvasPoint[]
  strokeWidth: number
}

export type ShapeAnnotation = Omit<AnnotationBase, 'color'> & {
  type: 'rect' | 'ellipse'
  x: number
  y: number
  width: number
  height: number
  strokeWidth: number
  /** Outline color; `null` = no outline. */
  color: string | null
  /** `null` = no fill (outline only). */
  fillColor: string | null
  text: string
}

export type TextAnnotation = AnnotationBase & {
  type: 'text'
  x: number
  y: number
  text: string
  fontSize: number
  bold?: boolean
  strike?: boolean
  align?: 'left' | 'center' | 'right'
}

export type StickyAnnotation = AnnotationBase & {
  type: 'sticky'
  x: number
  y: number
  width: number
  height: number
  text: string
  fontSize: number
  bold?: boolean
  strike?: boolean
}

export type CanvasAnnotation =
  | PenAnnotation
  | ShapeAnnotation
  | TextAnnotation
  | StickyAnnotation

export const ANNOTATION_INK = '#111827'
export const ANNOTATION_STICKY_BG = '#FACC15'
export const ANNOTATION_DEFAULT_STROKE = 2.5
export const ANNOTATION_STICKY_SIZE = { width: 160, height: 120 }

/** FigJam-style sticky pastel fills. */
export const ANNOTATION_STICKY_SWATCHES = [
  '#FACC15',
  '#FDE68A',
  '#86EFAC',
  '#6EE7B7',
  '#93C5FD',
  '#A5B4FC',
  '#C4B5FD',
  '#F9A8D4',
  '#FDA4AF',
  '#FDBA74',
  '#E5E7EB',
  '#FFFFFF',
] as const

/** Soft fills — readable over board content without overpowering it. */
export const ANNOTATION_FILL_SWATCHES = [
  '#FEF3C7',
  '#FFEDD5',
  '#FEE2E2',
  '#FCE7F3',
  '#EDE9FE',
  '#DBEAFE',
  '#D1FAE5',
  '#E5E7EB',
  '#FFFFFF',
  '#111827',
] as const

/** Strong outline colors. */
export const ANNOTATION_STROKE_SWATCHES = [
  '#111827',
  '#FFFFFF',
  '#DC2626',
  '#EA580C',
  '#CA8A04',
  '#16A34A',
  '#2563EB',
  '#7C3AED',
  '#DB2777',
] as const

export const ANNOTATION_STROKE_WIDTHS = [1.5, 2.5, 4] as const
/**
 * Pen stroke weights in board units (same space as shape strokes).
 * Thick is intentionally much heavier so it reads at overview zoom.
 */
export const ANNOTATION_PEN_STROKE_WIDTHS = [3, 14] as const
/** Soft board-friendly pen colors (FigJam-like). */
export const ANNOTATION_PEN_SWATCHES = [
  '#111827',
  '#6B7280',
  '#FCA5A5',
  '#FDBA74',
  '#FDE047',
  '#86EFAC',
  '#93C5FD',
  '#C4B5FD',
  '#FFFFFF',
] as const
export const ANNOTATION_FONT_SIZES = [12, 14, 18, 24, 32, 48] as const
export const ANNOTATION_MIN_SIZE = { width: 48, height: 40 } as const
export const ANNOTATION_DEFAULT_FONT_SIZE = 14
export const ANNOTATION_DEFAULT_PEN_STROKE = 3
/** Eraser brush radius in screen pixels (converted to board space via live scale). */
export const ANNOTATION_ERASER_SCREEN_RADIUS = 16

export const ANNOTATION_FONT_SIZE_LABELS: Record<number, string> = {
  12: 'Extra small',
  14: 'Small',
  18: 'Medium',
  24: 'Large',
  32: 'Extra large',
  48: 'Huge',
}

export function annotationFontSizeLabel(fontSize: number): string {
  return ANNOTATION_FONT_SIZE_LABELS[fontSize] ?? `${fontSize}px`
}

/** Text on a filled shape — light fills get dark text, dark fills get white. */
export function annotationTextOnFill(fillColor: string | null): string {
  if (!fillColor) return ANNOTATION_INK
  const darkFills = new Set(['#111827', '#1F2937', '#0F172A'])
  return darkFills.has(fillColor.toUpperCase()) ? '#FFFFFF' : ANNOTATION_INK
}

export function createAnnotationId(): string {
  return `ann-${crypto.randomUUID()}`
}

function distanceSq(a: CanvasPoint, b: CanvasPoint): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

/** Shortest distance from point P to segment AB. */
function distanceToSegment(
  p: CanvasPoint,
  a: CanvasPoint,
  b: CanvasPoint,
): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const lenSq = abx * abx + aby * aby
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby))
}

/**
 * True when the eraser circle touches any point or segment of a pen stroke.
 */
function penStrokeHitsEraser(
  points: CanvasPoint[],
  eraser: CanvasPoint,
  radius: number,
): boolean {
  if (points.length === 0) return false
  const radiusSq = radius * radius
  for (const point of points) {
    if (distanceSq(point, eraser) <= radiusSq) return true
  }
  for (let i = 0; i < points.length - 1; i++) {
    if (distanceToSegment(eraser, points[i], points[i + 1]) <= radius) {
      return true
    }
  }
  return false
}

/** Apply eraser along a drag path (samples between last and next for fast moves). */
export function erasePenAnnotationsAtStroke(
  annotations: CanvasAnnotation[],
  from: CanvasPoint,
  to: CanvasPoint,
  radius: number,
): CanvasAnnotation[] {
  const samples: CanvasPoint[] = []
  const dist = Math.hypot(to.x - from.x, to.y - from.y)
  const step = Math.max(radius * 0.35, 1.5)
  if (dist <= step) {
    samples.push(to)
  } else {
    const count = Math.ceil(dist / step)
    for (let i = 1; i <= count; i++) {
      const t = i / count
      samples.push({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      })
    }
  }

  let next = annotations
  for (const sample of samples) {
    next = erasePenAnnotationsAtPoint(next, sample, radius)
  }
  return next
}

/** Remove whole pen strokes that touch the eraser (no partial cuts). */
export function erasePenAnnotationsAtPoint(
  annotations: CanvasAnnotation[],
  eraser: CanvasPoint,
  radius: number,
): CanvasAnnotation[] {
  return annotations.filter((annotation) => {
    if (annotation.type !== 'pen') return true
    const hitRadius = radius + annotation.strokeWidth * 0.5
    return !penStrokeHitsEraser(annotation.points, eraser, hitRadius)
  })
}

export function normalizeRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { x: number; y: number; width: number; height: number } {
  const x = Math.min(x0, x1)
  const y = Math.min(y0, y1)
  return {
    x,
    y,
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  }
}

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

export function applyResizeHandle(
  handle: ResizeHandle,
  origin: { x: number; y: number; width: number; height: number },
  dx: number,
  dy: number,
  minW = ANNOTATION_MIN_SIZE.width,
  minH = ANNOTATION_MIN_SIZE.height,
): { x: number; y: number; width: number; height: number } {
  let x = origin.x
  let y = origin.y
  let width: number
  let height: number

  switch (handle) {
    case 'se':
      width = origin.width + dx
      height = origin.height + dy
      break
    case 'sw':
      x = origin.x + dx
      width = origin.width - dx
      height = origin.height + dy
      break
    case 'ne':
      y = origin.y + dy
      width = origin.width + dx
      height = origin.height - dy
      break
    default:
      x = origin.x + dx
      y = origin.y + dy
      width = origin.width - dx
      height = origin.height - dy
      break
  }

  if (width < minW) {
    if (handle === 'sw' || handle === 'nw') x = origin.x + origin.width - minW
    width = minW
  }
  if (height < minH) {
    if (handle === 'ne' || handle === 'nw') y = origin.y + origin.height - minH
    height = minH
  }

  return { x, y, width, height }
}

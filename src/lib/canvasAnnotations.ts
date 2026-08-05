
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

export const ANNOTATION_INK: string = 'var(--color-slate-1200)'
export const ANNOTATION_PAPER: string = 'var(--color-gray-100)'
export const ANNOTATION_STICKY_BG: string = 'var(--color-yellow-500)'
export const ANNOTATION_DEFAULT_STROKE = 2.5
export const ANNOTATION_STICKY_SIZE = { width: 160, height: 120 }

/**
 * Sticky fills — step 500, the same weight as the blueprint cells they sit
 * beside, so a note reads as another object on the board rather than a
 * different material.
 */
export const ANNOTATION_STICKY_SWATCHES = [
  'var(--color-yellow-500)',
  'var(--color-amber-500)',
  'var(--color-lime-500)',
  'var(--color-green-500)',
  'var(--color-blue-500)',
  'var(--color-indigo-500)',
  'var(--color-violet-500)',
  'var(--color-pink-500)',
  'var(--color-red-500)',
  'var(--color-orange-500)',
  'var(--color-slate-500)',
  ANNOTATION_PAPER,
] as const

/**
 * Shape fills — step 300. One step paler than the cells, which is what lets a
 * filled rectangle sit over a lane without hiding it.
 */
export const ANNOTATION_FILL_SWATCHES = [
  'var(--color-amber-300)',
  'var(--color-orange-300)',
  'var(--color-red-300)',
  'var(--color-pink-300)',
  'var(--color-violet-300)',
  'var(--color-blue-300)',
  'var(--color-green-300)',
  'var(--color-slate-300)',
  ANNOTATION_PAPER,
  ANNOTATION_INK,
] as const

/** Outline colours — step 1100, the text weight, so a 1.5px stroke still reads. */
export const ANNOTATION_STROKE_SWATCHES = [
  ANNOTATION_INK,
  ANNOTATION_PAPER,
  'var(--color-red-1100)',
  'var(--color-orange-1100)',
  'var(--color-yellow-1100)',
  'var(--color-green-1100)',
  'var(--color-blue-1100)',
  'var(--color-violet-1100)',
  'var(--color-pink-1100)',
] as const

export const ANNOTATION_STROKE_WIDTHS = [1.5, 2.5, 4] as const
/**
 * Pen stroke weights in board units (same space as shape strokes).
 * Thick is intentionally much heavier so it reads at overview zoom.
 */
export const ANNOTATION_PEN_STROKE_WIDTHS = [3, 14] as const
/**
 * Pen colors — Radix step 900, the solid fill step, plus ink and paper.
 *
 * These used to be Tailwind's 300-level tints (#FCA5A5, #FDBA74, …), which are
 * lighter than the step-500 cell fills they get drawn on: a pen stroke was
 * fainter than its own background. Step 9 is the vivid step, so every swatch now
 * reads against the board.
 */
export const ANNOTATION_PEN_SWATCHES = [
  'var(--color-slate-1200)',
  'var(--color-slate-900)',
  'var(--color-red-900)',
  'var(--color-orange-900)',
  'var(--color-amber-900)',
  'var(--color-green-900)',
  'var(--color-blue-900)',
  'var(--color-violet-900)',
  ANNOTATION_PAPER,
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

/**
 * Text on a filled shape. Every fill in `ANNOTATION_FILL_SWATCHES` is step 300
 * or paper except the ink one, so this is a membership test rather than a
 * contrast computation — which is also what lets the fills stay `var()`.
 */
/**
 * True when a swatch needs a visible outline to be seen against the toolbar.
 *
 * Every fill swatch is step 300 or paper except the ink one, so this is a
 * membership test rather than a luminance computation — which is what lets the
 * swatches stay `var()` tokens.
 */
export function isPaleAnnotationSwatch(
  color: string | null | undefined,
): boolean {
  return Boolean(color) && color !== ANNOTATION_INK
}

export function annotationTextOnFill(fillColor: string | null): string {
  if (!fillColor) return ANNOTATION_INK
  return fillColor === ANNOTATION_INK ? ANNOTATION_PAPER : ANNOTATION_INK
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

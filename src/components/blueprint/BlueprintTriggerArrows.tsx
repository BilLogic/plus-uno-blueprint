import {
  useCallback,
  useEffect,
  useMemo,
  useId,
  useState,
  type RefObject,
} from 'react'
import {
  ARROW_CHEVRON_SIZE,
  ARROW_MARKER_PAD,
  ARROW_MARKER_REF_X,
  ARROW_MARKER_REF_Y,
  ARROW_STROKE_WIDTH,
  ARROW_VIEWPORT_PAD,
  buildArrowPath,
  isWrapTrigger,
} from '@/lib/blueprintArrowGeometry'
import { getPathTypeArrowColor } from '@/lib/pathTypeTheme'
import { cn } from '@/lib/utils'
import type { BlueprintCellTrigger } from '@/types/blueprint'
import type { PathType } from '@/types/database'

type ArrowLayer = 'forward' | 'wrap'

export type ColoredBlueprintTrigger = BlueprintCellTrigger & {
  path_type: PathType
  opacity?: number
}

type BlueprintTriggerArrowsProps = {
  triggers: BlueprintCellTrigger[] | ColoredBlueprintTrigger[]
  contentRef: RefObject<HTMLElement | null>
  scrollContainerRef: RefObject<HTMLElement | null>
  /** forward = in column gaps behind cells; wrap = loop overlay on top */
  layer: ArrowLayer
  /** Used when triggers do not include path_type (single-path grids). */
  pathType?: PathType
}

type ArrowSegment = {
  id: string
  d: string
  pathType: PathType
  opacity: number
}

const PATH_TYPES: PathType[] = ['happy', 'unhappy', 'exception', 'alternative']

function isColoredTrigger(
  trigger: BlueprintCellTrigger,
): trigger is ColoredBlueprintTrigger {
  return 'path_type' in trigger
}

export function BlueprintTriggerArrows({
  triggers,
  contentRef,
  scrollContainerRef,
  layer,
  pathType = 'happy',
}: BlueprintTriggerArrowsProps) {
  const [segments, setSegments] = useState<ArrowSegment[]>([])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const markerId = useId().replace(/:/g, '')

  const updateArrows = useCallback(() => {
    const content = contentRef.current
    if (!content || triggers.length === 0) {
      setSegments([])
      return
    }

    const next: ArrowSegment[] = []

    for (const trigger of triggers) {
      const sourceEl = content.querySelector<HTMLElement>(
        `[data-blueprint-cell="${trigger.source_cell_id}"]`,
      )
      const targetEl = content.querySelector<HTMLElement>(
        `[data-blueprint-cell="${trigger.target_cell_id}"]`,
      )
      if (!sourceEl || !targetEl) continue

      const wrap = isWrapTrigger(
        sourceEl,
        targetEl,
        trigger.source_cell_id,
        trigger.target_cell_id,
      )
      if (layer === 'forward' && wrap) continue
      if (layer === 'wrap' && !wrap) continue

      const d = buildArrowPath(
        sourceEl,
        targetEl,
        content,
        trigger.source_cell_id,
        trigger.target_cell_id,
      )
      if (!d) continue

      next.push({
        id: trigger.id,
        d,
        pathType: isColoredTrigger(trigger) ? trigger.path_type : pathType,
        opacity: isColoredTrigger(trigger) ? (trigger.opacity ?? 1) : 1,
      })
    }

    setSegments(next)
    setSize({
      width: Math.max(content.scrollWidth, content.offsetWidth, 1),
      height: Math.max(content.scrollHeight, content.offsetHeight, 1),
    })
  }, [contentRef, layer, pathType, triggers])

  useEffect(() => {
    updateArrows()
    const content = contentRef.current
    if (!content) return

    const scrollParent = scrollContainerRef.current ?? content
    const observer = new ResizeObserver(() => updateArrows())
    observer.observe(content)
    if (scrollParent !== content) {
      observer.observe(scrollParent)
    }

    let raf = 0
    const onScrollOrResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(updateArrows)
    }

    scrollParent.addEventListener('scroll', onScrollOrResize, { passive: true })
    window.addEventListener('resize', onScrollOrResize)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      scrollParent.removeEventListener('scroll', onScrollOrResize)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [contentRef, scrollContainerRef, updateArrows])

  const svgStyle = useMemo(
    () => ({
      left: -ARROW_VIEWPORT_PAD,
      top: -ARROW_VIEWPORT_PAD,
      width:
        size.width > 0 ? size.width + ARROW_VIEWPORT_PAD * 2 : '100%',
      height:
        size.height > 0 ? size.height + ARROW_VIEWPORT_PAD * 2 : '100%',
    }),
    [size.height, size.width],
  )

  const markerIds = useMemo(
    () =>
      Object.fromEntries(
        PATH_TYPES.map((type) => [type, `${markerId}-chevron-${type}`]),
      ) as Record<PathType, string>,
    [markerId],
  )

  if (segments.length === 0) return null

  return (
    <svg
      className={cn(
        'pointer-events-none absolute overflow-visible',
        layer === 'forward' ? 'z-[2]' : 'z-[30]',
      )}
      style={svgStyle}
      overflow="visible"
      aria-hidden
    >
      <defs>
        {PATH_TYPES.map((type) => (
          <marker
            key={type}
            id={markerIds[type]}
            viewBox={`${-ARROW_MARKER_PAD} ${-ARROW_MARKER_PAD} ${ARROW_CHEVRON_SIZE + ARROW_MARKER_PAD * 2} ${ARROW_CHEVRON_SIZE + ARROW_MARKER_PAD * 2}`}
            refX={ARROW_MARKER_REF_X}
            refY={ARROW_MARKER_REF_Y}
            markerWidth={ARROW_CHEVRON_SIZE}
            markerHeight={ARROW_CHEVRON_SIZE}
            orient="auto"
            markerUnits="userSpaceOnUse"
            overflow="visible"
          >
            <polyline
              points={`0,0 ${ARROW_CHEVRON_SIZE},${ARROW_CHEVRON_SIZE / 2} 0,${ARROW_CHEVRON_SIZE}`}
              fill="none"
              stroke={getPathTypeArrowColor(type)}
              strokeWidth={ARROW_STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        ))}
      </defs>
      <g transform={`translate(${ARROW_VIEWPORT_PAD} ${ARROW_VIEWPORT_PAD})`}>
        {segments.map((segment) => {
          const color = getPathTypeArrowColor(segment.pathType)
          return (
            <g key={segment.id} opacity={segment.opacity}>
              <path
                d={segment.d}
                fill="none"
                stroke={color}
                strokeWidth={ARROW_STROKE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd={`url(#${markerIds[segment.pathType]})`}
              />
            </g>
          )
        })}
      </g>
    </svg>
  )
}

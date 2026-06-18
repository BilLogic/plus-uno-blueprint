import {
  useCallback,
  useEffect,
  useMemo,
  useId,
  useState,
  type RefObject,
} from 'react'
import {
  ARROW_VIEWPORT_PAD,
  buildApplicationRegularTutorRailBusPath,
  buildArrowPath,
  buildOverheadRailFanOutDropPath,
  buildOverheadRailFanOutTrunkPath,
  groupDiscoveryRailTriggers,
  isWrapTrigger,
} from '@/lib/blueprintArrowGeometry'
import { cn } from '@/lib/utils'
import type { BlueprintCellTrigger } from '@/types/blueprint'
import type { PathType } from '@/types/database'
import {
  BlueprintArrowMarkerDefs,
  blueprintArrowPathProps,
  BLUEPRINT_ARROW_PATH_TYPES,
} from '@/components/blueprint/BlueprintArrowMarkerDefs'

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
  showMarker?: boolean
}

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
    const { busGroups, fanOutGroups, remaining } = groupDiscoveryRailTriggers(
      triggers,
      content,
    )

    for (const group of fanOutGroups) {
      const targetEls = group.branches.map((branch) => branch.targetEl)
      const trunk = buildOverheadRailFanOutTrunkPath(
        group.sourceEl,
        targetEls,
        content,
      )
      if (trunk) {
        next.push({
          id: `${group.sourceCellId}-trunk`,
          d: trunk,
          pathType,
          opacity: 1,
          showMarker: false,
        })
      }

      for (const branch of group.branches) {
        const d = buildOverheadRailFanOutDropPath(
          group.sourceEl,
          branch.targetEl,
          content,
        )
        if (!d) continue

        next.push({
          id: branch.triggerId,
          d,
          pathType,
          opacity: 1,
        })
      }
    }

    for (const group of busGroups) {
      const d = buildApplicationRegularTutorRailBusPath(
        group.sourceEls,
        group.targetEl,
        content,
      )
      if (!d) continue

      next.push({
        id: group.triggerIds.join('-'),
        d,
        pathType,
        opacity: 1,
      })
    }

    for (const trigger of remaining) {
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
        BLUEPRINT_ARROW_PATH_TYPES.map((type) => [
          type,
          `${markerId}-arrow-${type}`,
        ]),
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
      shapeRendering="geometricPrecision"
      aria-hidden
    >
      <defs>
        <BlueprintArrowMarkerDefs markerIds={markerIds} />
      </defs>
      <g transform={`translate(${ARROW_VIEWPORT_PAD} ${ARROW_VIEWPORT_PAD})`}>
        {segments.map((segment) => (
          <g key={segment.id} opacity={segment.opacity}>
            <path
              d={segment.d}
              {...blueprintArrowPathProps(segment.pathType)}
              {...(segment.showMarker === false
                ? {}
                : { markerEnd: `url(#${markerIds[segment.pathType]})` })}
            />
          </g>
        ))}
      </g>
    </svg>
  )
}

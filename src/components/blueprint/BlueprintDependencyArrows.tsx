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
  buildBidirectionalArrowPath,
  buildOverheadRailFanOutDropPath,
  buildOverheadRailFanOutTrunkPath,
  buildReportingAnIssueFrontStageActionStep1ToResolvePath,
  findBidirectionalDependencyPairs,
  groupDiscoveryRailDependencies,
  isWrapDependency,
  partitionReportingAnIssueFsaStep1ToResolveDependencies,
} from '@/lib/blueprintArrowGeometry'
import {
  getPathArrowColor,
  getPathColorKey,
  getPathDashArrayFromKey,
  pathColorKeyToMarkerSuffix,
} from '@/lib/pathColorTheme'
import { getPathTypeArrowColor } from '@/lib/pathTypeTheme'
import { cn } from '@/lib/utils'
import type { BlueprintCellDependency } from '@/types/blueprint'
import type { PathType } from '@/types/database'
import {
  BlueprintArrowMarkerDefs,
  blueprintArrowPathProps,
} from '@/components/blueprint/BlueprintArrowMarkerDefs'

type ArrowLayer = 'forward' | 'wrap'

export type ColoredBlueprintDependency = BlueprintCellDependency & {
  path_type: PathType
  opacity?: number
}

type BlueprintDependencyArrowsProps = {
  dependencies: BlueprintCellDependency[] | ColoredBlueprintDependency[]
  contentRef: RefObject<HTMLElement | null>
  scrollContainerRef: RefObject<HTMLElement | null>
  /** forward = in column gaps behind cells; wrap = loop overlay on top */
  lane: ArrowLayer
  /** Used when dependencies do not include path_type (single-path grids). */
  pathType?: PathType
  /** When set with pathType, arrows use the stable path identity color. */
  pathName?: string
}

type ArrowSegment = {
  id: string
  d: string
  colorKey: string
  arrowColor: string
  opacity: number
  showMarker?: boolean
  dualMarker?: boolean
}

/** Identity of a rendered segment list — cheaper than re-rendering to find out. */
function serializeSegments(segments: readonly ArrowSegment[]): string {
  return segments
    .map(
      (segment) =>
        `${segment.id}|${segment.d}|${segment.colorKey}|${segment.arrowColor}|${segment.opacity}|${segment.showMarker ?? ''}|${segment.dualMarker ?? ''}`,
    )
    .join('~')
}

function isColoredDependency(
  dependency: BlueprintCellDependency,
): dependency is ColoredBlueprintDependency {
  return 'path_type' in dependency
}

/**
 * SVG arrow overlay for a single-path blueprint grid. Each segment carries its
 * path's colour and dash pattern, so arrows stay distinguishable where they
 * cross and in a monochrome print.
 */
export function BlueprintDependencyArrows({
  dependencies,
  contentRef,
  scrollContainerRef,
  lane,
  pathType = 'happy',
  pathName,
}: BlueprintDependencyArrowsProps) {
  const [segments, setSegments] = useState<ArrowSegment[]>([])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const markerId = useId().replace(/:/g, '')

  const defaultColorKey = pathName
    ? getPathColorKey({ path_type: pathType, name: pathName })
    : pathType
  const defaultArrowColor = pathName
    ? getPathArrowColor({ path_type: pathType, name: pathName })
    : getPathTypeArrowColor(pathType)

  const updateArrows = useCallback(() => {
    const content = contentRef.current
    // `enables` is panel-only by design: a precondition causes nothing, so
    // drawing it as an arrow would claim a handoff that never happens.
    const arrowDependencies = dependencies.filter((t) => (t.kind ?? 'leads_to') === 'leads_to')
    if (!content || arrowDependencies.length === 0) {
      setSegments([])
      return
    }

    const next: ArrowSegment[] = []
    const { resolveDependencies, otherDependencies: railInputDependencies } =
      partitionReportingAnIssueFsaStep1ToResolveDependencies(arrowDependencies)

    for (const dependency of resolveDependencies) {
      const sourceEl = content.querySelector<HTMLElement>(
        `[data-blueprint-cell="${dependency.source_cell_id}"]`,
      )
      const targetEl = content.querySelector<HTMLElement>(
        `[data-blueprint-cell="${dependency.target_cell_id}"]`,
      )
      if (!sourceEl || !targetEl) continue

      const wrap = isWrapDependency(
        sourceEl,
        targetEl,
        dependency.source_cell_id,
        dependency.target_cell_id,
      )
      if (lane === 'forward' && wrap) continue
      if (lane === 'wrap' && !wrap) continue

      const d = buildReportingAnIssueFrontStageActionStep1ToResolvePath(
        sourceEl,
        targetEl,
        content,
      )
      if (!d) continue

      next.push({
        id: dependency.id,
        d,
        colorKey: defaultColorKey,
        arrowColor: defaultArrowColor,
        opacity: isColoredDependency(dependency) ? (dependency.opacity ?? 1) : 1,
      })
    }

    const { busGroups, fanOutGroups, remaining } = groupDiscoveryRailDependencies(
      railInputDependencies,
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
          colorKey: defaultColorKey,
          arrowColor: defaultArrowColor,
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
          id: branch.dependencyId,
          d,
          colorKey: defaultColorKey,
          arrowColor: defaultArrowColor,
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
        id: group.dependencyIds.join('-'),
        d,
        colorKey: defaultColorKey,
        arrowColor: defaultArrowColor,
        opacity: 1,
      })
    }

    const { pairs, remaining: unpaired } =
      findBidirectionalDependencyPairs(remaining)

    for (const pair of pairs) {
      const cellAEl = content.querySelector<HTMLElement>(
        `[data-blueprint-cell="${pair.cellAId}"]`,
      )
      const cellBEl = content.querySelector<HTMLElement>(
        `[data-blueprint-cell="${pair.cellBId}"]`,
      )
      if (!cellAEl || !cellBEl) continue

      const wrap = isWrapDependency(
        cellAEl,
        cellBEl,
        pair.cellAId,
        pair.cellBId,
      )
      if (lane === 'forward' && wrap) continue
      if (lane === 'wrap' && !wrap) continue

      const d = buildBidirectionalArrowPath(cellAEl, cellBEl, content)
      if (!d) continue

      next.push({
        id: `${pair.first.id}-${pair.second.id}`,
        d,
        colorKey: defaultColorKey,
        arrowColor: defaultArrowColor,
        opacity: isColoredDependency(pair.first)
          ? (pair.first.opacity ?? 1)
          : 1,
        dualMarker: true,
      })
    }

    for (const dependency of unpaired) {
      const sourceEl = content.querySelector<HTMLElement>(
        `[data-blueprint-cell="${dependency.source_cell_id}"]`,
      )
      const targetEl = content.querySelector<HTMLElement>(
        `[data-blueprint-cell="${dependency.target_cell_id}"]`,
      )
      if (!sourceEl || !targetEl) continue

      const wrap = isWrapDependency(
        sourceEl,
        targetEl,
        dependency.source_cell_id,
        dependency.target_cell_id,
      )
      if (lane === 'forward' && wrap) continue
      if (lane === 'wrap' && !wrap) continue

      const d = buildArrowPath(
        sourceEl,
        targetEl,
        content,
        dependency.source_cell_id,
        dependency.target_cell_id,
        dependency.id,
      )
      if (!d) continue

      next.push({
        id: dependency.id,
        d,
        colorKey: defaultColorKey,
        arrowColor: defaultArrowColor,
        opacity: isColoredDependency(dependency) ? (dependency.opacity ?? 1) : 1,
      })
    }

    // Equality-guarded: a ResizeObserver burst during camera-fit relayout
    // fires many notifications for identical geometry; fresh object
    // identities on each would re-render (and re-observe) in a loop. Same
    // hardening as IntegratedDependencyArrows.
    const nextKey = serializeSegments(next)
    setSegments((prev) =>
      serializeSegments(prev) === nextKey ? prev : next,
    )
    const width = Math.max(content.scrollWidth, content.offsetWidth, 1)
    const height = Math.max(content.scrollHeight, content.offsetHeight, 1)
    setSize((prev) =>
      prev.width === width && prev.height === height
        ? prev
        : { width, height },
    )
  }, [
    contentRef,
    defaultArrowColor,
    defaultColorKey,
    lane,
    dependencies,
  ])

  useEffect(() => {
    updateArrows()
    const content = contentRef.current
    if (!content) return

    const scrollParent = scrollContainerRef.current ?? content

    // ONE rAF coalescer for every geometry-invalidating signal, the
    // ResizeObserver included — resize notifications arrive in bursts
    // during layout, and a synchronous DOM sweep per notification is
    // exactly the storm the integrated twin already guards against.
    let raf = 0
    const scheduleUpdate = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(updateArrows)
    }

    const observer = new ResizeObserver(scheduleUpdate)
    observer.observe(content)
    if (scrollParent !== content) {
      observer.observe(scrollParent)
    }

    scrollParent.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      scrollParent.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
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

  const { markerIds, markerColors } = useMemo(() => {
    const keys = new Set<string>([defaultColorKey])
    for (const segment of segments) {
      keys.add(segment.colorKey)
    }

    const ids: Record<string, string> = {}
    const colors: Record<string, string> = {}
    for (const key of keys) {
      const suffix = pathColorKeyToMarkerSuffix(key)
      ids[key] = `${markerId}-arrow-${suffix}`
      colors[key] =
        key === defaultColorKey
          ? defaultArrowColor
          : segments.find((segment) => segment.colorKey === key)?.arrowColor ??
            defaultArrowColor
    }

    return { markerIds: ids, markerColors: colors }
  }, [defaultArrowColor, defaultColorKey, markerId, segments])

  if (segments.length === 0) return null

  return (
    <svg
      data-blueprint-arrows=""
      className={cn(
        'pointer-events-none absolute overflow-visible',
        // Keep the connector hierarchy identical to IntegratedDependencyArrows:
        // ordinary runs tuck below the z-[1] cells, while wrap runs stay
        // elevated because they travel through the empty outer corridors.
        lane === 'forward' ? 'z-0' : 'z-[30]',
      )}
      style={svgStyle}
      overflow="visible"
      shapeRendering="geometricPrecision"
      aria-hidden
    >
      <defs>
        <BlueprintArrowMarkerDefs
          markerIds={markerIds}
          markerColors={markerColors}
        />
      </defs>
      <g transform={`translate(${ARROW_VIEWPORT_PAD} ${ARROW_VIEWPORT_PAD})`}>
        {segments.map((segment) => (
          <g key={segment.id} opacity={segment.opacity}>
            <path
              d={segment.d}
              {...blueprintArrowPathProps(segment.arrowColor, getPathDashArrayFromKey(segment.colorKey))}
              {...(segment.showMarker === false
                ? {}
                : segment.dualMarker
                  ? {
                      markerStart: `url(#${markerIds[segment.colorKey]}-start)`,
                      markerEnd: `url(#${markerIds[segment.colorKey]})`,
                    }
                  : { markerEnd: `url(#${markerIds[segment.colorKey]})` })}
            />
          </g>
        ))}
      </g>
    </svg>
  )
}

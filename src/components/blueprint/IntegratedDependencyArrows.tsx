import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type RefObject,
} from 'react'
import {
  ARROW_VIEWPORT_PAD,
  buildApplicationRegularTutorRailBusPath,
  buildArrowPath,
  buildBidirectionalArrowPath,
  buildReportingAnIssueFrontStageActionStep1ToResolvePath,
  buildOverheadRailFanOutDropPath,
  buildOverheadRailFanOutTrunkPath,
  findBidirectionalDependencyPairs,
  groupDiscoveryRailDependencies,
  isWrapDependency,
  partitionReportingAnIssueFsaStep1ToResolveDependencies,
  runArrowMeasurementPass,
} from '@/lib/blueprintArrowGeometry'
import {
  getPathArrowColor,
  getPathDashArrayFromKey,
  getPathColorKey,
  pathColorKeyToMarkerSuffix,
  type PathColorInput,
} from '@/lib/pathColorTheme'
import { getPathTypeArrowColor } from '@/lib/pathTypeTheme'
import { cn } from '@/lib/utils'
import {
  BlueprintArrowMarkerDefs,
  blueprintArrowPathProps,
} from '@/components/blueprint/BlueprintArrowMarkerDefs'
import type {
  IntegratedBlueprintCell,
  IntegratedBlueprintStep,
  IntegratedBlueprintDependency,
} from '@/types/integratedBlueprint'
import type { PathKind } from '@/types/database'

type ArrowLayer = 'forward' | 'wrap'

type IntegratedPathRef = {
  id: string
  name: string
  kind: PathKind
}

type IntegratedDependencyArrowsProps = {
  dependencies: IntegratedBlueprintDependency[]
  /** Accepted for parity with the band's arrow data; geometry reads the DOM. */
  cells?: IntegratedBlueprintCell[]
  steps?: IntegratedBlueprintStep[]
  paths?: IntegratedPathRef[]
  contentRef: RefObject<HTMLElement | null>
  scrollContainerRef: RefObject<HTMLElement | null>
  lane: ArrowLayer
}

type SimpleSegment = {
  id: string
  d: string
  colorKey: string
  arrowColor: string
  opacity: number
  showMarker?: boolean
  dualMarker?: boolean
}

/**
 * Frame-shared cell index. Every overlay instance drawing over the same
 * container (the merged grid mounts 2 per path) reuses one
 * `querySelectorAll` sweep within a ~frame window; a later frame
 * re-sweeps, so DOM changes are picked up by the next scheduled update.
 * Only element IDENTITY is cached — rects are always measured live.
 */
const cellSweepCache = new WeakMap<
  HTMLElement,
  { at: number; map: Map<string, HTMLElement> }
>()
const CELL_SWEEP_TTL_MS = 16

function sharedCellIndex(content: HTMLElement): Map<string, HTMLElement> {
  const now = performance.now()
  const cached = cellSweepCache.get(content)
  if (cached && now - cached.at < CELL_SWEEP_TTL_MS) return cached.map
  const map = new Map<string, HTMLElement>()
  for (const el of content.querySelectorAll<HTMLElement>(
    '[data-blueprint-cell]',
  )) {
    const id = el.getAttribute('data-blueprint-cell')
    if (id !== null && !map.has(id)) map.set(id, el)
  }
  cellSweepCache.set(content, { at: now, map })
  return map
}

/** Identity of a rendered segment list — cheaper than re-rendering to find out. */
function serializeSegments(segments: readonly SimpleSegment[]): string {
  return segments
    .map(
      (segment) =>
        `${segment.id}|${segment.d}|${segment.colorKey}|${segment.arrowColor}|${segment.opacity}|${segment.showMarker ?? ''}|${segment.dualMarker ?? ''}`,
    )
    .join('\n')
}

function resolveSegmentStyle(
  pathId: string,
  pathById: Map<string, IntegratedPathRef>,
): { colorKey: string; arrowColor: string } {
  const path = pathById.get(pathId)
  if (!path) {
    return { colorKey: 'happy', arrowColor: getPathTypeArrowColor('happy') }
  }

  const input: PathColorInput = {
    kind: path.kind,
    name: path.name,
  }

  return {
    colorKey: getPathColorKey(input),
    arrowColor: getPathArrowColor(input),
  }
}

/**
 * Arrow overlay for a path band: forward and wrap lanes, plus the hand-tuned
 * rail routes for the scenarios whose geometry the generic router cannot
 * express. (The integrated grid's fork trunks retired with that grid.)
 */
export function IntegratedDependencyArrows({
  dependencies,
  paths = [],
  contentRef,
  scrollContainerRef,
  lane,
}: IntegratedDependencyArrowsProps) {
  const [simpleSegments, setSimpleSegments] = useState<SimpleSegment[]>([])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const markerId = useId().replace(/:/g, '')

  const pathById = useMemo(
    () => new Map(paths.map((path) => [path.id, path])),
    [paths],
  )

  // Every notification that reaches this component re-runs the measurement, so
  // both setters bail out when nothing actually moved. Without that, a single
  // ResizeObserver notification produces a new state identity, which re-renders,
  // which (with an unmemoised prop upstream) rebuilds the observer, whose
  // `observe()` fires immediately — a self-sustaining rAF loop.
  const measureSize = useCallback(() => {
    const content = contentRef.current
    if (!content) return

    const width = Math.max(content.scrollWidth, content.offsetWidth, 1)
    const height = Math.max(content.scrollHeight, content.offsetHeight, 1)
    setSize((prev) =>
      prev.width === width && prev.height === height
        ? prev
        : { width, height },
    )
  }, [contentRef])

  const updateArrows = useCallback(() => {
    const content = contentRef.current
    if (!content || dependencies.length === 0) {
      setSimpleSegments((prev) => (prev.length === 0 ? prev : []))
      return
    }

    const nextSimple = runArrowMeasurementPass(() => {
      const segments: SimpleSegment[] = []
      // ONE DOM sweep per update — and per FRAME per container: the merged
      // grid mounts a forward+wrap overlay pair per path over one shared
      // band, so without the frame cache a geometry change cost 2×paths
      // full-DOM sweeps of the same unchanged tree.
      const cellElById = sharedCellIndex(content)
      const { resolveDependencies, otherDependencies: railInputDependencies } =
        partitionReportingAnIssueFsaStep1ToResolveDependencies(dependencies)

      for (const dependency of resolveDependencies) {
        const sourceEl = cellElById.get(dependency.source_cell_id)
        const targetEl = cellElById.get(dependency.target_cell_id)
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

        const style = resolveSegmentStyle(dependency.path_id, pathById)
        segments.push({
          id: dependency.id,
          d,
          colorKey: style.colorKey,
          arrowColor: style.arrowColor,
          opacity: dependency.opacity,
        })
      }

      const { busGroups, fanOutGroups, remaining } = groupDiscoveryRailDependencies(
        railInputDependencies,
        content,
      )

      for (const group of fanOutGroups) {
        const sampleDependency = dependencies.find((entry) =>
          group.branches.some((branch) => branch.dependencyId === entry.id),
        )
        const trunkStyle = resolveSegmentStyle(
          sampleDependency?.path_id ?? '',
          pathById,
        )
        const targetEls = group.branches.map((branch) => branch.targetEl)
        const trunk = buildOverheadRailFanOutTrunkPath(
          group.sourceEl,
          targetEls,
          content,
        )
        if (trunk) {
          segments.push({
            id: `${group.sourceCellId}-trunk`,
            d: trunk,
            colorKey: trunkStyle.colorKey,
            arrowColor: trunkStyle.arrowColor,
            opacity: 1,
            showMarker: false,
          })
        }

        for (const branch of group.branches) {
          const dependency = dependencies.find(
            (entry) => entry.id === branch.dependencyId,
          )
          const branchStyle = resolveSegmentStyle(dependency?.path_id ?? '', pathById)
          const d = buildOverheadRailFanOutDropPath(
            group.sourceEl,
            branch.targetEl,
            content,
          )
          if (!d) continue

          segments.push({
            id: branch.dependencyId,
            d,
            colorKey: branchStyle.colorKey,
            arrowColor: branchStyle.arrowColor,
            opacity: dependency?.opacity ?? 1,
          })
        }
      }

      for (const group of busGroups) {
        const dependenciesInGroup = dependencies.filter((dependency) =>
          group.dependencyIds.includes(dependency.id),
        )
        const byPathId = new Map<
          string,
          { sourceEls: HTMLElement[]; opacity: number; dependencyIds: string[] }
        >()

        for (const dependency of dependenciesInGroup) {
          const sourceEl = cellElById.get(dependency.source_cell_id)
          if (!sourceEl) continue

          const existing = byPathId.get(dependency.path_id)
          if (existing) {
            existing.sourceEls.push(sourceEl)
            existing.dependencyIds.push(dependency.id)
            existing.opacity = Math.max(existing.opacity, dependency.opacity)
          } else {
            byPathId.set(dependency.path_id, {
              sourceEls: [sourceEl],
              opacity: dependency.opacity,
              dependencyIds: [dependency.id],
            })
          }
        }

        for (const [pathId, pathGroup] of byPathId) {
          const style = resolveSegmentStyle(pathId, pathById)
          const targetEl =
            dependenciesInGroup
              .filter((dependency) => dependency.path_id === pathId)
              .map((dependency) => cellElById.get(dependency.target_cell_id))
              .find((el): el is HTMLElement => el !== undefined) ?? group.targetEl

          const d = buildApplicationRegularTutorRailBusPath(
            pathGroup.sourceEls,
            targetEl,
            content,
          )
          if (!d) continue

          segments.push({
            id: `${group.targetCellId}-${pathId}`,
            d,
            colorKey: style.colorKey,
            arrowColor: style.arrowColor,
            opacity: pathGroup.opacity,
          })
        }
      }

      const { pairs, remaining: unpaired } =
        findBidirectionalDependencyPairs(remaining)

      for (const pair of pairs) {
        const cellAEl = cellElById.get(pair.cellAId)
        const cellBEl = cellElById.get(pair.cellBId)
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

        const style = resolveSegmentStyle(pair.first.path_id, pathById)
        segments.push({
          id: `${pair.first.id}-${pair.second.id}`,
          d,
          colorKey: style.colorKey,
          arrowColor: style.arrowColor,
          opacity: pair.first.opacity ?? 1,
          dualMarker: true,
        })
      }

      for (const dependency of unpaired) {
        const sourceEl = cellElById.get(dependency.source_cell_id)
        const targetEl = cellElById.get(dependency.target_cell_id)
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

        const style = resolveSegmentStyle(dependency.path_id, pathById)
        segments.push({
          id: dependency.id,
          d,
          colorKey: style.colorKey,
          arrowColor: style.arrowColor,
          opacity: dependency.opacity,
        })
      }

      return segments
    })

    const nextKey = serializeSegments(nextSimple)
    setSimpleSegments((prev) =>
      serializeSegments(prev) === nextKey ? prev : nextSimple,
    )
    measureSize()
  }, [contentRef, lane, measureSize, pathById, dependencies])

  // Split from the subscription effect below, and BEFORE paint. Every input
  // this reads — cell boxes, the band's extent — is laid out by the same
  // commit that schedules this, so measuring after paint means one frame of
  // arrows drawn against the previous layout. Compare toggles are where that
  // shows: the grid swaps to a different column set and the overlay spends a
  // frame anchored to the old one (#66, #129 item 4).
  //
  // The cost is real — `updateArrows` sweeps the whole band — and a layout
  // effect spends it before the browser paints. Two things make it the right
  // trade anyway: the sweep is already frame-cached (`runArrowMeasurementPass`
  // / `sharedCellIndex`, so a merged grid's overlay pair pays once), and it
  // ran at this exact cadence before, just one frame later. Nothing server-
  // renders — `main.tsx` is a plain `createRoot` — so there is no SSR warning
  // to inherit, and measurement here already uses `useLayoutEffect`
  // (`BlueprintColumnHandles`, `PhaseOverviewPhaseLoopArrow`).
  useLayoutEffect(updateArrows, [updateArrows])

  useEffect(() => {
    const content = contentRef.current
    if (!content) return

    const scrollParent = scrollContainerRef.current ?? content

    // One rAF coalescer for every geometry-invalidating signal — the
    // ResizeObserver included. Resizes arrive in bursts during band
    // relayout, and a synchronous update per notification re-measured the
    // whole overlay several times a frame.
    let raf = 0
    const scheduleUpdate = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(updateArrows)
    }

    // Scrolling is NOT a geometry signal: every box the routers read is
    // root-relative, so scrolling changes no path and no overlay extent. Only
    // the scroll extent itself is worth re-reading, and that is four property
    // reads rather than a full re-route of the band.
    let sizeRaf = 0
    const scheduleSizeUpdate = () => {
      cancelAnimationFrame(sizeRaf)
      sizeRaf = requestAnimationFrame(measureSize)
    }

    const observer = new ResizeObserver(scheduleUpdate)
    observer.observe(content)
    if (scrollParent !== content) {
      observer.observe(scrollParent)
    }

    scrollParent.addEventListener('scroll', scheduleSizeUpdate, {
      passive: true,
    })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(sizeRaf)
      observer.disconnect()
      scrollParent.removeEventListener('scroll', scheduleSizeUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [contentRef, measureSize, scrollContainerRef, updateArrows])

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
    const ids: Record<string, string> = {}
    const colors: Record<string, string> = {}

    for (const segment of simpleSegments) {
      if (!ids[segment.colorKey]) {
        ids[segment.colorKey] = `${markerId}-arrow-${pathColorKeyToMarkerSuffix(segment.colorKey)}`
        colors[segment.colorKey] = segment.arrowColor
      }
    }

    return { markerIds: ids, markerColors: colors }
  }, [markerId, simpleSegments])

  if (simpleSegments.length === 0) return null

  return (
    <svg
      data-blueprint-arrows=""
      className={cn(
        'pointer-events-none absolute overflow-visible',
        // z-0, UNDER the z-1 cells: a run that crosses a cell tucks
        // behind it instead of striking through its face — lines are
        // always behind the blocks. The wrap lane stays above: it rides
        // the empty corridors outside the rows by construction.
        lane === 'forward' ? 'z-0' : 'z-30',
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
        {simpleSegments.map((segment) => (
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

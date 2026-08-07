import {
  useCallback,
  useEffect,
  useId,
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
  findBidirectionalTriggerPairs,
  groupDiscoveryRailTriggers,
  isWrapTrigger,
  partitionReportingAnIssueFsaStep1ToResolveTriggers,
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
  IntegratedBlueprintTrigger,
} from '@/types/integratedBlueprint'
import type { PathType } from '@/types/database'

type ArrowLayer = 'forward' | 'wrap'

type IntegratedPathRef = {
  id: string
  name: string
  path_type: PathType
}

type IntegratedTriggerArrowsProps = {
  triggers: IntegratedBlueprintTrigger[]
  /** Accepted for parity with the band's arrow data; geometry reads the DOM. */
  cells?: IntegratedBlueprintCell[]
  steps?: IntegratedBlueprintStep[]
  paths?: IntegratedPathRef[]
  contentRef: RefObject<HTMLElement | null>
  scrollContainerRef: RefObject<HTMLElement | null>
  layer: ArrowLayer
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

function resolveSegmentStyle(
  pathId: string,
  pathById: Map<string, IntegratedPathRef>,
): { colorKey: string; arrowColor: string } {
  const path = pathById.get(pathId)
  if (!path) {
    return { colorKey: 'happy', arrowColor: getPathTypeArrowColor('happy') }
  }

  const input: PathColorInput = {
    path_type: path.path_type,
    name: path.name,
  }

  return {
    colorKey: getPathColorKey(input),
    arrowColor: getPathArrowColor(input),
  }
}

/**
 * Arrow overlay for a path band: forward and wrap layers, plus the hand-tuned
 * rail routes for the scenarios whose geometry the generic router cannot
 * express. (The integrated grid's fork trunks retired with that grid.)
 */
export function IntegratedTriggerArrows({
  triggers,
  paths = [],
  contentRef,
  scrollContainerRef,
  layer,
}: IntegratedTriggerArrowsProps) {
  const [simpleSegments, setSimpleSegments] = useState<SimpleSegment[]>([])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const markerId = useId().replace(/:/g, '')

  const pathById = useMemo(
    () => new Map(paths.map((path) => [path.id, path])),
    [paths],
  )

  const updateArrows = useCallback(() => {
    const content = contentRef.current
    if (!content || triggers.length === 0) {
      setSimpleSegments([])
      return
    }

    const nextSimple: SimpleSegment[] = []
    // ONE DOM sweep per update: every per-trigger querySelector below used to
    // rescan the whole band (O(triggers × cells)); the index kills that.
    const cellElById = new Map<string, HTMLElement>()
    for (const el of content.querySelectorAll<HTMLElement>(
      '[data-blueprint-cell]',
    )) {
      const id = el.getAttribute('data-blueprint-cell')
      if (id !== null && !cellElById.has(id)) cellElById.set(id, el)
    }
    const { resolveTriggers, otherTriggers: railInputTriggers } =
      partitionReportingAnIssueFsaStep1ToResolveTriggers(triggers)

    for (const trigger of resolveTriggers) {
      const sourceEl = cellElById.get(trigger.source_cell_id)
      const targetEl = cellElById.get(trigger.target_cell_id)
      if (!sourceEl || !targetEl) continue

      const wrap = isWrapTrigger(
        sourceEl,
        targetEl,
        trigger.source_cell_id,
        trigger.target_cell_id,
      )
      if (layer === 'forward' && wrap) continue
      if (layer === 'wrap' && !wrap) continue

      const d = buildReportingAnIssueFrontStageActionStep1ToResolvePath(
        sourceEl,
        targetEl,
        content,
      )
      if (!d) continue

      const style = resolveSegmentStyle(trigger.path_id, pathById)
      nextSimple.push({
        id: trigger.id,
        d,
        colorKey: style.colorKey,
        arrowColor: style.arrowColor,
        opacity: trigger.opacity,
      })
    }

    const { busGroups, fanOutGroups, remaining } = groupDiscoveryRailTriggers(
      railInputTriggers,
      content,
    )

    for (const group of fanOutGroups) {
      const sampleTrigger = triggers.find((entry) =>
        group.branches.some((branch) => branch.triggerId === entry.id),
      )
      const trunkStyle = resolveSegmentStyle(
        sampleTrigger?.path_id ?? '',
        pathById,
      )
      const targetEls = group.branches.map((branch) => branch.targetEl)
      const trunk = buildOverheadRailFanOutTrunkPath(
        group.sourceEl,
        targetEls,
        content,
      )
      if (trunk) {
        nextSimple.push({
          id: `${group.sourceCellId}-trunk`,
          d: trunk,
          colorKey: trunkStyle.colorKey,
          arrowColor: trunkStyle.arrowColor,
          opacity: 1,
          showMarker: false,
        })
      }

      for (const branch of group.branches) {
        const trigger = triggers.find(
          (entry) => entry.id === branch.triggerId,
        )
        const branchStyle = resolveSegmentStyle(trigger?.path_id ?? '', pathById)
        const d = buildOverheadRailFanOutDropPath(
          group.sourceEl,
          branch.targetEl,
          content,
        )
        if (!d) continue

        nextSimple.push({
          id: branch.triggerId,
          d,
          colorKey: branchStyle.colorKey,
          arrowColor: branchStyle.arrowColor,
          opacity: trigger?.opacity ?? 1,
        })
      }
    }

    for (const group of busGroups) {
      const triggersInGroup = triggers.filter((trigger) =>
        group.triggerIds.includes(trigger.id),
      )
      const byPathId = new Map<
        string,
        { sourceEls: HTMLElement[]; opacity: number; triggerIds: string[] }
      >()

      for (const trigger of triggersInGroup) {
        const sourceEl = cellElById.get(trigger.source_cell_id)
        if (!sourceEl) continue

        const existing = byPathId.get(trigger.path_id)
        if (existing) {
          existing.sourceEls.push(sourceEl)
          existing.triggerIds.push(trigger.id)
          existing.opacity = Math.max(existing.opacity, trigger.opacity)
        } else {
          byPathId.set(trigger.path_id, {
            sourceEls: [sourceEl],
            opacity: trigger.opacity,
            triggerIds: [trigger.id],
          })
        }
      }

      for (const [pathId, pathGroup] of byPathId) {
        const style = resolveSegmentStyle(pathId, pathById)
        const targetEl =
          triggersInGroup
            .filter((trigger) => trigger.path_id === pathId)
            .map((trigger) => cellElById.get(trigger.target_cell_id))
            .find((el): el is HTMLElement => el !== undefined) ?? group.targetEl

        const d = buildApplicationRegularTutorRailBusPath(
          pathGroup.sourceEls,
          targetEl,
          content,
        )
        if (!d) continue

        nextSimple.push({
          id: `${group.targetCellId}-${pathId}`,
          d,
          colorKey: style.colorKey,
          arrowColor: style.arrowColor,
          opacity: pathGroup.opacity,
        })
      }
    }

    const { pairs, remaining: unpaired } =
      findBidirectionalTriggerPairs(remaining)

    for (const pair of pairs) {
      const cellAEl = cellElById.get(pair.cellAId)
      const cellBEl = cellElById.get(pair.cellBId)
      if (!cellAEl || !cellBEl) continue

      const wrap = isWrapTrigger(
        cellAEl,
        cellBEl,
        pair.cellAId,
        pair.cellBId,
      )
      if (layer === 'forward' && wrap) continue
      if (layer === 'wrap' && !wrap) continue

      const d = buildBidirectionalArrowPath(cellAEl, cellBEl, content)
      if (!d) continue

      const style = resolveSegmentStyle(pair.first.path_id, pathById)
      nextSimple.push({
        id: `${pair.first.id}-${pair.second.id}`,
        d,
        colorKey: style.colorKey,
        arrowColor: style.arrowColor,
        opacity: pair.first.opacity ?? 1,
        dualMarker: true,
      })
    }

    for (const trigger of unpaired) {
      const sourceEl = cellElById.get(trigger.source_cell_id)
      const targetEl = cellElById.get(trigger.target_cell_id)
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
        trigger.id,
      )
      if (!d) continue

      const style = resolveSegmentStyle(trigger.path_id, pathById)
      nextSimple.push({
        id: trigger.id,
        d,
        colorKey: style.colorKey,
        arrowColor: style.arrowColor,
        opacity: trigger.opacity,
      })
    }

    setSimpleSegments(nextSimple)
    setSize({
      width: Math.max(content.scrollWidth, content.offsetWidth, 1),
      height: Math.max(content.scrollHeight, content.offsetHeight, 1),
    })
  }, [contentRef, layer, pathById, triggers])

  useEffect(() => {
    updateArrows()
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

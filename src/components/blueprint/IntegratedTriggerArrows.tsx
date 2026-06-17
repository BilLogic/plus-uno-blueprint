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
  groupDiscoveryRailTriggers,
  isWrapTrigger,
} from '@/lib/blueprintArrowGeometry'
import {
  buildIntegratedForkDetourBranchPath,
  buildIntegratedForkStraightBranchPath,
  buildIntegratedForkTrunkPath,
  detectIntegratedForkGroups,
  getIntegratedForkBranchStrokeWidth,
  getIntegratedForkCircleCenter,
  getIntegratedForkNodeOpacity,
  getIntegratedForkTrunkPathType,
  getIntegratedForkTrunkStrokeWidth,
  INTEGRATED_FORK_THEME,
  pickStraightForkBranch,
  shouldUseIntegratedForkDetour,
} from '@/lib/integratedForkArrowGeometry'
import { getPathTypeArrowColor } from '@/lib/pathTypeTheme'
import { cn } from '@/lib/utils'
import {
  BlueprintArrowMarkerDefs,
  blueprintArrowPathProps,
  BLUEPRINT_ARROW_PATH_TYPES,
} from '@/components/blueprint/BlueprintArrowMarkerDefs'
import type {
  IntegratedBlueprintCell,
  IntegratedBlueprintStep,
  IntegratedBlueprintTrigger,
} from '@/types/integratedBlueprint'
import type { PathType } from '@/types/database'

type ArrowLayer = 'forward' | 'wrap'

type IntegratedTriggerArrowsProps = {
  triggers: IntegratedBlueprintTrigger[]
  cells: IntegratedBlueprintCell[]
  steps: IntegratedBlueprintStep[]
  contentRef: RefObject<HTMLElement | null>
  scrollContainerRef: RefObject<HTMLElement | null>
  layer: ArrowLayer
}

type SimpleSegment = {
  id: string
  d: string
  pathType: PathType
  opacity: number
}

type ForkRenderGroup = {
  id: string
  trunkPath: string
  trunkPathType: PathType
  circle: { cx: number; cy: number }
  branches: SimpleSegment[]
}

const PATH_TYPES = BLUEPRINT_ARROW_PATH_TYPES

export function IntegratedTriggerArrows({
  triggers,
  cells,
  steps,
  contentRef,
  scrollContainerRef,
  layer,
}: IntegratedTriggerArrowsProps) {
  const [simpleSegments, setSimpleSegments] = useState<SimpleSegment[]>([])
  const [forkGroups, setForkGroups] = useState<ForkRenderGroup[]>([])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const markerId = useId().replace(/:/g, '')

  const { groups: forkMeta, forkTriggerIds } = useMemo(
    () => detectIntegratedForkGroups(triggers, cells, steps),
    [triggers, cells, steps],
  )

  const updateArrows = useCallback(() => {
    const content = contentRef.current
    if (!content || triggers.length === 0) {
      setSimpleSegments([])
      setForkGroups([])
      return
    }

    const nextSimple: SimpleSegment[] = []
    const nextForks: ForkRenderGroup[] = []
    const nonForkTriggers = triggers.filter((t) => !forkTriggerIds.has(t.id))
    const { busGroups, remaining } = groupDiscoveryRailTriggers(
      nonForkTriggers,
      content,
    )

    for (const group of busGroups) {
      const sampleTrigger = nonForkTriggers.find((t) =>
        group.triggerIds.includes(t.id),
      )
      if (!sampleTrigger) continue

      const d = buildApplicationRegularTutorRailBusPath(
        group.sourceEls,
        group.targetEl,
        content,
      )
      if (!d) continue

      nextSimple.push({
        id: group.triggerIds.join('-'),
        d,
        pathType: sampleTrigger.path_type,
        opacity: sampleTrigger.opacity,
      })
    }

    for (const group of forkMeta) {
      const sampleBranch = group.branches[0]
      const sourceEl = content.querySelector<HTMLElement>(
        `[data-blueprint-cell="${sampleBranch.source_cell_id}"]`,
      )
      if (!sourceEl) continue

      const circle = getIntegratedForkCircleCenter(sourceEl, content)
      const trunkPath = buildIntegratedForkTrunkPath(sourceEl, circle, content)
      if (!trunkPath) continue

      const straightBranch = pickStraightForkBranch(group, cells, steps)
      const branchSegments: SimpleSegment[] = []

      for (const branch of group.branches) {
        const targetEl = content.querySelector<HTMLElement>(
          `[data-blueprint-cell="${branch.target_cell_id}"]`,
        )
        if (!targetEl) continue

        const wrap = isWrapTrigger(
          sourceEl,
          targetEl,
          branch.source_cell_id,
          branch.target_cell_id,
        )
        if (layer === 'forward' && wrap) continue
        if (layer === 'wrap' && !wrap) continue

        const useDetour = shouldUseIntegratedForkDetour(
          branch,
          cells,
          steps,
          group,
        )
        const d = useDetour
          ? buildIntegratedForkDetourBranchPath(
              circle,
              sourceEl,
              targetEl,
              content,
            )
          : buildIntegratedForkStraightBranchPath(
              circle,
              sourceEl,
              targetEl,
              content,
            )

        if (!d) continue

        branchSegments.push({
          id: branch.id,
          d,
          pathType: branch.path_type,
          opacity: branch.opacity,
        })
      }

      if (branchSegments.length === 0) continue

      nextForks.push({
        id: group.id,
        trunkPath,
        trunkPathType: straightBranch.path_type,
        circle: { cx: circle.x, cy: circle.y },
        branches: branchSegments,
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

      nextSimple.push({
        id: trigger.id,
        d,
        pathType: trigger.path_type,
        opacity: trigger.opacity,
      })
    }

    setSimpleSegments(nextSimple)
    setForkGroups(nextForks)
    setSize({
      width: Math.max(content.scrollWidth, content.offsetWidth, 1),
      height: Math.max(content.scrollHeight, content.offsetHeight, 1),
    })
  }, [contentRef, forkMeta, forkTriggerIds, layer, triggers])

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
        PATH_TYPES.map((type) => [type, `${markerId}-arrow-${type}`]),
      ) as Record<PathType, string>,
    [markerId],
  )

  if (simpleSegments.length === 0 && forkGroups.length === 0) return null

  const {
    nodeRadius,
    nodeFill,
    nodeHaloRadius,
    nodeHaloFill,
  } = INTEGRATED_FORK_THEME

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
        {simpleSegments.map((segment) => (
          <g key={segment.id} opacity={segment.opacity}>
            <path
              d={segment.d}
              {...blueprintArrowPathProps(segment.pathType)}
              markerEnd={`url(#${markerIds[segment.pathType]})`}
            />
          </g>
        ))}
        {forkGroups.map((group) => {
          const nodeOpacity = getIntegratedForkNodeOpacity(group.branches)
          const trunkPathType = getIntegratedForkTrunkPathType(
            group.branches,
            group.trunkPathType,
          )

          return (
          <g key={group.id}>
            {group.branches.map((branch) => (
              <g key={branch.id} opacity={branch.opacity}>
                <path
                  d={branch.d}
                  {...blueprintArrowPathProps(branch.pathType)}
                  strokeWidth={getIntegratedForkBranchStrokeWidth(branch.opacity)}
                  markerEnd={`url(#${markerIds[branch.pathType]})`}
                />
              </g>
            ))}
            <g opacity={nodeOpacity}>
              <path
                d={group.trunkPath}
                fill="none"
                stroke={getPathTypeArrowColor(trunkPathType)}
                strokeWidth={getIntegratedForkTrunkStrokeWidth(nodeOpacity)}
                strokeLinecap="round"
              />
              <circle
                cx={group.circle.cx}
                cy={group.circle.cy}
                r={nodeHaloRadius}
                fill={nodeHaloFill}
              />
              <circle
                cx={group.circle.cx}
                cy={group.circle.cy}
                r={nodeRadius}
                fill={nodeFill}
              />
            </g>
          </g>
          )
        })}
      </g>
    </svg>
  )
}

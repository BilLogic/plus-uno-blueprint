import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { useCanvasBlueprints } from '@/hooks/useCanvasBlueprints'
import { usePathSelection } from '@/hooks/usePathSelection'
import { getStackedCanvasArtboardSize } from '@/lib/blueprintLayout'
import {
  integratedBlueprintToLayoutData,
  mergeIntegratedBlueprint,
} from '@/lib/mergeIntegratedBlueprint'
import {
  getSlideDisplayLabel,
  isSubslide,
  type EditorMode,
  type Slide,
  type SlideViewType,
} from '@/types/slides'
import { CanvasBlueprintArtboard } from '@/components/editor/CanvasBlueprintArtboard'
import { CanvasSlideConnectors } from '@/components/editor/CanvasSlideConnectors'
import { SlideArtboard } from '@/components/editor/SlideArtboard'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEFAULT_ARTBOARD_SIZE,
  computeSlideLayouts,
} from '@/lib/slideLayout'
import type { BlueprintData } from '@/types/blueprint'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 4
const GRID_BASE = 20

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export function CanvasModeView() {
  const {
    mode,
    slides,
    activeSlideId,
    setActiveSlideId,
    activeSlide,
    slidesLoading,
    getScenarioDisplayViewType,
    setScenarioDisplayViewType,
  } = useEditor()

  const scenarioIds = useMemo(
    () => slides.filter((s) => isSubslide(s)).map((s) => s.id),
    [slides],
  )
  const {
    blueprintsByScenario,
    pathsByScenario,
    blueprintsByPathId,
    loading: blueprintsLoading,
    error: blueprintsError,
  } = useCanvasBlueprints(scenarioIds)

  const compareScenarioId = useMemo(() => {
    for (const slide of slides) {
      if (!isSubslide(slide)) continue
      const paths = pathsByScenario.get(slide.id) ?? []
      if (paths.length > 1) return slide.id
    }
    return undefined
  }, [slides, pathsByScenario])

  const comparePaths = useMemo(
    () =>
      compareScenarioId
        ? pathsByScenario.get(compareScenarioId) ?? []
        : [],
    [compareScenarioId, pathsByScenario],
  )
  const { selectedPathIds, togglePathSelection } =
    usePathSelection(comparePaths)

  const compareAllBlueprints = useMemo(
    () =>
      compareScenarioId
        ? comparePaths
            .map((path) => blueprintsByPathId.get(path.id))
            .filter(
              (blueprint): blueprint is BlueprintData => blueprint !== undefined,
            )
        : [],
    [compareScenarioId, comparePaths, blueprintsByPathId],
  )

  const compareIntegratedBlueprint = useMemo(
    () => mergeIntegratedBlueprint(compareAllBlueprints, selectedPathIds),
    [compareAllBlueprints, selectedPathIds],
  )

  const compareBlueprints = useMemo(
    () =>
      compareScenarioId
        ? comparePaths
            .filter((path) => selectedPathIds.includes(path.id))
            .map((path) => blueprintsByPathId.get(path.id))
            .filter(
              (blueprint): blueprint is BlueprintData => blueprint !== undefined,
            )
        : [],
    [compareScenarioId, comparePaths, selectedPathIds, blueprintsByPathId],
  )

  const compareSlide = useMemo(
    () =>
      compareScenarioId
        ? slides.find((slide) => slide.id === compareScenarioId)
        : undefined,
    [compareScenarioId, slides],
  )

  const compareUsesSideBySideLayout =
    compareSlide !== undefined &&
    getScenarioDisplayViewType(compareSlide) === 'side-by-side'

  const compareUsesIntegratedLayout =
    compareSlide !== undefined &&
    getScenarioDisplayViewType(compareSlide) === 'integrated'

  const layoutOverrides = useMemo(() => {
    if (!compareScenarioId) {
      return new Map()
    }

    if (compareUsesIntegratedLayout && compareIntegratedBlueprint) {
      return new Map([
        [
          compareScenarioId,
          getStackedCanvasArtboardSize(
            [integratedBlueprintToLayoutData(compareIntegratedBlueprint)],
            {
              includeScenarioHeader: true,
              compact: true,
            },
          ),
        ],
      ])
    }

    if (
      compareBlueprints.length > 0 &&
      compareUsesSideBySideLayout
    ) {
      return new Map([
        [
          compareScenarioId,
          getStackedCanvasArtboardSize(compareBlueprints, {
            includeScenarioHeader: true,
            compact: true,
          }),
        ],
      ])
    }

    if (
      compareUsesSideBySideLayout &&
      comparePaths.length > 0 &&
      selectedPathIds.length === 0
    ) {
      return new Map([[compareScenarioId, DEFAULT_ARTBOARD_SIZE]])
    }

    return new Map()
  }, [
    compareBlueprints,
    compareIntegratedBlueprint,
    compareScenarioId,
    comparePaths.length,
    compareUsesIntegratedLayout,
    compareUsesSideBySideLayout,
    selectedPathIds.length,
  ])

  const handleScenarioViewTypeChange = useCallback(
    (slide: Slide, viewType: SlideViewType) => {
      setScenarioDisplayViewType(slide.id, viewType)
    },
    [setScenarioDisplayViewType],
  )

  const handleCompareTogglePath = useCallback(
    (pathId: string) => {
      togglePathSelection(pathId)
    },
    [togglePathSelection],
  )

  const layouts = useMemo(
    () => computeSlideLayouts(slides, blueprintsByScenario, layoutOverrides),
    [slides, blueprintsByScenario, layoutOverrides],
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const transformRef = useRef({ pan: { x: 0, y: 0 }, zoom: 1 })
  const prevModeRef = useRef<EditorMode | null>(null)
  const prevActiveSlideIdRef = useRef(activeSlideId)

  transformRef.current = { pan, zoom }

  const focusSlide = useCallback(
    (slideId: string, z?: number) => {
      const el = containerRef.current
      if (!el) return
      const scale = z ?? transformRef.current.zoom
      const layout = layouts.get(slideId)
      if (!layout) return
      setPan({
        x: el.clientWidth / 2 - (layout.x + layout.width / 2) * scale,
        y: el.clientHeight / 2 - (layout.y + layout.height / 2) * scale,
      })
    },
    [layouts],
  )

  useEffect(() => {
    const enteringCanvas =
      mode === 'canvas' && prevModeRef.current !== 'canvas'
    prevModeRef.current = mode
    if (!enteringCanvas) return
    focusSlide(activeSlideId, transformRef.current.zoom)
  }, [mode, activeSlideId, focusSlide])

  useEffect(() => {
    if (mode !== 'canvas') return
    if (prevActiveSlideIdRef.current === activeSlideId) return
    prevActiveSlideIdRef.current = activeSlideId
    focusSlide(activeSlideId, transformRef.current.zoom)
  }, [activeSlideId, focusSlide, mode])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const zoomAtPoint = (clientX: number, clientY: number, scaleFactor: number) => {
      const rect = el.getBoundingClientRect()
      const mx = clientX - rect.left
      const my = clientY - rect.top
      const { pan: p, zoom: z } = transformRef.current
      const newZoom = clampZoom(z * scaleFactor)
      const worldX = (mx - p.x) / z
      const worldY = (my - p.y) / z
      setZoom(newZoom)
      setPan({
        x: mx - worldX * newZoom,
        y: my - worldY * newZoom,
      })
    }

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const scaleFactor = Math.exp(-e.deltaY * 0.01)
        zoomAtPoint(e.clientX, e.clientY, scaleFactor)
        return
      }

      if (e.deltaX !== 0 || e.deltaY !== 0) {
        e.preventDefault()
        const { pan: p } = transformRef.current
        setPan({
          x: p.x - e.deltaX,
          y: p.y - e.deltaY,
        })
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (
        target.closest('[data-canvas-artboard]') ||
        target.closest('[data-canvas-blueprint]')
      ) {
        return
      }
      containerRef.current?.setPointerCapture(e.pointerId)
      setIsPanning(true)
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      }
    },
    [pan.x, pan.y],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning) return
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      })
    },
    [isPanning],
  )

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsPanning(false)
    containerRef.current?.releasePointerCapture(e.pointerId)
  }, [])

  const gridSize = GRID_BASE * zoom

  if (slidesLoading) {
    return (
      <div className="relative flex h-full min-h-0 flex-1 items-center justify-center bg-muted/30">
        <Skeleton className="h-48 w-64" />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-full min-h-0 flex-1 overflow-hidden bg-[#e8e8e8] touch-none dark:bg-[#1a1a1a]',
        isPanning ? 'cursor-grabbing' : 'cursor-grab',
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle, var(--border) 1px, transparent 1px)`,
          backgroundSize: `${gridSize}px ${gridSize}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />
      <div
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        <CanvasSlideConnectors
          slides={slides}
          blueprintsByScenario={blueprintsByScenario}
          layoutOverrides={layoutOverrides}
        />
        {slides.map((slide) => {
          const layout = layouts.get(slide.id)!
          const isActive = slide.id === activeSlideId

          if (isSubslide(slide)) {
            const scenarioPaths = pathsByScenario.get(slide.id) ?? []
            const isCompareScenario = slide.id === compareScenarioId
            const displayViewType = getScenarioDisplayViewType(slide)
            const useIntegratedLayout =
              isCompareScenario && displayViewType === 'integrated'
            const noPathsSelected =
              isCompareScenario &&
              !useIntegratedLayout &&
              scenarioPaths.length > 0 &&
              selectedPathIds.length === 0
            const scenarioBlueprints =
              isCompareScenario && !noPathsSelected && !useIntegratedLayout
                ? compareBlueprints
                : undefined
            const useSideBySideLayout =
              isCompareScenario &&
              displayViewType === 'side-by-side' &&
              compareBlueprints.length > 0
            const blueprint = noPathsSelected
              ? null
              : scenarioBlueprints?.[0] ??
                blueprintsByScenario.get(slide.id) ??
                null
            const blueprintLoading =
              blueprintsLoading &&
              (isCompareScenario
                ? useIntegratedLayout
                  ? compareAllBlueprints.length < comparePaths.length
                  : compareBlueprints.length === 0 &&
                    selectedPathIds.length > 0
                : blueprint === null)

            return (
              <CanvasBlueprintArtboard
                key={slide.id}
                slide={slide}
                slides={slides}
                blueprint={blueprint}
                blueprints={scenarioBlueprints}
                integratedBlueprint={
                  isCompareScenario ? compareIntegratedBlueprint : null
                }
                paths={isCompareScenario ? scenarioPaths : []}
                selectedPathIds={
                  isCompareScenario ? selectedPathIds : []
                }
                onTogglePath={
                  isCompareScenario ? handleCompareTogglePath : undefined
                }
                viewType={displayViewType}
                onViewTypeChange={(viewType) =>
                  handleScenarioViewTypeChange(slide, viewType)
                }
                useSideBySideLayout={useSideBySideLayout}
                useIntegratedLayout={useIntegratedLayout}
                blueprintLoading={blueprintLoading}
                isActive={isActive}
                onSelect={() => setActiveSlideId(slide.id)}
                className="absolute"
                style={{
                  left: layout.x,
                  top: layout.y,
                  width: layout.width,
                  height: layout.height,
                }}
              />
            )
          }

          return (
            <SlideArtboard
              key={slide.id}
              slide={slide}
              variant="canvas"
              isActive={isActive}
              onSelect={() => setActiveSlideId(slide.id)}
              className="absolute"
              style={{
                left: layout.x,
                top: layout.y,
                width: layout.width,
                height: layout.height,
              }}
            />
          )
        })}
      </div>
      <p className="pointer-events-none absolute bottom-3 left-3 max-w-lg rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm">
        {getSlideDisplayLabel(activeSlide, slides)}
        {blueprintsError ? ` · ${blueprintsError}` : ''}
        {' · Pinch to zoom · Scroll to pan'}
        {isSubslide(activeSlide) ? ' · Scroll inside blueprint to explore' : ''}
      </p>
      <p className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-background/80 px-2 py-1 font-mono text-xs text-muted-foreground backdrop-blur-sm">
        {Math.round(zoom * 100)}%
      </p>
    </div>
  )
}

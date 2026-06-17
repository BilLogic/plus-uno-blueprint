import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CSSProperties } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { CanvasSlideHeader } from '@/components/editor/SlideStickyHeader'
import { useCanvasBlueprints } from '@/hooks/useCanvasBlueprints'
import { usePathSelectionsByScenario } from '@/hooks/usePathSelection'
import { getStackedCanvasArtboardSize, type ArtboardSize } from '@/lib/blueprintLayout'
import { defaultSelectedPathIds, itemsInSelectionOrder } from '@/lib/pathSelection'
import { mergeIntegratedBlueprint } from '@/lib/mergeIntegratedBlueprint'
import { getIntegratedCanvasArtboardSize } from '@/lib/sideBySideCompareLayout'
import {
  isSubslide,
  type EditorMode,
  type Slide,
  type SlideViewType,
} from '@/types/slides'
import { CanvasBlueprintArtboard } from '@/components/editor/CanvasBlueprintArtboard'
import { BLUEPRINT_THEME } from '@/lib/blueprintTheme'
import { CanvasSlideConnectors } from '@/components/editor/CanvasSlideConnectors'
import { EditorSequenceNav } from '@/components/editor/EditorSequenceNav'
import { EditorZoomIndicator } from '@/components/editor/EditorZoomIndicator'
import { SlideArtboard } from '@/components/editor/SlideArtboard'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CANVAS_SLIDE_HEADER_GAP,
  DEFAULT_ARTBOARD_SIZE,
  computeSlideLayouts,
  type SlideLayout,
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

function getCanvasHeaderStyle(layout: SlideLayout): CSSProperties {
  return {
    left: layout.x,
    top: layout.y - CANVAS_SLIDE_HEADER_GAP,
    width: layout.width,
    transform: 'translateY(-100%)',
  }
}

export function CanvasModeView() {
  const {
    mode,
    slides,
    activeSlideId,
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
  } = useCanvasBlueprints(scenarioIds)

  const { selections, getSelectedPathIds, togglePathSelection } =
    usePathSelectionsByScenario(pathsByScenario)

  const layoutOverrides = useMemo(() => {
    const overrides = new Map<string, ArtboardSize>()

    for (const slide of slides) {
      if (!isSubslide(slide)) continue

      const scenarioPaths = pathsByScenario.get(slide.id) ?? []
      if (scenarioPaths.length === 0) continue

      const displayViewType = getScenarioDisplayViewType(slide)
      const hasPathFilters = scenarioPaths.length > 1
      const selectedPathIds = hasPathFilters ? getSelectedPathIds(slide.id) : []
      const scenarioAllBlueprints = scenarioPaths
        .map((path) => blueprintsByPathId.get(path.id))
        .filter(
          (blueprint): blueprint is BlueprintData => blueprint !== undefined,
        )

      if (scenarioAllBlueprints.length === 0) continue

      if (displayViewType === 'integrated') {
        const pathIdsForMerge =
          selectedPathIds.length > 0
            ? selectedPathIds
            : defaultSelectedPathIds(scenarioPaths)
        const integrated = mergeIntegratedBlueprint(
          scenarioAllBlueprints,
          pathIdsForMerge,
        )
        if (integrated) {
          overrides.set(
            slide.id,
            getIntegratedCanvasArtboardSize(integrated, { compact: true }),
          )
        }
        continue
      }

      if (displayViewType === 'side-by-side') {
        const pathIdsForDisplay =
          selectedPathIds.length > 0
            ? selectedPathIds
            : defaultSelectedPathIds(scenarioPaths)
        const visible = itemsInSelectionOrder(pathIdsForDisplay, (id) =>
          blueprintsByPathId.get(id),
        )
        if (visible.length > 0) {
          overrides.set(
            slide.id,
            getStackedCanvasArtboardSize(visible, { compact: true }),
          )
        } else if (hasPathFilters) {
          overrides.set(slide.id, DEFAULT_ARTBOARD_SIZE)
        }
      }
    }

    return overrides
  }, [
    slides,
    pathsByScenario,
    blueprintsByPathId,
    getSelectedPathIds,
    getScenarioDisplayViewType,
    selections,
  ])

  const handleScenarioViewTypeChange = useCallback(
    (slide: Slide, viewType: SlideViewType) => {
      setScenarioDisplayViewType(slide.id, viewType)
    },
    [setScenarioDisplayViewType],
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
        target.closest('[data-canvas-blueprint]') ||
        target.closest('[data-editor-mode-toggle]') ||
        target.closest('[data-slide-sticky-header]')
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

  const canvasWorld = (
    <>
      <CanvasSlideConnectors
        slides={slides}
        blueprintsByScenario={blueprintsByScenario}
        layoutOverrides={layoutOverrides}
      />
      {slides.map((slide) => {
        const layout = layouts.get(slide.id)!

        if (isSubslide(slide)) {
          const scenarioPaths = pathsByScenario.get(slide.id) ?? []
          const hasPathFilters = scenarioPaths.length > 1
          const selectedPathIds = hasPathFilters
            ? getSelectedPathIds(slide.id)
            : []
          const displayViewType = getScenarioDisplayViewType(slide)
          const useIntegratedLayout =
            hasPathFilters && displayViewType === 'integrated'
          const noPathsSelected =
            hasPathFilters &&
            !useIntegratedLayout &&
            selectedPathIds.length === 0
          const scenarioAllBlueprints = hasPathFilters
            ? scenarioPaths
                .map((path) => blueprintsByPathId.get(path.id))
                .filter(
                  (blueprint): blueprint is BlueprintData =>
                    blueprint !== undefined,
                )
            : []
          const integratedBlueprint = useIntegratedLayout
            ? mergeIntegratedBlueprint(
                scenarioAllBlueprints,
                selectedPathIds,
              )
            : null
          const scenarioBlueprints =
            hasPathFilters && !noPathsSelected && !useIntegratedLayout
              ? itemsInSelectionOrder(selectedPathIds, (id) =>
                  blueprintsByPathId.get(id),
                )
              : undefined
          const useSideBySideLayout =
            hasPathFilters &&
            displayViewType === 'side-by-side' &&
            (scenarioBlueprints?.length ?? 0) > 0
          const blueprint = noPathsSelected
            ? null
            : scenarioBlueprints?.[0] ??
              blueprintsByScenario.get(slide.id) ??
              null
          const blueprintLoading =
            blueprintsLoading &&
            (hasPathFilters
              ? useIntegratedLayout
                ? scenarioAllBlueprints.length < scenarioPaths.length
                : (scenarioBlueprints?.length ?? 0) === 0 &&
                  selectedPathIds.length > 0
              : blueprint === null)

          return (
            <Fragment key={slide.id}>
              <CanvasSlideHeader
                slide={slide}
                slides={slides}
                viewType={displayViewType}
                onViewTypeChange={(viewType) =>
                  handleScenarioViewTypeChange(slide, viewType)
                }
                paths={scenarioPaths}
                selectedPathIds={selectedPathIds}
                onTogglePath={(pathId) =>
                  togglePathSelection(slide.id, pathId)
                }
                style={getCanvasHeaderStyle(layout)}
              />
              <CanvasBlueprintArtboard
                slide={slide}
                slides={slides}
                blueprint={blueprint}
                blueprints={scenarioBlueprints}
                integratedBlueprint={integratedBlueprint}
                selectedPathIds={selectedPathIds}
                hasPathFilters={hasPathFilters}
                useSideBySideLayout={useSideBySideLayout}
                useIntegratedLayout={
                  useIntegratedLayout && integratedBlueprint !== null
                }
                blueprintLoading={blueprintLoading}
                className="absolute"
                style={{
                  left: layout.x,
                  top: layout.y,
                  width: layout.width,
                  height: layout.height,
                }}
              />
            </Fragment>
          )
        }

        return (
          <Fragment key={slide.id}>
            <CanvasSlideHeader
              slide={slide}
              slides={slides}
              viewType={getScenarioDisplayViewType(slide)}
              onViewTypeChange={(viewType) =>
                handleScenarioViewTypeChange(slide, viewType)
              }
              paths={[]}
              selectedPathIds={[]}
              style={getCanvasHeaderStyle(layout)}
            />
            <SlideArtboard
              slide={slide}
              variant="canvas"
              className="absolute"
              style={{
                left: layout.x,
                top: layout.y,
                width: layout.width,
                height: layout.height,
              }}
            />
          </Fragment>
        )
      })}
    </>
  )

  if (slidesLoading) {
    return (
      <div className="relative h-full min-h-0 flex-1">
        <div className="flex h-full items-center justify-center bg-muted/30">
          <Skeleton className="h-48 w-64" />
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full min-h-0 flex-1">
      <div
        ref={containerRef}
        className={cn(
          'relative h-full min-h-0 overflow-hidden touch-none dark:bg-[#1C1C1E]',
          isPanning && 'cursor-grabbing',
        )}
        style={{ backgroundColor: BLUEPRINT_THEME.viewportPad }}
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
          {canvasWorld}
        </div>
      </div>

      <EditorSequenceNav />
      <EditorZoomIndicator zoom={zoom} />
    </div>
  )
}

import { useCallback, useMemo } from 'react'
import { BlueprintCellDetailPanel } from '@/components/blueprint/BlueprintCellDetailPanel'
import { BlueprintSlideContent } from '@/components/blueprint/BlueprintSlideContent'
import { CanvasEmptyState } from '@/components/editor/CanvasEmptyState'
import {
  SlideCanvasLoadingSkeleton,
  SlideNavLoadingSkeleton,
} from '@/components/editor/EditorLoadingSkeletons'
import { SlideStickyHeader } from '@/components/editor/SlideStickyHeader'
import { ZoomPanViewport } from '@/components/editor/ZoomPanViewport'
import { BlueprintCellDetailProvider } from '@/contexts/BlueprintCellDetailContext'
import { CanvasZoomChromeProvider } from '@/contexts/CanvasZoomChromeContext'
import { useEditor } from '@/contexts/EditorContext'
import {
  getPhaseScenarioIds,
  usePhaseBlueprintFilters,
} from '@/hooks/usePhaseBlueprintFilters'
import { useScenarioBlueprint } from '@/hooks/useScenarioBlueprint'
import { isBlueprintCellDetailEnabled } from '@/lib/blueprintDisplayFlags'
import { SlicesSidebarSection } from '@/components/editor/SlicesSidebarSection'
import { SlideNav } from '@/components/editor/SlideNav'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
} from '@/components/ui/sidebar'
import { useViewState } from '@/contexts/viewStateStore'
import {
  getBlueprintScenarioId,
  isSubslide,
} from '@/types/nav'

export function SlideModeSidebarNav() {
  const {
    slides,
    activeSlideId,
    openDetail,
    enterCanvas,
    view,
    slidesLoading,
    slidesError,
  } = useEditor()
  const { activeKey, activateTab } = useViewState()

  // The phase/scenario nav always drives the app-level (blueprint tab)
  // editor state. When another tab is active that would be invisible, so
  // selecting a phase/scenario also brings the blueprint tab forward.
  const handleSelect = useCallback(
    (slideId: string) => {
      if (activeKey !== 'blueprint') activateTab('blueprint')
      openDetail(slideId)
    },
    [activateTab, activeKey, openDetail],
  )
  const handleOverview = useCallback(() => {
    if (activeKey !== 'blueprint') activateTab('blueprint')
    enterCanvas()
  }, [activateTab, activeKey, enterCanvas])

  return (
    <SidebarContent className="px-2 pb-1 pt-0.5">
      {slidesError && (
        <Alert variant="destructive" className="mb-2">
          <AlertTitle className="text-xs">Phases</AlertTitle>
          <AlertDescription className="text-xs">{slidesError}</AlertDescription>
        </Alert>
      )}
      {slidesLoading ? (
        <SidebarGroup>
          <SidebarGroupContent>
            <SlideNavLoadingSkeleton />
          </SidebarGroupContent>
        </SidebarGroup>
      ) : (
        <SlideNav
          slides={slides}
          activeSlideId={activeSlideId}
          onSelect={handleSelect}
          onOverview={handleOverview}
          isOverviewActive={view === 'home'}
          isHome={view !== 'detail'}
        />
      )}
      <SlicesSidebarSection />
    </SidebarContent>
  )
}

export function SlideModeMain() {
  const {
    activeSlide,
    activeSlideId,
    slides,
    slidesLoading,
    getScenarioDisplayViewType,
    setScenarioDisplayViewType,
  } = useEditor()

  const scenarioId = getBlueprintScenarioId(activeSlide)
  const phaseScenarioIds = useMemo(() => {
    if (!activeSlide || isSubslide(activeSlide)) return []
    return getPhaseScenarioIds(activeSlide, slides)
  }, [activeSlide, slides])
  const isPhaseDetail = phaseScenarioIds.length > 0

  const phaseFilters = usePhaseBlueprintFilters({
    scenarioIds: phaseScenarioIds,
    slides,
    enabled: isPhaseDetail,
    getScenarioDisplayViewType,
    setScenarioDisplayViewType,
  })

  const scenarioBlueprint = useScenarioBlueprint(
    isPhaseDetail ? undefined : scenarioId,
  )

  const headerPaths = isPhaseDetail
    ? phaseFilters.filterPaths
    : scenarioBlueprint.paths
  const headerSelectedPathIds = isPhaseDetail
    ? phaseFilters.filterSelectedPathIds
    : scenarioBlueprint.selectedPathIds
  const handleTogglePath = isPhaseDetail
    ? phaseFilters.toggleFilterPath
    : scenarioBlueprint.togglePathSelection
  const noPathsSelected =
    headerPaths.length > 0 && headerSelectedPathIds.length === 0

  const viewportResetKey = isPhaseDetail
    ? `${activeSlideId}:${phaseFilters.filterSelectedPathIds.join(',')}:${phaseFilters.loading}`
    : `${activeSlideId}:${scenarioBlueprint.selectedPathIds.join(',')}:${scenarioBlueprint.blueprints.length}`

  const cellDetailBlueprints = useMemo(() => {
    if (isPhaseDetail) {
      return [...phaseFilters.blueprintsByPathId.values()]
    }
    return scenarioBlueprint.allBlueprints
  }, [
    isPhaseDetail,
    phaseFilters.blueprintsByPathId,
    scenarioBlueprint.allBlueprints,
  ])

  const cellDetailEnabled = isBlueprintCellDetailEnabled(scenarioId)

  return (
    <CanvasZoomChromeProvider>
      <BlueprintCellDetailProvider
        resetKey={activeSlideId}
        enabled={cellDetailEnabled}
        blueprints={cellDetailBlueprints}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {slidesLoading ? (
            <SlideCanvasLoadingSkeleton />
          ) : (
            <>
              <SlideStickyHeader
                slide={activeSlide}
                slides={slides}
                paths={headerPaths}
                selectedPathIds={headerSelectedPathIds}
                onTogglePath={handleTogglePath}
              />
              <div
                className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
                data-slide-canvas
              >
                {noPathsSelected ? (
                  <div className="absolute inset-0 flex">
                    <CanvasEmptyState />
                  </div>
                ) : (
                  <ZoomPanViewport
                    resetKey={viewportResetKey}
                    className="absolute inset-0"
                    panIgnoreSelector="button, a, input, textarea, select, label, [role='button'], [data-slide-sticky-header], [data-compare-panel], [data-zoom-indicator], [data-annotation-toolbar], [data-canvas-annotation-layer], [data-canvas-nav], [data-path-description-trigger], [data-cell-detail-panel], [data-visual-walkthrough-modal], [data-blueprint-cell-interactive], [data-phase-scenario-overview]"
                  >
                    <div className="px-6 md:px-8">
                      <BlueprintSlideContent
                        slide={activeSlide}
                        slides={slides}
                        scenarioBlueprint={scenarioBlueprint}
                        phaseBlueprintFilters={isPhaseDetail ? phaseFilters : null}
                        showHeader={false}
                        showHeaderFilters={false}
                      />
                    </div>
                  </ZoomPanViewport>
                )}
                {cellDetailEnabled && <BlueprintCellDetailPanel />}
              </div>
            </>
          )}
        </div>
      </BlueprintCellDetailProvider>
    </CanvasZoomChromeProvider>
  )
}

import { useCallback, useMemo, useState } from 'react'
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
import { PathsSidebarSection } from '@/components/editor/PathsSidebarSection'
import { SlicesSidebarSection } from '@/components/editor/SlicesSidebarSection'
import { SlideNav } from '@/components/editor/SlideNav'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
} from '@/components/ui/sidebar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useViewState } from '@/contexts/viewStateStore'
import {
  getBlueprintScenarioId,
  isSubslide,
} from '@/types/nav'

type SidebarMode = 'blueprints' | 'slices'

/** Section label style shared by the sidebar accordions. */
export const SIDEBAR_SECTION_TRIGGER_CLASS =
  'px-2 py-1.5 text-[11px] font-medium tracking-wider text-sidebar-foreground/60 uppercase hover:no-underline'

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
  const { activeKey, activeTab, activateTab } = useViewState()

  // Segmented sidebar mode — defaults to Blueprints, auto-switches to
  // Slices when a slice/present tab activates (initializer covers remounts
  // while a tab is already active, e.g. returning from a presentation).
  const activeTabKind = activeTab?.kind ?? null
  const [mode, setMode] = useState<SidebarMode>(
    activeTabKind !== null ? 'slices' : 'blueprints',
  )
  const [lastTabKind, setLastTabKind] = useState(activeTabKind)
  if (lastTabKind !== activeTabKind) {
    setLastTabKind(activeTabKind)
    if (activeTabKind !== null) setMode('slices')
  }

  // The phase/scenario nav always drives the app-level (base blueprint
  // view) editor state. When a tab is active that would be invisible, so
  // selecting a phase/scenario also returns to the base view.
  const handleSelect = useCallback(
    (slideId: string) => {
      if (activeKey !== null) activateTab(null)
      openDetail(slideId)
    },
    [activateTab, activeKey, openDetail],
  )
  const handleOverview = useCallback(() => {
    if (activeKey !== null) activateTab(null)
    enterCanvas()
  }, [activateTab, activeKey, enterCanvas])

  return (
    <SidebarContent className="px-2 pb-1 pt-0.5">
      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as SidebarMode)}
        className="px-1 pb-1"
      >
        <TabsList className="h-7 w-full">
          <TabsTrigger value="blueprints" className="text-xs">
            Blueprints
          </TabsTrigger>
          <TabsTrigger value="slices" className="text-xs">
            Slices
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === 'blueprints' ? (
        <Accordion defaultValue={['phases', 'paths']} className="border-0">
          <AccordionItem value="phases" className="border-0">
            <AccordionTrigger className={SIDEBAR_SECTION_TRIGGER_CLASS}>
              Phases
            </AccordionTrigger>
            <AccordionContent className="pb-1">
              {slidesError && (
                <Alert variant="destructive" className="mb-2">
                  <AlertTitle className="text-xs">Phases</AlertTitle>
                  <AlertDescription className="text-xs">
                    {slidesError}
                  </AlertDescription>
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
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="paths" className="border-0">
            <AccordionTrigger className={SIDEBAR_SECTION_TRIGGER_CLASS}>
              Paths
            </AccordionTrigger>
            <AccordionContent className="pb-1">
              <PathsSidebarSection />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : (
        <SlicesSidebarSection />
      )}
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

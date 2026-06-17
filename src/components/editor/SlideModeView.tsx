import { BlueprintCellDetailPanel } from '@/components/blueprint/BlueprintCellDetailPanel'
import { BlueprintSlideContent } from '@/components/blueprint/BlueprintSlideContent'
import { SlideStickyHeader } from '@/components/editor/SlideStickyHeader'
import { ZoomPanViewport } from '@/components/editor/ZoomPanViewport'
import { BlueprintCellDetailProvider } from '@/contexts/BlueprintCellDetailContext'
import { useEditor } from '@/contexts/EditorContext'
import { useScenarioBlueprint } from '@/hooks/useScenarioBlueprint'
import { BLUEPRINT_CELL_DETAIL_UI_ENABLED } from '@/lib/blueprintDisplayFlags'
import { SlideNav } from '@/components/editor/SlideNav'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar'
import { getBlueprintScenarioId, type SlideViewType } from '@/types/slides'

export function SlideModeSidebarNav() {
  const {
    slides,
    activeSlideId,
    setActiveSlideId,
    slidesLoading,
    slidesError,
  } = useEditor()

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
            <SidebarMenu>
              {[1, 2, 3, 4, 5].map((i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuSkeleton />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ) : (
        <SlideNav
          slides={slides}
          activeSlideId={activeSlideId}
          onSelect={setActiveSlideId}
        />
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
  const scenarioBlueprint = useScenarioBlueprint(scenarioId)

  const handleViewTypeChange = (viewType: SlideViewType) => {
    if (!scenarioId) return
    setScenarioDisplayViewType(scenarioId, viewType)
  }

  return (
    <BlueprintCellDetailProvider resetKey={activeSlideId}>
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        {slidesLoading ? (
          <Skeleton className="absolute inset-0 rounded-none" />
        ) : (
          <>
            <ZoomPanViewport
              resetKey={`${activeSlideId}:${scenarioBlueprint.selectedPathIds.join(',')}:${scenarioBlueprint.blueprints.length}`}
              className="absolute inset-0"
              panIgnoreSelector="button, a, input, textarea, select, label, [role='button'], [data-slide-sticky-header], [data-compare-panel], [data-zoom-indicator], [data-canvas-nav], [data-path-description-trigger], [data-cell-detail-panel], [data-visual-walkthrough-modal], [data-blueprint-cell-interactive], [data-phase-scenario-overview]"
            >
              <div className="px-6 md:px-8">
                <BlueprintSlideContent
                  slide={activeSlide}
                  slides={slides}
                  scenarioBlueprint={scenarioBlueprint}
                  showHeader={false}
                  showHeaderFilters={false}
                />
              </div>
            </ZoomPanViewport>
            {BLUEPRINT_CELL_DETAIL_UI_ENABLED && <BlueprintCellDetailPanel />}
            <SlideStickyHeader
              slide={activeSlide}
              slides={slides}
              viewType={getScenarioDisplayViewType(activeSlide)}
              onViewTypeChange={handleViewTypeChange}
              paths={scenarioBlueprint.paths}
              selectedPathIds={scenarioBlueprint.selectedPathIds}
              onTogglePath={scenarioBlueprint.togglePathSelection}
            />
          </>
        )}
      </div>
    </BlueprintCellDetailProvider>
  )
}

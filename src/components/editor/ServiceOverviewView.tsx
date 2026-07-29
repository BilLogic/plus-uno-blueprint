import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { BlueprintCellDetailPanel } from '@/components/blueprint/BlueprintCellDetailPanel'
import { PhaseScenarioOverview } from '@/components/blueprint/PhaseScenarioOverview'
import { CanvasPhaseSection } from '@/components/editor/CanvasPhaseSection'
import { OverviewPhaseRowDivider } from '@/components/editor/OverviewPhaseRowDivider'
import {
  PhaseOverviewPhaseLoopArrow,
  PHASE_OVERVIEW_LOOP_CHANNEL_OFFSET,
} from '@/components/editor/PhaseOverviewPhaseLoopArrow'
import { CanvasEmptyState } from '@/components/editor/CanvasEmptyState'
import { ServiceOverviewLoadingSkeleton } from '@/components/editor/EditorLoadingSkeletons'
import { ServiceOverviewStickyHeader } from '@/components/editor/ServiceOverviewMenubarHeader'
import { SlideStickyHeader } from '@/components/editor/SlideStickyHeader'
import { ZoomPanViewport } from '@/components/editor/ZoomPanViewport'
import {
  BlueprintCellDetailProvider,
  useBlueprintCellDetail,
} from '@/contexts/BlueprintCellDetailContext'
import { CanvasZoomChromeProvider } from '@/contexts/CanvasZoomChromeContext'
import { useEditor } from '@/contexts/EditorContext'
import { usePhaseBlueprintFilters } from '@/hooks/usePhaseBlueprintFilters'
import { isBlueprintCellDetailEnabled } from '@/lib/blueprintDisplayFlags'
import {
  getCanvasFocusFitInsets,
  getCanvasFocusMaxZoom,
  getCanvasFocusSelector,
} from '@/lib/canvasFocus'
import {
  OVERVIEW_CANVAS_PADDING_X,
  OVERVIEW_CANVAS_PADDING_Y,
} from '@/lib/overviewLayout'
import { collectOverviewPathOptionsForScenarios } from '@/lib/overviewPathFilters'
import {
  getMainSlides,
  getParentSlide,
  getSlideDisplayLabel,
  getOverviewPostToPreLoopTransition,
  getSubslides,
  isOverviewFlowArrowAnchorPhase,
  shouldShowOverviewPhaseFlowArrow,
  isSubslide,
  type Slide,
  type SlideViewType,
} from '@/types/slides'
import type { BlueprintData } from '@/types/blueprint'
import type { PathListItem } from '@/lib/pathSelection'
const OVERVIEW_PAN_IGNORE =
  "button, a, input, textarea, select, label, [role='button'], [data-slide-sticky-header], [data-compare-panel], [data-zoom-indicator], [data-annotation-toolbar], [data-canvas-annotation-layer], [data-phase-scenario-overview], [data-phase-scenario-panel], [data-canvas-phase-interactive], [data-phase-menubar-header], [data-canvas-phase-section], [data-path-description-trigger], [data-cell-detail-panel], [data-blueprint-cell-interactive], [data-slot='menubar'], [data-slot='menubar-trigger'], [data-canvas-nav]"

function CanvasFocusEscapeHandler() {
  const { view, goHome } = useEditor()
  const { isOpen: cellDetailOpen } = useBlueprintCellDetail()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || view !== 'detail') return
      if (event.defaultPrevented) return
      if (cellDetailOpen) return

      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return
      }

      if (
        document.querySelector(
          '[data-visual-walkthrough-modal], [role="dialog"][data-state="open"]',
        )
      ) {
        return
      }

      event.preventDefault()
      goHome()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cellDetailOpen, goHome, view])

  return null
}

type ServicePhaseSectionProps = {
  phase: Slide
  slides: Slide[]
  pathsByScenario: Map<string, PathListItem[]>
  blueprintsByPathId: Map<string, BlueprintData>
  getSelectedPathIds: (scenarioId: string, paths: PathListItem[]) => string[]
  displayViewType: SlideViewType
  showFlowArrow?: boolean
  isFlowArrowAnchor?: boolean
  isLoopArrowFrom?: boolean
  isLoopArrowTo?: boolean
  dimmed?: boolean
  focusedScenarioId?: string | null
  focusActive?: boolean
  onOpenPhase: (phaseId: string) => void
}

function ServicePhaseSection({
  phase,
  slides,
  pathsByScenario,
  blueprintsByPathId,
  getSelectedPathIds,
  displayViewType,
  onOpenPhase,
  showFlowArrow = false,
  isFlowArrowAnchor = false,
  isLoopArrowFrom = false,
  isLoopArrowTo = false,
  dimmed = false,
  focusedScenarioId = null,
  focusActive = false,
}: ServicePhaseSectionProps) {
  const label = getSlideDisplayLabel(phase, slides)
  const description =
    phase.description ?? 'Scenarios in this phase and how they connect.'

  return (
    <CanvasPhaseSection
      title={label}
      description={description}
      phaseId={phase.id}
      variant="overview"
      showFlowArrow={showFlowArrow}
      isFlowArrowAnchor={isFlowArrowAnchor}
      isLoopArrowFrom={isLoopArrowFrom}
      isLoopArrowTo={isLoopArrowTo}
      dimmed={dimmed}
      focusActive={focusActive}
      onNavigate={() => onOpenPhase(phase.id)}
    >
      <PhaseScenarioOverview
        phase={phase}
        slides={slides}
        variant="overview"
        alignPanelHeights
        pathsByScenario={pathsByScenario}
        blueprintsByPathId={blueprintsByPathId}
        getSelectedPathIds={getSelectedPathIds}
        displayViewType={displayViewType}
        focusedScenarioId={focusedScenarioId}
        loading={false}
      />
    </CanvasPhaseSection>
  )
}

export function ServiceOverviewView() {
  const overviewRef = useRef<HTMLDivElement>(null)
  const [overviewEl, setOverviewEl] = useState<HTMLDivElement | null>(null)
  const {
    slides,
    slidesLoading,
    openDetail,
    goHome,
    view,
    activeSlide,
    activeSlideId,
    getScenarioDisplayViewType,
    setScenarioDisplayViewType,
    skipCanvasFitAnimation,
  } = useEditor()
  const phases = getMainSlides(slides)
  const scenarioIds = slides
    .filter((slide) => isSubslide(slide))
    .map((slide) => slide.id)
  const isDetail = view === 'detail'
  const focusedScenarioId =
    isDetail && isSubslide(activeSlide) ? activeSlide.id : null
  const focusedPhaseId = isDetail
    ? isSubslide(activeSlide)
      ? getParentSlide(activeSlide, slides)?.id
      : activeSlide.id
    : null

  const {
    pathsByScenario,
    blueprintsByPathId,
    loading: blueprintsLoading,
    filterPaths: overviewPaths,
    filterSelectedPathIds: overviewSelectedPathIds,
    viewType: overviewViewType,
    toggleFilterPath: handleOverviewTogglePath,
    resolveSelectedPathIds,
  } = usePhaseBlueprintFilters({
    scenarioIds,
    slides,
    getScenarioDisplayViewType,
    setScenarioDisplayViewType,
  })

  const overviewReady = !slidesLoading && !blueprintsLoading
  const fitSelector = getCanvasFocusSelector(view, activeSlide)
  const maxFitZoom = getCanvasFocusMaxZoom(view)
  const fitInsets = getCanvasFocusFitInsets(view)
  const fitKey = overviewReady
    ? `service-canvas:${view}:${activeSlideId}:${phases.length}-${scenarioIds.length}-${overviewSelectedPathIds.join(',')}`
    : 'service-overview-loading'
  const noPathsSelected =
    overviewPaths.length > 0 && overviewSelectedPathIds.length === 0

  const postToPreLoop = getOverviewPostToPreLoopTransition(phases)
  const cellDetailBlueprints = useMemo(
    () => [...blueprintsByPathId.values()],
    [blueprintsByPathId],
  )
  const cellDetailEnabled = isBlueprintCellDetailEnabled()

  const focusedHeader = useMemo(() => {
    if (!isDetail) return null

    const scopeScenarioIds = isSubslide(activeSlide)
      ? [activeSlide.id]
      : getSubslides(activeSlide.id, slides).map((scenario) => scenario.id)

    const scopedPaths = collectOverviewPathOptionsForScenarios(
      pathsByScenario,
      scopeScenarioIds,
    )
    const scopedPathIds = new Set(scopedPaths.map((path) => path.id))
    const scopedSelectedPathIds = overviewSelectedPathIds.filter((id) =>
      scopedPathIds.has(id),
    )

    return {
      slide: activeSlide,
      paths: scopedPaths,
      selectedPathIds: scopedSelectedPathIds,
    }
  }, [
    activeSlide,
    isDetail,
    overviewSelectedPathIds,
    pathsByScenario,
    slides,
  ])

  if (!overviewReady) {
    return <ServiceOverviewLoadingSkeleton />
  }

  return (
    <CanvasZoomChromeProvider>
      <BlueprintCellDetailProvider
        resetKey={fitKey}
        enabled={cellDetailEnabled}
        blueprints={cellDetailBlueprints}
      >
        <CanvasFocusEscapeHandler />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {focusedHeader ? (
            <SlideStickyHeader
              slide={focusedHeader.slide}
              slides={slides}
              paths={focusedHeader.paths}
              selectedPathIds={focusedHeader.selectedPathIds}
              onTogglePath={handleOverviewTogglePath}
            />
          ) : (
            <ServiceOverviewStickyHeader
              paths={overviewPaths}
              selectedPathIds={overviewSelectedPathIds}
              onTogglePath={handleOverviewTogglePath}
            />
          )}
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
                resetKey={fitKey}
                fitSelector={fitSelector}
                maxFitZoom={maxFitZoom}
                fitMargin={fitInsets.margin}
                fitTopInset={fitInsets.topInset}
                fitBottomInset={fitInsets.bottomInset}
                animateFit={!skipCanvasFitAnimation}
                showSequenceNav={isDetail}
                onResetView={isDetail ? goHome : undefined}
                className="absolute inset-0"
                panIgnoreSelector={OVERVIEW_PAN_IGNORE}
              >
                <div
                  ref={(node) => {
                    overviewRef.current = node
                    setOverviewEl(node)
                  }}
                  data-service-overview
                  data-canvas-fit
                  className="relative inline-flex w-max flex-col items-start"
                  style={{
                    paddingTop: OVERVIEW_CANVAS_PADDING_Y,
                    paddingBottom: OVERVIEW_CANVAS_PADDING_Y,
                    paddingRight: OVERVIEW_CANVAS_PADDING_X,
                    paddingLeft:
                      OVERVIEW_CANVAS_PADDING_X +
                      (postToPreLoop
                        ? PHASE_OVERVIEW_LOOP_CHANNEL_OFFSET + 16
                        : 0),
                  }}
                >
                  {phases.map((phase, index) => {
                    const phaseIsFocused = focusedPhaseId === phase.id
                    const dimPhase = isDetail && !phaseIsFocused

                    return (
                      <Fragment key={phase.id}>
                        {index > 0 &&
                        !shouldShowOverviewPhaseFlowArrow(
                          phases[index - 1],
                          phase,
                        ) ? (
                          <OverviewPhaseRowDivider />
                        ) : null}
                        <ServicePhaseSection
                          phase={phase}
                          slides={slides}
                          pathsByScenario={pathsByScenario}
                          blueprintsByPathId={blueprintsByPathId}
                          getSelectedPathIds={resolveSelectedPathIds}
                          displayViewType={overviewViewType}
                          onOpenPhase={openDetail}
                          dimmed={dimPhase}
                          focusActive={phaseIsFocused}
                          focusedScenarioId={
                            phaseIsFocused ? focusedScenarioId : null
                          }
                          showFlowArrow={shouldShowOverviewPhaseFlowArrow(
                            phase,
                            phases[index + 1],
                          )}
                          isFlowArrowAnchor={isOverviewFlowArrowAnchorPhase(
                            phase,
                          )}
                          isLoopArrowFrom={
                            phase.id === postToPreLoop?.fromPhaseId
                          }
                          isLoopArrowTo={phase.id === postToPreLoop?.toPhaseId}
                        />
                      </Fragment>
                    )
                  })}
                  {postToPreLoop ? (
                    <PhaseOverviewPhaseLoopArrow
                      overviewRef={overviewRef}
                      overviewEl={overviewEl}
                    />
                  ) : null}
                </div>
              </ZoomPanViewport>
            )}
            {cellDetailEnabled ? <BlueprintCellDetailPanel /> : null}
          </div>
        </div>
      </BlueprintCellDetailProvider>
    </CanvasZoomChromeProvider>
  )
}

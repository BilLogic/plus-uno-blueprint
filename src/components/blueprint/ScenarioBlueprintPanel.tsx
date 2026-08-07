import { useMemo, useRef, type RefObject } from 'react'
import { IntegratedBlueprintGrid } from '@/components/blueprint/IntegratedBlueprintGrid'
import { ResizableComparePanel } from '@/components/blueprint/ResizableComparePanel'
import { ServiceBlueprintGrid } from '@/components/blueprint/ServiceBlueprintGrid'
import { SideBySideCompareGrid } from '@/components/blueprint/SideBySideCompareGrid'
import { useEditor } from '@/contexts/EditorContext'
import { mergeIntegratedBlueprint } from '@/lib/mergeIntegratedBlueprint'
import { itemsInSelectionOrder, type PathListItem } from '@/lib/pathSelection'
import {
  getComparePanelHeight,
  getComparePanelWidth,
  getIntegratedPanelHeight,
  getIntegratedPanelWidth,
  getPanelHeightFromSwimlaneBody,
} from '@/lib/sideBySideCompareLayout'

export {
  getScenarioBlueprintPanelHeight,
  getScenarioSwimlaneBodyHeight,
} from '@/lib/sideBySideCompareLayout'
export type { ScenarioSwimlaneLayoutInput } from '@/lib/sideBySideCompareLayout'
import {
  getParentSlide,
  getSlideDisplayLabel,
  type NavItem,
  type SlideViewType,
} from '@/types/nav'
import { getScenarioParallelTooltip } from '@/lib/scenarioParallelInfo'
import { BlueprintPanelLoadingSkeleton } from '@/components/editor/EditorLoadingSkeletons'
import type { BlueprintData } from '@/types/blueprint'

type ScenarioBlueprintPanelProps = {
  slide: NavItem
  slides: NavItem[]
  paths: PathListItem[]
  selectedPathIds: string[]
  blueprintsByPathId: Map<string, BlueprintData>
  loading?: boolean
  scrollContainerRef?: RefObject<HTMLDivElement | null>
  /** When set, scenario title sits on the gray panel; path frames show path type. */
  sectionTitleLabel?: string
  /** Fixed panel height (phase overview uses the max across scenarios). */
  lockedPanelHeight?: number
  /** Fixed white swimlane board height shared across a phase row. */
  fixedSwimlaneBodyHeight?: number
  /** When true, panel height does not grow with measured content. */
  lockPanelHeight?: boolean
  /** When set, clicking the panel opens this scenario. */
  onNavigate?: () => void
  /** Phase/overview filter view type — keeps row sizing aligned across scenarios. */
  displayViewType?: SlideViewType
  /** When true, this panel is visually de-emphasized (canvas focus mode). */
  dimmed?: boolean
  /** When true, this panel is the camera focus target — no hover chrome. */
  focusActive?: boolean
}

/** One scenario's blueprint inside a compare panel — title badge, filters and grid. */
export function ScenarioBlueprintPanel({
  slide,
  slides,
  paths,
  selectedPathIds,
  blueprintsByPathId,
  loading = false,
  scrollContainerRef: scrollContainerRefProp,
  sectionTitleLabel,
  lockedPanelHeight,
  fixedSwimlaneBodyHeight,
  lockPanelHeight = false,
  onNavigate,
  displayViewType: displayViewTypeProp,
  dimmed = false,
  focusActive = false,
}: ScenarioBlueprintPanelProps) {
  const { getScenarioDisplayViewType } = useEditor()
  const internalScrollRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = scrollContainerRefProp ?? internalScrollRef

  const scenarioName = getSlideDisplayLabel(slide, slides)
  const parentPhase = getParentSlide(slide, slides)
  const phaseName = parentPhase
    ? getSlideDisplayLabel(parentPhase, slides)
    : undefined
  const storedViewType =
    displayViewTypeProp ?? getScenarioDisplayViewType(slide)
  // Compare needs two sides. The toggle hides below 2 selected paths, but
  // the stored override survives — falling back here keeps a scenario from
  // being stranded in a compare it can no longer leave.
  const displayViewType =
    storedViewType === 'merged' && selectedPathIds.length < 2
      ? 'stacked'
      : storedViewType
  const useIntegratedLayout = false
  const useSideBySideLayout =
    (displayViewType === 'stacked' || displayViewType === 'merged') &&
    selectedPathIds.length > 0
  const useSinglePathLayout =
    displayViewType === 'single' && selectedPathIds.length > 0

  const allBlueprints = useMemo(
    () =>
      paths
        .map((path) => blueprintsByPathId.get(path.id))
        .filter((blueprint): blueprint is BlueprintData => blueprint !== undefined),
    [paths, blueprintsByPathId],
  )

  const visibleBlueprints = useMemo(
    () =>
      useSideBySideLayout || useSinglePathLayout
        ? itemsInSelectionOrder(selectedPathIds, (id) =>
            blueprintsByPathId.get(id),
          )
        : [],
    [
      blueprintsByPathId,
      selectedPathIds,
      useSideBySideLayout,
      useSinglePathLayout,
    ],
  )

  const integratedBlueprint = useMemo(
    () => mergeIntegratedBlueprint(allBlueprints, selectedPathIds, { compare: true }),
    [allBlueprints, selectedPathIds],
  )

  const showIntegratedGrid =
    useIntegratedLayout && integratedBlueprint !== null

  const compareFitContentKey = `${slide.id}:${selectedPathIds.join(',')}:${displayViewType}:${paths.length}`
  const sectionTitleDescription = sectionTitleLabel
    ? slide.description
    : undefined
  const sectionTitleInfoTooltip = sectionTitleLabel
    ? getScenarioParallelTooltip(slide)
    : null
  const showPathTypeBadge = Boolean(sectionTitleLabel)

  const integratedPathCount = Math.max(1, selectedPathIds.length)
  const panelHeight =
    lockedPanelHeight ??
    (fixedSwimlaneBodyHeight !== undefined
      ? getPanelHeightFromSwimlaneBody(fixedSwimlaneBodyHeight, {
          lockHeight: lockPanelHeight,
        })
      : showIntegratedGrid
        ? getIntegratedPanelHeight(
            integratedBlueprint!.layers,
            integratedBlueprint!,
            false,
            new Set(),
            { sourceBlueprints: allBlueprints, selectedPathIds },
          )
        : getComparePanelHeight(visibleBlueprints))

  const fillSwimlaneHeight = fixedSwimlaneBodyHeight !== undefined

  const comparePanelProps = {
    // Both compare-grid estimates run hot: the width one still counts
    // per-path nesting the merged grid no longer draws, and the height one
    // predates classification collapsing stacked slots. A floor set from a
    // hot estimate is dead gray space — the measured content rules instead.
    minWidth: showIntegratedGrid
      ? undefined
      : getComparePanelWidth(visibleBlueprints),
    minHeight: showIntegratedGrid ? undefined : panelHeight,
    defaultWidth: showIntegratedGrid
      ? getIntegratedPanelWidth(
          integratedBlueprint!.steps.length,
          false,
          integratedPathCount,
        )
      : getComparePanelWidth(visibleBlueprints),
    defaultHeight: panelHeight,
    lockHeight: lockPanelHeight,
    onNavigate,
    navigateLabel: onNavigate ? `Open ${scenarioName} scenario` : undefined,
    panelTitleLabel: sectionTitleLabel,
    panelTitleDescription: sectionTitleDescription,
    panelTitleInfoTooltip: sectionTitleInfoTooltip,
    focusSlideId: slide.id,
    dimmed,
    focusActive,
    scrollContainerRef,
  }

  if (loading && visibleBlueprints.length === 0 && !showIntegratedGrid) {
    return (
      <div
        className="flex flex-col gap-2 transition-[opacity,filter] duration-(--motion-fade) ease-out"
        data-focus-slide-id={slide.id}
        data-canvas-focus-dimmed={dimmed ? '' : undefined}
        style={dimmed ? { opacity: 0.3, filter: 'saturate(0.5)' } : undefined}
        role="status"
        aria-busy="true"
        aria-label="Loading blueprint"
      >
        <BlueprintPanelLoadingSkeleton />
      </div>
    )
  }

  if (!showIntegratedGrid && visibleBlueprints.length === 0) {
    // Selected filter paths don't exist here — omit the card entirely so only
    // scenarios that contain the path remain in the phase row.
    if (selectedPathIds.length === 0 && paths.length > 0) {
      return null
    }

    return (
      <div
        className="flex min-h-[280px] min-w-[320px] items-center justify-center rounded-lg border border-dashed p-8 text-center transition-[opacity,filter] duration-(--motion-fade) ease-out"
        data-focus-slide-id={slide.id}
        data-canvas-focus-dimmed={dimmed ? '' : undefined}
        style={dimmed ? { opacity: 0.3, filter: 'saturate(0.5)' } : undefined}
      >
        <p className="text-sm text-muted-foreground">
          No blueprint data for this scenario yet.
        </p>
      </div>
    )
  }

  if (showIntegratedGrid) {
    return (
      <ResizableComparePanel
        {...comparePanelProps}
        fitContentKey={`${compareFitContentKey}:${integratedBlueprint.cells.length}`}
      >
        <IntegratedBlueprintGrid
          data={integratedBlueprint}
          embedded
          scrollContainerRef={scrollContainerRef}
          selectedPathIds={selectedPathIds}
          scenarioName={scenarioName}
          phaseName={phaseName}
          walkthroughBlueprints={allBlueprints}
          fixedSwimlaneBodyHeight={fixedSwimlaneBodyHeight}
          fillSwimlaneHeight={fillSwimlaneHeight}
          showPathTypeBadge={showPathTypeBadge}
        />
      </ResizableComparePanel>
    )
  }

  if (useSideBySideLayout) {
    return (
      <ResizableComparePanel
        {...comparePanelProps}
        fitContentKey={`${compareFitContentKey}:${visibleBlueprints.map((b) => b.path.id).join(',')}`}
      >
        <SideBySideCompareGrid
          blueprints={visibleBlueprints}
          scrollContainerRef={scrollContainerRef}
          scenarioName={scenarioName}
          phaseName={phaseName}
          sectionTitleLabel={sectionTitleLabel}
          fixedSwimlaneBodyHeight={fixedSwimlaneBodyHeight}
          fillSwimlaneHeight={fillSwimlaneHeight}
        />
      </ResizableComparePanel>
    )
  }

  return (
    <ResizableComparePanel
      {...comparePanelProps}
      fitContentKey={`${compareFitContentKey}:${visibleBlueprints.map((b) => b.path.id).join(',')}:single`}
    >
      <div className="flex flex-row items-start gap-6">
        {visibleBlueprints.map((data) => (
          <ServiceBlueprintGrid
            key={data.path.id}
            data={data}
            className="shrink-0"
            scenarioName={scenarioName}
          phaseName={phaseName}
            headerTitleLabel={sectionTitleLabel}
            headerTitleDescription={sectionTitleDescription}
            showPathTypeBadge={showPathTypeBadge}
            fixedSwimlaneBodyHeight={fixedSwimlaneBodyHeight}
            fillSwimlaneHeight={fillSwimlaneHeight}
          />
        ))}
      </div>
    </ResizableComparePanel>
  )
}

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { ResizableComparePanel } from '@/components/blueprint/ResizableComparePanel'
import { ServiceBlueprintGrid } from '@/components/blueprint/ServiceBlueprintGrid'
import { SideBySideCompareGrid } from '@/components/blueprint/SideBySideCompareGrid'
import { StackedCompareGrid } from '@/components/blueprint/StackedCompareGrid'
import {
  CompareDivergenceStrip,
  COMPARE_STRIP_HEIGHT,
} from '@/components/blueprint/CompareDivergenceStrip'
import { useBlueprintCellDetailOptional } from '@/contexts/BlueprintCellDetailContext'
import { useEditor } from '@/contexts/EditorContext'
import { registerAgentUiContext } from '@/lib/agent/uiBridge'
import { registerAgentUiCommand } from '@/lib/agent/uiCommands'
import {
  countCompareDifferences,
  deriveCompareStepGroups,
  parseCompareLedgerFilter,
  resolveCompareStepKeys,
} from '@/lib/compareLedger'
import { jumpToCompareStep } from '@/lib/compareZoneNavigation'
import {
  compareFoldPleatTitle,
  computeFoldableRunFragments,
  countFoldableCompareColumns,
  isCompareFoldAvailable,
  resolveCompareFoldFragment,
} from '@/lib/compareFold'
import {
  clearCompareFilters,
  getCompareReviewState,
  registerCompareReview,
  setCompareFilters,
  setCompareFolded,
  toggleComparePleat,
} from '@/lib/compareReviewStore'
import {
  buildCompareModel,
  computePinnedColumns,
  type CompareBlueprints,
} from '@/lib/compareSlots'
import { itemsInSelectionOrder, type PathListItem } from '@/lib/pathSelection'
import {
  getComparePanelHeight,
  getComparePanelWidth,
  getPanelHeightFromSwimlaneBody,
  getStackedComparePanelHeight,
  getStackedComparePanelWidth,
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
  const useSideBySideLayout =
    (displayViewType === 'stacked' || displayViewType === 'merged') &&
    selectedPathIds.length > 0
  const useSinglePathLayout =
    displayViewType === 'single' && selectedPathIds.length > 0
  /*
    Two arrangements of the same path bands. Overview rows render under a
    shared-row-height contract (locked heights, phase-uniform view type) and
    keep the horizontal layout; the focused scenario view — no overview
    constraints — stacks the bands vertically on one canonical step axis.
  */
  const isOverviewConstrained =
    lockedPanelHeight !== undefined ||
    fixedSwimlaneBodyHeight !== undefined ||
    displayViewTypeProp !== undefined
  const useStackedArrangement = useSideBySideLayout && !isOverviewConstrained

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

  /*
    THE compare model — computed once here, distributed via props; consumers
    never call `buildCompareModel` themselves. Gated null until every
    selected blueprint is loaded: a half-refreshed pair would fabricate
    flash divergences.
  */
  const compareModel = useMemo(() => {
    if (!useStackedArrangement) return null
    if (visibleBlueprints.length < 2) return null
    if (visibleBlueprints.length !== selectedPathIds.length) return null
    return buildCompareModel(visibleBlueprints as CompareBlueprints)
  }, [selectedPathIds.length, useStackedArrangement, visibleBlueprints])

  /*
    Merged = READING PRESET (Phase 4b — the branch canvas failed its data
    gate, median 13% spine coverage vs 30%). Entering Merged folds the
    shared runs and opens the Differences surface — one gesture into
    review posture; leaving unfolds (which clears expandedPleats per the
    fold semantics). The panel is deliberately left alone on exit — the
    user may still be reading the ledger. A preset, not a lock: after
    entry, fold and panel stay fully user-controllable.

    This is THE one seam for the preset: both entry paths — the menubar
    CompareViewToggle and the agent's `set_scenario_view merged` — mutate
    the EditorContext view override, and both land here as a
    `displayViewType` transition. Gating the tracked mode on
    `compareModel` makes degenerate cases (<2 paths, half-loaded pair,
    overview rows) a natural no-op, and the null-reset means re-entering
    compare does not replay a stale transition.
  */
  const cellDetail = useBlueprintCellDetailOptional()
  const openDifferences = cellDetail?.openDifferences
  const compareMode = compareModel ? displayViewType : null
  const previousCompareModeRef = useRef<SlideViewType | null>(null)
  useEffect(() => {
    const previous = previousCompareModeRef.current
    previousCompareModeRef.current = compareMode
    if (previous === 'stacked' && compareMode === 'merged') {
      setCompareFolded(true)
      openDifferences?.()
    } else if (previous === 'merged' && compareMode === 'stacked') {
      setCompareFolded(false)
    }
  }, [compareMode, openDifferences])

  /*
    Publish THE compare context (model + blueprints + scenario identity) to
    the cross-surface store — the menubar [≠ N] chip, the portalled ledger
    drawer and the agent all read from it. Exactly one panel qualifies at a
    time (only the focused scenario leaves the overview's shared-row
    contract), so the registration is effectively a singleton. Agent parity
    ships with the surface: differences_filter + the get_ui_state 'compare'
    line register alongside.
  */
  useEffect(() => {
    if (!compareModel) return
    const unregisterStore = registerCompareReview({
      slideId: slide.id,
      scenarioName,
      phaseName,
      viewMode: displayViewType,
      model: compareModel,
      blueprints: visibleBlueprints,
    })
    const unregisterContext = registerAgentUiContext('compare', () => {
      const state = getCompareReviewState()
      const registration = state.registration
      if (!registration) return null
      const stepGroups = deriveCompareStepGroups(registration.model)
      const names = registration.blueprints
        .map((blueprint) => `"${blueprint.path.name}"`)
        .join(' vs ')
      const filterBits: string[] = []
      if (state.filters.lanes.length > 0)
        filterBits.push(`lanes ${state.filters.lanes.join(', ')}`)
      if (state.filters.verdicts.length > 0)
        filterBits.push(`verdicts ${state.filters.verdicts.join(', ')}`)
      if (state.filters.steps.length > 0) {
        const labels = stepGroups
          .filter((group) => state.filters.steps.includes(group.columnKey))
          .map((group) => group.headerLabel)
        filterBits.push(`steps ${labels.join(', ')}`)
      }
      const activeIndex = stepGroups.findIndex(
        (group) => group.columnKey === state.activeStepKey,
      )
      return [
        `Comparing ${names} in ${registration.viewMode} view (scenario "${registration.scenarioName}"):`,
        `${countCompareDifferences(registration.model)} differences across ${stepGroups.length} divergent steps.`,
        activeIndex >= 0
          ? `Active step ${stepGroups[activeIndex].headerLabel} (${activeIndex + 1} of ${stepGroups.length}).`
          : 'No step active.',
        state.ledgerOpen
          ? 'Difference ledger is OPEN.'
          : 'Difference ledger is closed.',
        filterBits.length > 0
          ? `Ledger filter: ${filterBits.join('; ')}.`
          : 'Ledger filter: none.',
        state.fold.folded
          ? `Shared steps FOLDED${
              state.fold.expandedPleats.size > 0
                ? `, ${state.fold.expandedPleats.size} pleat${
                    state.fold.expandedPleats.size === 1 ? '' : 's'
                  } expanded`
                : ''
            }.`
          : 'Shared steps unfolded.',
      ].join(' ')
    })
    const unregisterJump = registerAgentUiCommand({
      name: 'jump_divergence',
      description:
        "Fly the camera to a divergent STEP of the compared paths and mark it active (strip + ledger stay in sync — the ledger opens that step's group). arg: next | prev | <step number> — the canonical step number the ledger shows as \"Step N\".",
      run: async (arg) => {
        const state = getCompareReviewState()
        const registration = state.registration
        if (!registration) return 'No comparison is active.'
        const stepGroups = deriveCompareStepGroups(registration.model)
        if (stepGroups.length === 0)
          return 'The compared paths have no divergent steps — they are identical on the canvas.'
        const currentIndex = stepGroups.findIndex(
          (group) => group.columnKey === state.activeStepKey,
        )
        const input = arg?.trim() ?? ''
        let targetIndex: number
        if (input === '' || input === 'next') {
          targetIndex =
            currentIndex < 0
              ? 0
              : Math.min(currentIndex + 1, stepGroups.length - 1)
        } else if (input === 'prev') {
          targetIndex =
            currentIndex < 0 ? stepGroups.length - 1 : Math.max(currentIndex - 1, 0)
        } else {
          const parsedStep = Number(input)
          const found = stepGroups.findIndex((group) => group.step === parsedStep)
          if (!Number.isInteger(parsedStep) || found < 0)
            return `No divergent step "${input}" — divergent steps are ${stepGroups
              .map((group) => group.step)
              .join(', ')}. arg: next | prev | <step number>.`
          targetIndex = found
        }
        const group = stepGroups[targetIndex]
        const outcome = await jumpToCompareStep(group, registration.slideId)
        return `${group.headerLabel} — divergent step ${targetIndex + 1} of ${stepGroups.length}, ${group.slots.length} difference${
          group.slots.length === 1 ? '' : 's'
        }${
          outcome?.kind === 'flown'
            ? ' — camera flown to it.'
            : ' — marked active, but its cells are not on the current canvas.'
        }`
      },
    })
    const unregisterFilter = registerAgentUiCommand({
      name: 'differences_filter',
      description:
        'Filter the difference ledger. arg grammar: lane:"Front Stage" verdict:divergent step:"Pay" — space-separated, multi-select per key; verdicts: divergent | only; steps are matched by step name; empty arg clears the filter.',
      run: (arg) => {
        const input = arg?.trim() ?? ''
        if (input === '') {
          clearCompareFilters()
          return 'Ledger filter cleared — showing every difference.'
        }
        const registration = getCompareReviewState().registration
        if (!registration) return 'No comparison is active.'
        const parsed = parseCompareLedgerFilter(input)
        if (parsed.errors.length > 0)
          return `Could not parse: ${parsed.errors.join(', ')}. Grammar: lane:"<lane name>" verdict:<divergent|only> step:"<step name>". Nothing was changed.`
        const resolvedSteps = resolveCompareStepKeys(
          registration.model,
          parsed.stepNames,
        )
        if (resolvedSteps.unknown.length > 0)
          return `No such step${
            resolvedSteps.unknown.length === 1 ? '' : 's'
          }: ${resolvedSteps.unknown.join(', ')}. Steps in this comparison: ${registration.model.columns
            .map((column) => column.label)
            .join(', ')}. Nothing was changed.`
        setCompareFilters({
          lanes: parsed.lanes,
          verdicts: parsed.verdicts,
          steps: resolvedSteps.steps,
        })
        const bits: string[] = []
        if (parsed.lanes.length > 0) bits.push(`lanes: ${parsed.lanes.join(', ')}`)
        if (parsed.verdicts.length > 0)
          bits.push(`verdicts: ${parsed.verdicts.join(', ')}`)
        if (parsed.stepNames.length > 0)
          bits.push(`steps: ${parsed.stepNames.join(', ')}`)
        return `Ledger filtered — ${bits.join('; ') || 'no facets'}.`
      },
    })
    const unregisterCollapseShared = registerAgentUiCommand({
      name: 'collapse_shared',
      description:
        'Fold the shared (identical) step columns of the compared paths into pleats, or unfold them — the same [⇤ Fold] toggle in the menubar, in either compare mode. arg: true | false | empty toggles. Unavailable at zero differences or when the pin rule keeps every shared column expanded.',
      run: (arg) => {
        const state = getCompareReviewState()
        const registration = state.registration
        if (!registration) return 'No comparison is active.'
        const pinned = computePinnedColumns(
          registration.model,
          registration.blueprints,
        )
        if (!isCompareFoldAvailable(registration.model, pinned)) {
          return countCompareDifferences(registration.model) === 0
            ? 'Fold is unavailable — the compared paths are identical, there is nothing to fold around.'
            : 'Fold is unavailable — every shared column feeds a divergent step (pinned), so nothing would fold.'
        }
        const input = (arg ?? '').trim().toLowerCase()
        let next: boolean
        if (input === '') next = !state.fold.folded
        else if (input === 'true') next = true
        else if (input === 'false') next = false
        else return `Could not parse "${arg}" — arg: true | false | empty toggles.`
        if (next === state.fold.folded) {
          return `Shared steps were already ${next ? 'folded' : 'unfolded'}.`
        }
        setCompareFolded(next)
        return next
          ? `Shared steps folded — ${countFoldableCompareColumns(registration.model, pinned)} columns compressed into pleats.`
          : 'Shared steps unfolded.'
      },
    })
    const unregisterTogglePleat = registerAgentUiCommand({
      name: 'toggle_pleat',
      description:
        'Expand or re-collapse one pleat of folded shared steps. arg: a columnKey inside the pleat (see get_compare_diff) or the 1-based pleat index, left to right. Requires the fold to be on (collapse_shared).',
      run: (arg) => {
        const state = getCompareReviewState()
        const registration = state.registration
        if (!registration) return 'No comparison is active.'
        if (!state.fold.folded)
          return 'Shared steps are not folded — run collapse_shared first.'
        const input = (arg ?? '').trim()
        if (input === '')
          return 'toggle_pleat needs an arg: a columnKey inside the pleat, or the 1-based pleat index.'
        const fragments = computeFoldableRunFragments(
          registration.model,
          computePinnedColumns(registration.model, registration.blueprints),
        )
        const fragment = resolveCompareFoldFragment(fragments, input)
        if (!fragment)
          return `No pleat matches "${input}" — there are ${fragments.length} pleats; pass an index 1 to ${fragments.length} or a columnKey inside one.`
        const wasExpanded = state.fold.expandedPleats.has(fragment.key)
        toggleComparePleat(fragment.key)
        return `Pleat ${fragments.indexOf(fragment) + 1} (${compareFoldPleatTitle(fragment)}) ${wasExpanded ? 're-collapsed' : 'expanded'}.`
      },
    })
    return () => {
      unregisterTogglePleat()
      unregisterCollapseShared()
      unregisterFilter()
      unregisterJump()
      unregisterContext()
      unregisterStore()
    }
  }, [
    compareModel,
    displayViewType,
    phaseName,
    scenarioName,
    slide.id,
    visibleBlueprints,
  ])

  // Arrangement is part of the key: switching stacked bands ⇄ overview row
  // re-measures instead of keeping the other arrangement's size.
  const compareFitContentKey = `${slide.id}:${selectedPathIds.join(',')}:${displayViewType}:${useStackedArrangement ? 'bands' : 'row'}:${paths.length}`
  const stackedColumnCount =
    compareModel?.columns.length ??
    visibleBlueprints.reduce((sum, blueprint) => sum + blueprint.steps.length, 0)
  const sectionTitleDescription = sectionTitleLabel
    ? slide.description
    : undefined
  const sectionTitleInfoTooltip = sectionTitleLabel
    ? getScenarioParallelTooltip(slide)
    : null
  const showPathTypeBadge = Boolean(sectionTitleLabel)

  const panelHeight =
    lockedPanelHeight ??
    (fixedSwimlaneBodyHeight !== undefined
      ? getPanelHeightFromSwimlaneBody(fixedSwimlaneBodyHeight, {
          lockHeight: lockPanelHeight,
        })
      : useStackedArrangement
        ? getStackedComparePanelHeight(visibleBlueprints)
        : getComparePanelHeight(visibleBlueprints))

  const fillSwimlaneHeight = fixedSwimlaneBodyHeight !== undefined

  const comparePanelProps = {
    // Compare-grid estimates run hot (the height one predates
    // classification collapsing stacked slots). A floor set from a hot
    // estimate is dead gray space — the measured content rules instead.
    minWidth: useStackedArrangement
      ? getStackedComparePanelWidth(stackedColumnCount)
      : getComparePanelWidth(visibleBlueprints),
    minHeight: panelHeight,
    defaultWidth: useStackedArrangement
      ? getStackedComparePanelWidth(stackedColumnCount)
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

  // The stacked axis needs every selected blueprint before it means anything
  // — a band-by-band trickle would reshuffle canonical columns per arrival.
  const stackedStillLoading =
    loading &&
    useStackedArrangement &&
    selectedPathIds.length >= 2 &&
    visibleBlueprints.length < selectedPathIds.length

  if (
    (loading && visibleBlueprints.length === 0) ||
    stackedStillLoading
  ) {
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

  if (visibleBlueprints.length === 0) {
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

  if (useSideBySideLayout) {
    return (
      <ResizableComparePanel
        {...comparePanelProps}
        // Strip in both compare modes (stacked + merged), navigation only.
        chromeBar={
          compareModel ? (
            <CompareDivergenceStrip
              model={compareModel}
              blueprints={visibleBlueprints}
              slideId={slide.id}
            />
          ) : undefined
        }
        chromeBarHeight={COMPARE_STRIP_HEIGHT}
        fitContentKey={`${compareFitContentKey}:${visibleBlueprints.map((b) => b.path.id).join(',')}`}
      >
        {useStackedArrangement ? (
          <StackedCompareGrid
            blueprints={visibleBlueprints}
            model={compareModel}
            scrollContainerRef={scrollContainerRef}
            scenarioName={scenarioName}
            phaseName={phaseName}
            sectionTitleLabel={sectionTitleLabel}
          />
        ) : (
          <SideBySideCompareGrid
            blueprints={visibleBlueprints}
            scrollContainerRef={scrollContainerRef}
            scenarioName={scenarioName}
            phaseName={phaseName}
            sectionTitleLabel={sectionTitleLabel}
            fixedSwimlaneBodyHeight={fixedSwimlaneBodyHeight}
            fillSwimlaneHeight={fillSwimlaneHeight}
          />
        )}
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

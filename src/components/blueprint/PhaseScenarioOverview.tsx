import { Fragment, memo, useCallback, useId, useMemo, useRef } from 'react'
import {
  getScenarioBlueprintPanelHeight,
  getScenarioSwimlaneBodyHeight,
  ScenarioBlueprintPanelBody,
} from '@/components/blueprint/ScenarioBlueprintPanel'
import { CanvasEmptyState } from '@/components/editor/CanvasEmptyState'
import { useEditor } from '@/contexts/EditorContext'
import { useAlignedPhaseRowPanelHeight } from '@/hooks/useAlignedPhaseRowPanelHeight'
import { useCanvasBlueprints } from '@/hooks/useCanvasBlueprints'
import { defaultSelectedPathIds } from '@/lib/pathSelection'
import type { PathListItem } from '@/lib/pathSelection'
import { COMPARE_MIN_PANEL_HEIGHT } from '@/lib/sideBySideCompareLayout'
import { BLUEPRINT_THEME } from '@/lib/blueprintTheme'
import { OVERVIEW_SCENARIO_GAP } from '@/lib/overviewLayout'
import { SUBSLIDE_GAP } from '@/lib/slideLayout'
import {
  getSlideDisplayLabel,
  getSubslides,
  type NavItem,
  type SlideViewType,
} from '@/types/nav'
import type { BlueprintData } from '@/types/blueprint'
import { cn } from '@/lib/utils'
import { BlueprintPanelLoadingSkeleton } from '@/components/editor/EditorLoadingSkeletons'

const DEFAULT_SCENARIO_GAP = SUBSLIDE_GAP

export type PhaseScenarioOverviewProps = {
  phase: NavItem
  slides: NavItem[]
  className?: string
  /** When true, scenario panels share one row height (detail phase view). */
  alignPanelHeights?: boolean
  /** Service overview uses tighter gaps between scenario panels. */
  variant?: 'default' | 'overview'
  /** Preloaded blueprint maps (service overview). Skips per-phase fetch. */
  pathsByScenario?: Map<string, PathListItem[]>
  blueprintsByPathId?: Map<string, BlueprintData>
  loading?: boolean
  /** When set, overrides default happy-path selection (service overview filters). */
  getSelectedPathIds?: (scenarioId: string, paths: PathListItem[]) => string[]
  /** Phase/overview filter view type — keeps row sizing aligned across scenarios. */
  displayViewType?: SlideViewType
  /**
   * When set in canvas focus mode, scenarios other than this id are dimmed.
   * Pass null to dim nothing within the phase (phase-level focus).
   */
  focusedScenarioId?: string | null
  /** When true, dim every scenario in this phase (another phase is focused). */
  dimAllScenarios?: boolean
  /** Slice-tab scope: mount only this scenario's artboard. */
  onlyScenarioId?: string | null
}

type PhaseScenarioOverviewBodyProps = PhaseScenarioOverviewProps & {
  getScenarioDisplayViewType: (scenario: NavItem) => SlideViewType
  openDetail: (scenarioId: string) => void
}

function PhaseScenarioConnector({ width }: { width: number }) {
  const markerId = useId().replace(/:/g, '')

  return (
    <div
      className="flex shrink-0 items-center justify-center self-center"
      style={{ width }}
      aria-hidden
    >
      {/*
        The reveal's arrow layer (stage 4). This connector was the one
        untagged link on the board: it draws BETWEEN scenario panels, so it
        sits in the phase's flex row rather than inside either panel's
        blueprint, and it was surfacing with the lanes at stage 1 — an arrow
        pointing at two panels that had not arrived yet. Not a z-order
        problem: the reveal is opacity-driven, and this element simply never
        carried the attribute the reveal keys on.
      */}
      <svg
        data-blueprint-arrows=""
        width={width}
        height={24}
        className="overflow-visible"
      >
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 10 5 L 0 10 Z" style={{ fill: BLUEPRINT_THEME.arrow }} />
          </marker>
        </defs>
        <path
          d={`M 0 12 H ${width - 8}`}
          fill="none"
          style={{ stroke: BLUEPRINT_THEME.arrow }}
          strokeWidth={2}
          markerEnd={`url(#${markerId})`}
        />
      </svg>
    </div>
  )
}

/** A phase frame on the overview canvas: its scenario panels plus the flow arrows between them. */
export function PhaseScenarioOverview({
  ...props
}: PhaseScenarioOverviewProps) {
  const { getScenarioDisplayViewType, openDetail } = useEditor()
  return (
    <PhaseScenarioOverviewBody
      {...props}
      getScenarioDisplayViewType={getScenarioDisplayViewType}
      openDetail={openDetail}
    />
  )
}

/** Heavy board body with navigation dependencies passed as stable props. */
export const PhaseScenarioOverviewBody = memo(function PhaseScenarioOverviewBody({
  phase,
  slides,
  className,
  alignPanelHeights = true,
  variant = 'default',
  pathsByScenario: pathsByScenarioProp,
  blueprintsByPathId: blueprintsByPathIdProp,
  loading: loadingProp,
  getSelectedPathIds: getSelectedPathIdsProp,
  displayViewType: displayViewTypeProp,
  focusedScenarioId = null,
  dimAllScenarios = false,
  onlyScenarioId = null,
  getScenarioDisplayViewType,
  openDetail,
}: PhaseScenarioOverviewBodyProps) {
  const isOverview = variant === 'overview'

  /*
    Per-scenario override beats the phase-uniform prop. The prop is the
    overview filter's shared default — but the Compare toggle sets a view
    for *one* scenario, and a phase-level 'stacked' silently clobbering
    it is exactly how a toggle looks broken while its state is correct.

    The resolved mode is passed through at every camera level. Overview and
    focus must render the same grid; navigation changes framing, not topology.
  */
  const resolveViewType = useCallback(
    (scenario: NavItem): SlideViewType => {
      const perScenario = getScenarioDisplayViewType(scenario)
      const resolved =
        perScenario !== 'stacked'
          ? perScenario
          : (displayViewTypeProp ?? perScenario)
      return resolved
    },
    [displayViewTypeProp, getScenarioDisplayViewType],
  )
  const scenarioGap = isOverview ? OVERVIEW_SCENARIO_GAP : DEFAULT_SCENARIO_GAP

  const renderScenarioSeparator = (index: number, total: number) => {
    if (index >= total - 1) return null
    return <PhaseScenarioConnector width={scenarioGap} />
  }

  const scenarios = useMemo(() => {
    const all = getSubslides(phase.id, slides)
    return onlyScenarioId
      ? all.filter((scenario) => scenario.id === onlyScenarioId)
      : all
  }, [onlyScenarioId, phase.id, slides])
  const scenarioIds = useMemo(
    () => scenarios.map((scenario) => scenario.id),
    [scenarios],
  )
  const usePreloaded =
    pathsByScenarioProp !== undefined && blueprintsByPathIdProp !== undefined
  const fetched = useCanvasBlueprints(usePreloaded ? [] : scenarioIds)
  const pathsByScenario = pathsByScenarioProp ?? fetched.pathsByScenario
  const blueprintsByPathId =
    blueprintsByPathIdProp ?? fetched.blueprintsByPathId
  const loading = loadingProp ?? fetched.loading

  /*
    The scenarios the shared row height is computed FROM — everything except
    the focused one.

    `useAlignedPhaseRowPanelHeight` already refuses to let the focused
    scenario drive its siblings' MEASURED height. The two ESTIMATES below
    did not know that, so a comparison opened inside a focused scenario
    still reached its dimmed neighbours through `Math.max`: selecting a
    second path in one scenario grew six untouched siblings from 2218px to
    4250px each, every one of them rendering two thousand pixels of empty
    gray. The same inflation came back at the focused panel — its own floor
    was raised by its own content — which is where the gray under a focused
    Merged view came from. One exclusion fixes both. The estimate now agrees
    with the measurement about whose height counts.

    Note what this deliberately does NOT do: the focused panel still RECEIVES
    the row height, like every other panel. Excluding it from the input is a
    change to a number; excluding it from the contract would be a change to
    its geometry, and the camera depends on focus changing no geometry at
    all (see the note beside the panel props below).

    The row still aligns whenever nothing is focused, which is the state the
    contract exists for — a row of peers read side by side at overview zoom.
  */
  const rowHeightScenarios = useMemo(
    () => scenarios.filter((scenario) => scenario.id !== focusedScenarioId),
    [scenarios, focusedScenarioId],
  )

  const sharedSwimlaneBodyHeight = useMemo(() => {
    if (!alignPanelHeights) return undefined

    const heights = rowHeightScenarios.map((scenario) => {
      const paths = pathsByScenario.get(scenario.id) ?? []
      const selectedPathIds = getSelectedPathIdsProp
        ? getSelectedPathIdsProp(scenario.id, paths)
        : defaultSelectedPathIds(paths)
      return getScenarioSwimlaneBodyHeight({
        displayViewType: resolveViewType(scenario),
        paths,
        selectedPathIds,
        blueprintsByPathId,
      })
    })

    // Undefined, not 0: the only way to have no heights is a row whose sole
    // scenario is the focused one, and a shared body height of zero would
    // pin a panel flat rather than say "there is nothing to align to".
    return heights.length > 0 ? Math.max(...heights) : undefined
  }, [
    alignPanelHeights,
    rowHeightScenarios,
    pathsByScenario,
    blueprintsByPathId,
    getSelectedPathIdsProp,
    resolveViewType,
  ])

  const sharedPanelHeight = useMemo(() => {
    if (!alignPanelHeights) return undefined
    const heights = rowHeightScenarios.map((scenario) => {
      const paths = pathsByScenario.get(scenario.id) ?? []
      const selectedPathIds = getSelectedPathIdsProp
        ? getSelectedPathIdsProp(scenario.id, paths)
        : defaultSelectedPathIds(paths)
      return getScenarioBlueprintPanelHeight({
        displayViewType: resolveViewType(scenario),
        paths,
        selectedPathIds,
        blueprintsByPathId,
      })
    })
    const height = Math.max(0, ...heights)
    return height > 0 ? height : undefined
  }, [
    alignPanelHeights,
    rowHeightScenarios,
    pathsByScenario,
    blueprintsByPathId,
    getSelectedPathIdsProp,
    resolveViewType,
  ])

  const rowRef = useRef<HTMLDivElement>(null)
  const selectedPathsMeasureKey = scenarios
    .map((scenario) => {
      const paths = pathsByScenario.get(scenario.id) ?? []
      const selectedPathIds = getSelectedPathIdsProp
        ? getSelectedPathIdsProp(scenario.id, paths)
        : defaultSelectedPathIds(paths)
      return selectedPathIds.join(',')
    })
    .join('|')
  const viewTypesMeasureKey = scenarios
    .map((scenario) => resolveViewType(scenario))
    .join(',')
  // `focusedScenarioId` is part of the key because it changes WHICH panels
  // the row measures over — the measurement skips the focused one, so focus
  // moving is a re-measure even when every estimate above is unchanged.
  const rowMeasureKey = `${phase.id}:${sharedPanelHeight ?? 0}:${scenarios.length}:${loading}:${viewTypesMeasureKey}:${selectedPathsMeasureKey}:${focusedScenarioId ?? 'none'}`
  const rowPanelHeight = useAlignedPhaseRowPanelHeight(
    rowRef,
    sharedPanelHeight,
    alignPanelHeights,
    rowMeasureKey,
  )

  if (scenarios.length === 0) {
    // Scenario creation lives on the phase row's `+` in the sidebar (the row
    // knows which phase it means) — no create callback reaches this canvas
    // frame, so the empty state teaches the route instead of offering one.
    return (
      <div
        className={cn(
          'flex min-h-[220px] min-w-[min(36rem,65vw)] items-stretch',
          className,
        )}
        data-phase-scenario-overview=""
        data-phase-empty=""
      >
        <CanvasEmptyState
          variant="phase"
          title="No scenarios in this phase yet"
          description="Add one with the + on this phase's row in the sidebar (Edit mode)."
        />
      </div>
    )
  }

  if (loading) {
    const skeletonHeight = sharedPanelHeight ?? COMPARE_MIN_PANEL_HEIGHT

    return (
      <div
        className={cn('inline-flex items-stretch', className)}
        data-phase-scenario-overview=""
        role="status"
        aria-busy="true"
        aria-label="Loading phase scenarios"
      >
        {scenarios.map((scenario, index) => (
          <Fragment key={scenario.id}>
            <BlueprintPanelLoadingSkeleton
              height={skeletonHeight}
              width={640}
            />
            {renderScenarioSeparator(index, scenarios.length)}
          </Fragment>
        ))}
      </div>
    )
  }

  const scenarioSelections = scenarios.map((scenario) => {
    const paths = pathsByScenario.get(scenario.id) ?? []
    const selectedPathIds = getSelectedPathIdsProp
      ? getSelectedPathIdsProp(scenario.id, paths)
      : defaultSelectedPathIds(paths)
    return { scenario, paths, selectedPathIds }
  })

  const visibleScenarioSelections = scenarioSelections.filter(
    ({ selectedPathIds }) => selectedPathIds.length > 0,
  )
  const hasAnyPaths = scenarioSelections.some(({ paths }) => paths.length > 0)

  // Selected paths exist elsewhere, but not in this phase.
  if (visibleScenarioSelections.length === 0 && hasAnyPaths) {
    return (
      <div
        className={cn(
          'flex min-h-[220px] min-w-[min(36rem,65vw)] items-stretch',
          className,
        )}
        data-phase-scenario-overview=""
        data-phase-empty=""
      >
        <CanvasEmptyState
          variant="phase"
          title="No selected paths in this phase"
          description="The selected path only exists in another phase or scenario."
        />
      </div>
    )
  }

  return (
    <div
      ref={rowRef}
      className={cn('inline-flex items-stretch', className)}
      data-phase-scenario-overview=""
    >
      {visibleScenarioSelections.map(({ scenario, paths, selectedPathIds }, index) => {
        const label = getSlideDisplayLabel(scenario, slides)
        const scenarioViewType = resolveViewType(scenario)

        return (
          <Fragment key={scenario.id}>
            {/*
              FOCUS CHANGES NO GEOMETRY. Every scenario takes the same row
              props whether or not it is the focused one.

              This is load-bearing for the camera. A canvas click starts the
              ease immediately from the geometry on screen
              (`focusActiveCanvasSlide`), and React's navigation then bumps
              the fit key, which computes the fit again; `fitToView` skips
              that second animation only when the two targets agree. So
              anything that resizes the focused panel *because* it became
              focused guarantees a second ease that supersedes the first
              partway through — an ease-in-out restarting from a moving
              camera drops to zero velocity, which is the lurch.

              I briefly had the focused panel drop the row lock and hug its
              content, to kill the dead gray under a focused Merged view.
              It killed the gray and broke this invariant. The gray had a
              different cause and is fixed at its source: the row-height
              ESTIMATE above used to include the focused scenario, so a
              two-path comparison inflated its own floor to 4250px. With
              that excluded the floor is the siblings' height, the lock stays
              a floor rather than a ceiling (see `targetHeight` in
              ResizableComparePanel), and a taller board simply grows past
              it — no gray, and no geometry change on focus.
            */}
            <ScenarioBlueprintPanelBody
              slide={scenario}
              slides={slides}
              paths={paths}
              selectedPathIds={selectedPathIds}
              blueprintsByPathId={blueprintsByPathId}
              sectionTitleLabel={label}
              lockedPanelHeight={rowPanelHeight}
              fixedSwimlaneBodyHeight={
                scenarioViewType === 'single'
                  ? sharedSwimlaneBodyHeight
                  : undefined
              }
              lockPanelHeight={alignPanelHeights}
              displayViewType={scenarioViewType}
              onNavigate={() => openDetail(scenario.id)}
              dimmed={
                dimAllScenarios ||
                (focusedScenarioId !== null &&
                  focusedScenarioId !== scenario.id)
              }
              focusActive={focusedScenarioId === scenario.id}
              getScenarioDisplayViewType={getScenarioDisplayViewType}
            />

            {renderScenarioSeparator(index, visibleScenarioSelections.length)}
          </Fragment>
        )
      })}
    </div>
  )
})

import { useCallback, useMemo } from 'react'
import { useCanvasBlueprints } from '@/hooks/useCanvasBlueprints'
import { usePathSelectionsByScenario } from '@/hooks/usePathSelection'
import type { BlueprintData } from '@/types/blueprint'
import type { PathListItem } from '@/lib/pathSelection'
import { getSubslides, isSubslide, type NavItem, type SlideViewType } from '@/types/nav'

type UsePhaseBlueprintFiltersOptions = {
  scenarioIds: string[]
  slides: NavItem[]
  enabled?: boolean
  getScenarioDisplayViewType: (slide: NavItem) => SlideViewType | undefined
  setScenarioDisplayViewType: (scenarioId: string, viewType: SlideViewType) => void
}

export type PhaseBlueprintFilters = {
  pathsByScenario: Map<string, PathListItem[]>
  blueprintsByPathId: Map<string, BlueprintData>
  loading: boolean
  /** Real fetch progress: settled request chunks over total. */
  progress: { loaded: number; total: number }
  viewType: SlideViewType
  setViewType: (viewType: SlideViewType) => void
  /** This view's selection for a scenario — what a focused scenario draws. */
  resolveSelectedPathIds: (scenarioId: string, paths: PathListItem[]) => string[]
  /** The scenario's happy path alone — what a phase row draws. */
  resolveHappyPathIds: (scenarioId: string, paths: PathListItem[]) => string[]
}

/**
 * View settings for a set of scenarios — one phase, or the whole service.
 *
 * **No path filter.** A phase canvas draws each scenario's happy path and
 * nothing else (decided 2026-08-21). Paths belong to a scenario, and the
 * cross-scenario filter that used to sit in the phase header aggregated by
 * `${type}:${name}` so that one row could toggle the "Happy Path" in all 23
 * scenarios at once. Every path has its own name now, so that fold folds
 * nothing: it listed 39 unrelated routes as though they were one choice.
 *
 * Variants and exceptions are reachable where they belong — inside the
 * scenario, via `ScenarioSlideFilters`.
 */
export function usePhaseBlueprintFilters({
  scenarioIds,
  slides,
  enabled = true,
  getScenarioDisplayViewType,
  setScenarioDisplayViewType,
}: UsePhaseBlueprintFiltersOptions): PhaseBlueprintFilters {
  const activeScenarioIds = useMemo(
    () => (enabled ? scenarioIds : []),
    [enabled, scenarioIds],
  )
  const {
    pathsByScenario,
    blueprintsByPathId,
    loading,
    progress,
  } = useCanvasBlueprints(activeScenarioIds)

  /*
    Feeds the shared path-selection store and reads back this view's
    selections. The phase header no longer offers a path FILTER, but the store
    still has to be fed: it is what the focused-scenario picker reads, and it
    is where the happy-path default is seeded. Dropping this call left
    `activePathKeys` empty and every scenario opened on "Paths shown: none".
  */
  const { getSelectedPathIds } = usePathSelectionsByScenario(
    pathsByScenario,
    activeScenarioIds,
  )

  // `activeScenarioIds` is the scope: the store may prune any of these that
  // came back with no paths, which is how a deleted — or reverted-duplicate —
  // scenario leaves the catalog instead of outliving the session in it.
  const viewType = useMemo(() => {
    if (activeScenarioIds.length === 0) return 'stacked' as SlideViewType

    const viewTypes = activeScenarioIds.map((scenarioId) => {
      const scenario = slides.find((slide) => slide.id === scenarioId)
      const scenarioViewType = scenario
        ? (getScenarioDisplayViewType(scenario) ?? 'stacked')
        : ('stacked' as SlideViewType)
      // 'merged' is a focused-scenario mode; overview rows render stacked.
      return scenarioViewType === 'merged'
        ? ('stacked' as SlideViewType)
        : scenarioViewType
    })

    return viewTypes.every((type) => type === viewTypes[0])
      ? viewTypes[0]!
      : ('stacked' as SlideViewType)
  }, [activeScenarioIds, slides, getScenarioDisplayViewType])

  const setViewType = useCallback(
    (nextViewType: SlideViewType) => {
      for (const scenarioId of activeScenarioIds) {
        setScenarioDisplayViewType(scenarioId, nextViewType)
      }
    },
    [activeScenarioIds, setScenarioDisplayViewType],
  )

  const resolveSelectedPathIds = useCallback(
    (scenarioId: string, _paths: PathListItem[]) => getSelectedPathIds(scenarioId),
    [getSelectedPathIds],
  )

  /**
   * The happy path, and only it — what a PHASE row draws.
   *
   * A phase canvas is a survey: six variants of Goal Setting on it is noise,
   * and the scenario is where you go to see them (decided 2026-08-21). A
   * focused scenario still uses {@link resolveSelectedPathIds}, so the picker
   * inside it works.
   */
  const resolveHappyPathIds = useCallback(
    (_scenarioId: string, paths: PathListItem[]) => {
      const happy = paths.find((path) => path.path_type === 'happy')
      return happy ? [happy.id] : paths[0] ? [paths[0].id] : []
    },
    [],
  )

  return {
    pathsByScenario,
    blueprintsByPathId,
    loading,
    progress,
    viewType,
    setViewType,
    resolveSelectedPathIds,
    resolveHappyPathIds,
  }
}

export function getPhaseScenarioIds(phase: NavItem, slides: NavItem[]): string[] {
  return getSubslides(phase.id, slides).map((scenario) => scenario.id)
}

export function isPhaseWithScenarios(slide: NavItem, slides: NavItem[]): boolean {
  return !isSubslide(slide) && getPhaseScenarioIds(slide, slides).length > 0
}

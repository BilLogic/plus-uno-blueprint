import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'
import { useViewState } from '@/contexts/viewStateStore'
import { usePathSelectionContext } from '@/hooks/usePathSelection'
import { useSliceBlueprint } from '@/hooks/useSliceBlueprint'
import { collectOverviewPathOptionsForScenarios } from '@/lib/overviewPathFilters'
import { cn } from '@/lib/utils'
import { isSubslide } from '@/types/nav'

function PathsHint({ children }: { children: string }) {
  return (
    <p className="px-2 py-1.5 text-xs text-sidebar-foreground/50">{children}</p>
  )
}

/**
 * Checkmark multi-select of one scenario's paths — one row per path, the
 * Check icon visible only while selected. Wired to the same shared path-key
 * store (`PathSelectionContext`) the removed navbar Paths field used, so a
 * toggle here updates the canvas in the base view and slice tabs alike.
 */
function ScenarioPathsChecklist({ scenarioId }: { scenarioId: string }) {
  const { catalog, activePathKeys, togglePathKey } = usePathSelectionContext()
  const paths = catalog[scenarioId]

  const options = useMemo(
    () =>
      collectOverviewPathOptionsForScenarios(
        new Map(paths ? [[scenarioId, paths]] : []),
        [scenarioId],
      ),
    [paths, scenarioId],
  )

  // The scenario's paths land in the catalog once its canvas loads — until
  // then there is nothing meaningful to list.
  if (options.length === 0) return null

  return (
    <ul className="flex flex-col gap-0.5">
      {options.map((option) => {
        const selected = activePathKeys.includes(option.id)
        return (
          <li key={option.id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => togglePathKey(option.id)}
              className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Check
                className={cn('size-3.5 shrink-0', !selected && 'invisible')}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{option.name}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Resolves a slice tab's owning scenario, then lists that scenario's paths. */
function SlicePathsChecklist({ sliceId }: { sliceId: string }) {
  // Reads the same cached queries the slice tab itself resolves from.
  const { scenarioId } = useSliceBlueprint(sliceId)
  if (!scenarioId) return null
  return <ScenarioPathsChecklist scenarioId={scenarioId} />
}

/**
 * Sidebar PATHS section body — reflects the active scenario (base-view
 * scenario detail or the active slice tab's scenario); a muted hint when no
 * scenario is active.
 */
export function PathsSidebarSection() {
  const { activeTab } = useViewState()
  const { view, activeSlide } = useEditor()

  if (activeTab !== null) {
    return <SlicePathsChecklist sliceId={activeTab.sliceId} />
  }
  if (view === 'detail' && isSubslide(activeSlide)) {
    return <ScenarioPathsChecklist scenarioId={activeSlide.id} />
  }
  return <PathsHint>Open a scenario to choose paths.</PathsHint>
}

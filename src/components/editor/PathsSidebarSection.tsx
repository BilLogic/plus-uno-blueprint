import { useMemo, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'
import { useViewState } from '@/contexts/viewStateStore'
import { usePathSelectionContext } from '@/hooks/usePathSelection'
import { useSliceBlueprint } from '@/hooks/useSliceBlueprint'
import { SIDEBAR_SECTION_TRIGGER_CLASS } from '@/components/editor/SlideModeView'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Skeleton } from '@/components/ui/skeleton'
import {
  collectOverviewPathOptions,
  collectOverviewPathOptionsForScenarios,
} from '@/lib/overviewPathFilters'
import { cn } from '@/lib/utils'
import type { PathOption } from '@/components/blueprint/PathMultiSelect'

/**
 * The PATHS disclosure. Always mounts expanded: the section is unmounted
 * whenever it is hidden (nav plan D4), so an uncontrolled `defaultValue`
 * re-opens it every time it comes back — a collapsed state could otherwise
 * outlive the hide and greet the user with an empty header.
 */
function PathsSection({ children }: { children: ReactNode }) {
  return (
    <Accordion multiple defaultValue={['paths']} className="border-0">
      <AccordionItem value="paths" className="border-0">
        <AccordionTrigger className={SIDEBAR_SECTION_TRIGGER_CLASS}>
          Paths
        </AccordionTrigger>
        <AccordionContent className="pb-1">{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

function PathsHint({ children }: { children: string }) {
  return (
    <p className="px-2 py-1.5 text-xs text-sidebar-foreground/50">{children}</p>
  )
}

/**
 * Placeholder for "a scenario is selected but its path catalog has not
 * arrived yet". Distinct from the hidden state on purpose: without it the
 * section pops in mid-read as the canvas finishes loading.
 */
function PathsLoadingRows() {
  return (
    <div className="flex flex-col gap-0.5" aria-hidden>
      <Skeleton className="mx-2 my-1 h-3.5 w-28" />
      <Skeleton className="mx-2 my-1 h-3.5 w-20" />
    </div>
  )
}

function PathChecklist({ options }: { options: PathOption[] }) {
  const { activePathKeys, togglePathKey } = usePathSelectionContext()

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

/**
 * Checkmark multi-select of one scenario's paths — one row per path, the
 * Check icon visible only while selected. Wired to the same shared path-key
 * store (`PathSelectionContext`) the removed navbar Paths field used, so a
 * toggle here updates the canvas in the base view and slice tabs alike.
 */
function ScenarioPathsChecklist({ scenarioId }: { scenarioId: string }) {
  const { catalog } = usePathSelectionContext()
  const paths = catalog[scenarioId]

  const options = useMemo(
    () =>
      collectOverviewPathOptionsForScenarios(
        new Map(paths ? [[scenarioId, paths]] : []),
        [scenarioId],
      ),
    [paths, scenarioId],
  )

  // The scenario's paths land in the catalog once its canvas loads.
  if (options.length === 0) return <PathsLoadingRows />

  return <PathChecklist options={options} />
}

/** Resolves a slice tab's owning scenario, then lists that scenario's paths. */
function SlicePathsChecklist({ sliceId }: { sliceId: string }) {
  // Reads the same cached queries the slice tab itself resolves from.
  const { scenarioId } = useSliceBlueprint(sliceId)
  // A slice tab always has a scenario — it is just still resolving.
  if (!scenarioId) return <PathsLoadingRows />
  return <ScenarioPathsChecklist scenarioId={scenarioId} />
}

/**
 * The no-scenario branch. Normally hidden (progressive disclosure), but
 * never while nothing is selected: deselecting every path empties the
 * canvas, and hiding the section there would leave no path control anywhere
 * in the app. In that state the whole known catalog is offered so the user
 * can switch one back on.
 */
function PathsSafetyValve() {
  const { catalog, activePathKeys } = usePathSelectionContext()
  const options = useMemo(
    () => collectOverviewPathOptions(new Map(Object.entries(catalog))),
    [catalog],
  )

  if (activePathKeys.length > 0) return null

  return (
    <PathsSection>
      {options.length === 0 ? (
        <PathsHint>Open a scenario to choose paths.</PathsHint>
      ) : (
        <PathChecklist options={options} />
      )}
    </PathsSection>
  )
}

/**
 * Sidebar PATHS section — the whole disclosure, header included, so the
 * visibility rule lives with the data that decides it (nav plan D4).
 *
 * Renders for the active scenario: the slice tab's scenario when a tab is
 * active, otherwise the base view's selected scenario. With no scenario
 * selected the section is hidden — unless no path is active at all, which
 * is the one state that must always keep a path control on screen.
 *
 * Deliberately outside the Blueprints/Slices mode tabs: activating a slice
 * tab force-switches the sidebar to Slices, so anything inside the
 * Blueprints branch is unreachable exactly when a slice is open.
 */
export function PathsSidebarSection() {
  const { activeTab } = useViewState()
  const { view, selectedScenarioId } = useEditor()

  if (activeTab !== null) {
    return (
      <PathsSection>
        <SlicePathsChecklist sliceId={activeTab.sliceId} />
      </PathsSection>
    )
  }
  if (view === 'detail' && selectedScenarioId !== null) {
    return (
      <PathsSection>
        <ScenarioPathsChecklist scenarioId={selectedScenarioId} />
      </PathsSection>
    )
  }
  return <PathsSafetyValve />
}

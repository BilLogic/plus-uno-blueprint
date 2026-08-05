import { useCallback, useState } from 'react'
import { SlideNavLoadingSkeleton } from '@/components/editor/EditorLoadingSkeletons'
import { useEditor } from '@/contexts/EditorContext'
import { PathsSidebarSection } from '@/components/editor/PathsSidebarSection'
import { NavSection } from '@/components/editor/SidebarNav'
import { SlicesSidebarSection } from '@/components/editor/SlicesSidebarSection'
import { SlideNav } from '@/components/editor/SlideNav'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { SidebarContent } from '@/components/ui/sidebar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useViewState } from '@/contexts/viewStateStore'

type SidebarMode = 'blueprints' | 'slices'

/** Sidebar body for slide mode: the Blueprints/Slices tabs and their trees. */
export function SlideModeSidebarNav() {
  const {
    slides,
    selectPhase,
    selectScenario,
    selectedPhaseId,
    selectedScenarioId,
    focusNonce,
    view,
    slidesLoading,
    slidesError,
    expandedPhaseIds,
    setPhaseExpanded,
  } = useEditor()
  const { activeKey, activeTab, activateTab } = useViewState()
  const [phasesOpen, setPhasesOpen] = useState(true)

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
  const handleSelectPhase = useCallback(
    (phaseId: string) => {
      if (activeKey !== null) activateTab(null)
      selectPhase(phaseId)
    },
    [activateTab, activeKey, selectPhase],
  )
  const handleSelectScenario = useCallback(
    (scenarioId: string) => {
      if (activeKey !== null) activateTab(null)
      selectScenario(scenarioId)
    },
    [activateTab, activeKey, selectScenario],
  )
  return (
    <SidebarContent className="px-2 pt-0.5 pb-1">
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
        <>
          <NavSection title="Phases" open={phasesOpen} onOpenChange={setPhasesOpen}>
            {slidesError && (
              <Alert variant="destructive" className="mb-2">
                <AlertTitle className="text-xs">Phases</AlertTitle>
                <AlertDescription className="text-xs">
                  {slidesError}
                </AlertDescription>
              </Alert>
            )}
            {slidesLoading ? (
              <SlideNavLoadingSkeleton />
            ) : (
              <SlideNav
                slides={slides}
                selectedPhaseId={selectedPhaseId}
                selectedScenarioId={selectedScenarioId}
                focusNonce={focusNonce}
                onSelectPhase={handleSelectPhase}
                onSelectScenario={handleSelectScenario}
                isHome={view !== 'detail'}
                expandedPhaseIds={expandedPhaseIds}
                onSetExpanded={setPhaseExpanded}
              />
            )}
          </NavSection>

          {/*
            Paths filter one scenario's blueprint, so the section belongs to
            the Blueprints mode and to nothing else: a slice is a fixed set of
            cells, and offering a path filter beside it only invited the
            question of what it would filter. The rule replaces nav plan D4's
            "outside the mode tabs" placement.
          */}
          <PathsSidebarSection />
        </>
      ) : (
        <SlicesSidebarSection />
      )}
    </SidebarContent>
  )
}

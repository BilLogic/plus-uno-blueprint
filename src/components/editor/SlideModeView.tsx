import { useCallback, useState } from 'react'
import { SlideNavLoadingSkeleton } from '@/components/editor/EditorLoadingSkeletons'
import { useEditor } from '@/contexts/EditorContext'
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

type SidebarMode = 'blueprints' | 'slices'

/** Section label style shared by the sidebar accordions. */
export const SIDEBAR_SECTION_TRIGGER_CLASS =
  'px-2 py-1.5 text-[11px] font-medium tracking-wider text-sidebar-foreground/60 uppercase hover:no-underline'

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
        <Accordion
          // Base UI defaults to single-open; the sidebar's sections are
          // independent.
          multiple
          defaultValue={['phases']}
          className="border-0"
        >
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
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : (
        <SlicesSidebarSection />
      )}

      {/* Outside the mode tabs on purpose: a slice tab force-switches the
          sidebar to Slices, which would make a Blueprints-only Paths
          section unreachable exactly when a slice is open (D4). The
          section hides itself when there is nothing to bind it to. */}
      <PathsSidebarSection />
    </SidebarContent>
  )
}

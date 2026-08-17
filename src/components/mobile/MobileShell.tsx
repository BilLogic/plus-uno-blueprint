import { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize, Menu } from 'lucide-react'
import { MobileScenarioReader } from '@/components/mobile/MobileScenarioReader'
import { MobileTopBar } from '@/components/mobile/MobileTopBar'
import {
  MobileNavSheet,
  type MobileNavSurface,
} from '@/components/mobile/MobileNavSheet'
import { MobileAgentSheet } from '@/components/mobile/MobileAgentSheet'
import { MobileAgentFab } from '@/components/mobile/MobileAgentFab'
import { MobilePathSelector } from '@/components/mobile/MobilePathSelector'
import { CanvasModeProvider } from '@/components/editor/CanvasModeProvider'
import { ServiceOverviewView } from '@/components/editor/ServiceOverviewView'
import { VisualWalkthroughShell } from '@/components/blueprint/VisualWalkthroughShell'
import { Button } from '@/components/ui/button'
import { SlicePresentation } from '@/components/editor/SlicePresentation'
import { EditorErrorBoundary } from '@/components/EditorErrorBoundary'
import { useEditor } from '@/contexts/EditorContext'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useViewState } from '@/contexts/viewStateStore'
import { useCanvasBlueprints } from '@/hooks/useCanvasBlueprints'
import { useCellDeepLink } from '@/hooks/useCellDeepLink'
import { useMobileSliceDeepLink } from '@/hooks/useMobileSliceDeepLink'
import { useSlices } from '@/hooks/useSlices'
import {
  registerAgentUiBridge,
  registerAgentUiContext,
} from '@/lib/agent/uiBridge'
import { runAgentUiCommand } from '@/lib/agent/uiCommands'
import {
  readLastViewedPath,
  resolveDefaultPathId,
  writeLastViewedPath,
} from '@/lib/mobilePathMemory'
import { makeMobileAgentBridge, type MobileSurface } from '@/components/mobile/mobileAgentBridge'
import { getMainSlides, getSlideDisplayLabel, getSubslides } from '@/types/nav'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/types/nav'

/**
 * The phone's shell — the view-only visitor experience, for every tier.
 *
 * Two ways to read the same board: the READER folds one scenario into a
 * vertical journey, and the MAP is the real canvas scoped to one phase.
 * There is no surface toggle (plan 2026-08-16-002 Phase 3): navigation
 * implies the surface — tapping a scenario opens the reader, tapping a
 * phase opens the map — and the drawer is the index, opening on first load
 * when nothing is selected yet. Nothing here can write: no design mode, no
 * editors, and the agent's tool roster is filtered to reading (loop.ts).
 *
 * Surface policy (what a tap means for the visible view) stays HERE, in
 * the handlers, so the model lives in one place.
 */

export function MobileShell() {
  const {
    view,
    slides,
    selectPhase,
    selectScenario,
    selectedPhaseId,
    selectedScenarioId,
    expandedPhaseIds,
    setPhaseExpanded,
  } = useEditor()
  const { canAgent } = useSupabase()
  const { pendingUrlState } = useViewState()
  useCellDeepLink()

  const [surface, setSurface] = useState<MobileSurface>('reader')
  // First load with nothing selected: the drawer IS the index, so it opens.
  // Captured at mount — a deep link (cell or slice) is a destination of its
  // own, so it keeps the drawer closed rather than racing it.
  const [navOpen, setNavOpen] = useState(
    () =>
      selectedScenarioId === null &&
      selectedPhaseId === null &&
      pendingUrlState === null,
  )
  const [navSurface, setNavSurface] = useState<MobileNavSurface>('blueprints')
  const [agentOpen, setAgentOpen] = useState(false)

  const slicesQuery = useSlices()
  const slices =
    slicesQuery.status === 'ready'
      ? slicesQuery.data
      : slicesQuery.status === 'error'
        ? (slicesQuery.fallback ?? [])
        : []
  // A slice presents full-bleed over the shell — SlicePresentation is
  // already linear (frame by frame), which is exactly a phone's shape.
  const { activeSliceId, presentSlice, dismissSlice } = useMobileSliceDeepLink(
    slices,
    slicesQuery.status === 'loading',
  )

  const phases = useMemo(() => getMainSlides(slides), [slides])
  const scenariosByPhase = useMemo(
    () =>
      new Map<string, NavItem[]>(
        phases.map((phase) => [phase.id, getSubslides(phase.id, slides)]),
      ),
    [phases, slides],
  )

  const scenario = slides.find((slide) => slide.id === selectedScenarioId)
  const phase = slides.find((slide) => slide.id === selectedPhaseId)
  const title = scenario
    ? getSlideDisplayLabel(scenario, slides)
    : surface === 'map' && phase
      ? phase.label
      : 'Service blueprint'

  // ONE path at a time (decided 2026-08-16): the selection lives in the top
  // bar, defaulting to the last path viewed for this scenario (persisted),
  // else the happy path. Same query key as the reader's fetch — the shared
  // cache means this costs no extra request. Render-time latch, not an
  // effect, same idiom the reader used before the lift.
  const { pathsByScenario } = useCanvasBlueprints(
    useMemo(
      () => (selectedScenarioId ? [selectedScenarioId] : []),
      [selectedScenarioId],
    ),
  )
  const paths = selectedScenarioId
    ? (pathsByScenario.get(selectedScenarioId) ?? [])
    : []
  const [pathChoice, setPathChoice] = useState<{
    scenarioId: string
    pathId: string | null
  } | null>(null)
  if (selectedScenarioId && pathChoice?.scenarioId !== selectedScenarioId) {
    setPathChoice({
      scenarioId: selectedScenarioId,
      pathId: readLastViewedPath(selectedScenarioId),
    })
  }
  // Validated against the loaded list every render: a stored id whose path
  // was deleted falls back to the happy path instead of a dead selection.
  const activePathId =
    paths.length > 0
      ? resolveDefaultPathId(pathChoice?.pathId ?? null, paths)
      : null
  const choosePath = (pathId: string) => {
    if (!selectedScenarioId) return
    setPathChoice({ scenarioId: selectedScenarioId, pathId })
    writeLastViewedPath(selectedScenarioId, pathId)
  }

  useEffect(
    () =>
      registerAgentUiBridge(
        makeMobileAgentBridge({
          selectPhase,
          selectScenario,
          setSurface,
          openAgent: () => setAgentOpen(true),
        }),
      ),
    [selectPhase, selectScenario],
  )

  // What the shell knows about the phone's screen, for get_ui_state.
  const shellContext = [
    `Mobile shell (view-only): ${surface === 'reader' ? 'journey reader' : 'map (2-D canvas)'}`,
    scenario
      ? `Selected scenario: "${getSlideDisplayLabel(scenario, slides)}" (${scenario.id})`
      : `Selected scenario: none${view === 'home' ? ' (overview)' : ''}`,
    paths.length > 1 && activePathId
      ? `Reading path: ${paths.find((path) => path.id === activePathId)?.name ?? activePathId}`
      : null,
    `Agent sheet: ${agentOpen ? 'open' : 'closed'}`,
  ]
    .filter(Boolean)
    .join('\n')
  const shellContextRef = useRef(shellContext)
  useEffect(() => {
    shellContextRef.current = shellContext
  })
  useEffect(
    () => registerAgentUiContext('shell', () => shellContextRef.current),
    [],
  )

  // Surface policy: navigation implies the surface. A scenario is a thing
  // you read; a phase is a stretch of the board you look at.
  const openScenario = (scenarioId: string) => {
    selectScenario(scenarioId)
    setSurface('reader')
    setNavOpen(false)
  }
  const openPhase = (phaseId: string) => {
    selectPhase(phaseId)
    setPhaseExpanded(phaseId, true)
    setSurface('map')
    setNavOpen(false)
  }
  const openSlice = (sliceId: string) => {
    presentSlice(sliceId)
    setNavOpen(false)
  }

  const hasSelection = selectedScenarioId !== null || selectedPhaseId !== null

  return (
    <CanvasModeProvider>
      <div className="flex h-svh flex-col overflow-hidden bg-background">
        <MobileTopBar
          title={title}
          navOpen={navOpen}
          onToggleNav={() => setNavOpen((open) => !open)}
          rightSlot={
            surface === 'map' && hasSelection ? (
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-11"
                aria-label="Fit to screen"
                // The same camera the agent drives — the map's viewport
                // registers `zoom` while mounted, so this is one fit path,
                // not a parallel implementation.
                onClick={() => void runAgentUiCommand('zoom', 'fit')}
              >
                <Maximize />
              </Button>
            ) : surface === 'reader' && selectedScenarioId && paths.length > 1 ? (
              <MobilePathSelector
                paths={paths}
                activePathId={activePathId}
                onSelect={choosePath}
              />
            ) : null
          }
        />

        {/* The surface fold. The key is `surface` ALONE: selecting a scenario
            is a camera move inside the canvas, not a screen change, so it must
            not remount the board — the same rule DesktopEditorShell states for
            its own canvas. Keying on the scenario as well used to tear down and
            rebuild the whole subtree on every navigation, which is what jammed
            the main thread and left surfaces half-drawn on top of each other.

            The error boundary sits HERE, inside the chrome, so a throw in one
            view leaves the menu and the agent reachable; its resetKey means
            navigating somewhere else clears it. */}
        <main className="relative min-h-0 flex-1">
          <EditorErrorBoundary
            resetKey={`${surface}:${selectedScenarioId ?? selectedPhaseId ?? 'none'}`}
          >
            <div
              key={surface}
              className={cn(
                'absolute inset-0 animate-in fade-in duration-(--motion-fade) motion-reduce:animate-none',
                surface === 'map' ? 'zoom-in-95' : 'slide-in-from-bottom-4',
              )}
            >
              {surface === 'map' && hasSelection ? (
                <VisualWalkthroughShell>
                  <div className="absolute inset-0 flex min-h-0 flex-col" data-editor-view>
                    {/* Scoped to the selected phase: a phone renders one
                        stretch of the service, never the whole board. */}
                    <ServiceOverviewView soloPhaseId={selectedPhaseId ?? undefined} />
                  </div>
                </VisualWalkthroughShell>
              ) : selectedScenarioId ? (
                <MobileScenarioReader
                  scenarioId={selectedScenarioId}
                  pathId={activePathId}
                />
              ) : (
                <MobileEmptyState onOpenNav={() => setNavOpen(true)} />
              )}
            </div>
          </EditorErrorBoundary>
        </main>
      </div>

      <MobileAgentFab canAgent={canAgent} onOpen={() => setAgentOpen(true)} />

      <MobileNavSheet
        open={navOpen}
        onOpenChange={setNavOpen}
        surface={navSurface}
        onSurfaceChange={setNavSurface}
        slices={slices}
        phases={phases}
        scenariosByPhase={scenariosByPhase}
        slides={slides}
        expandedPhaseIds={expandedPhaseIds}
        onPhaseExpandedChange={setPhaseExpanded}
        selectedPhaseId={selectedPhaseId}
        selectedScenarioId={selectedScenarioId}
        onSelectSlice={openSlice}
        onSelectPhase={openPhase}
        onSelectScenario={openScenario}
      />

      {/* Presenting a slice: full-bleed over everything, Return closes.
          The presentation surface is frame-linear already — phone-shaped. */}
      {activeSliceId ? (
        <div className="fixed inset-0 z-40 bg-background">
          <SlicePresentation
            key={activeSliceId}
            sliceId={activeSliceId}
            onReturn={dismissSlice}
          />
        </div>
      ) : null}

      {canAgent ? (
        <MobileAgentSheet open={agentOpen} onOpenChange={setAgentOpen} />
      ) : null}
    </CanvasModeProvider>
  )
}

/** The drawer closed on an empty shell — the one state with nothing to
 * show. Point back at the menu rather than guessing a destination. */
function MobileEmptyState({ onOpenNav }: { onOpenNav: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
      <p className="text-center text-sm text-muted-foreground">
        Pick a scenario to read it step by step, or a phase to see its map.
      </p>
      <Button variant="outline" size="sm" onClick={onOpenNav}>
        <Menu /> Open the menu
      </Button>
    </div>
  )
}

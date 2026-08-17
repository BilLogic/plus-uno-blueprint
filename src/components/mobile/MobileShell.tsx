import { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize, Menu } from 'lucide-react'
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
import { usePathSelectionContext } from '@/hooks/usePathSelection'
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
import { makeMobileAgentBridge } from '@/components/mobile/mobileAgentBridge'
import { getMainSlides, getSlideDisplayLabel, getSubslides } from '@/types/nav'
import type { NavItem } from '@/types/nav'

/**
 * The phone's shell — the view-only visitor experience, for every tier.
 *
 * ONE surface: the same canvas the desktop shows, scoped to the selected
 * phase so a phone renders one stretch of the service rather than the whole
 * board (the whole board is what used to jam the main thread). There is no
 * mobile-specific reading view (removed 2026-08-17 by request): navigation
 * is a camera move on the shared canvas — tapping a phase frames it,
 * tapping a scenario focuses it. The drawer is the index and opens on
 * first load when nothing is selected. Nothing here can write: no design
 * mode, no editors, and the agent's tool roster is filtered to reading
 * (loop.ts).
 *
 * Paths are SINGLE-select on the phone: the top-bar pill picks exactly one,
 * through the same PathSelection context the desktop's PATHS checkboxes
 * drive, defaulting to the last-viewed path per scenario.
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
    : phase
      ? getSlideDisplayLabel(phase, slides)
      : 'Service blueprint'

  // ONE path at a time (decided 2026-08-16, single-select confirmed
  // 2026-08-17): the pill drives the same PathSelection context the desktop
  // PATHS checkboxes use — the canvas needs no mobile-specific plumbing —
  // but always replaces the whole selection with one path. Defaults to the
  // last-viewed path per scenario (localStorage), else the happy path.
  const { pathsByScenario } = useCanvasBlueprints(
    useMemo(
      () => (selectedScenarioId ? [selectedScenarioId] : []),
      [selectedScenarioId],
    ),
  )
  const { catalog, getSelectedPathIds, setSelectedPathIds } =
    usePathSelectionContext()
  // Prefer the context catalog (what the canvas has synced — the list
  // setSelectedPathIds resolves ids against); the direct query fills the
  // first frames before that sync lands.
  const paths = useMemo(() => {
    if (!selectedScenarioId) return []
    const synced = catalog[selectedScenarioId]
    if (synced && synced.length > 0) return synced
    return pathsByScenario.get(selectedScenarioId) ?? []
  }, [selectedScenarioId, catalog, pathsByScenario])

  // Apply the default once per scenario visit — but only after the canvas
  // has synced this scenario into the context catalog: setSelectedPathIds
  // resolves ids against the catalog, so applying earlier maps to an empty
  // key set and blanks the canvas ("No paths selected"). Also what
  // collapses a desktop multi-select down to one on this shell.
  const appliedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedScenarioId) return
    const catalogPaths = catalog[selectedScenarioId] ?? []
    if (catalogPaths.length === 0) return
    if (appliedForRef.current === selectedScenarioId) return
    appliedForRef.current = selectedScenarioId
    const resolved = resolveDefaultPathId(
      readLastViewedPath(selectedScenarioId),
      catalogPaths,
    )
    if (resolved) setSelectedPathIds(selectedScenarioId, [resolved])
  }, [selectedScenarioId, catalog, setSelectedPathIds])

  const activePathId = selectedScenarioId
    ? (getSelectedPathIds(selectedScenarioId)[0] ??
      resolveDefaultPathId(readLastViewedPath(selectedScenarioId), paths))
    : null
  const choosePath = (pathId: string) => {
    if (!selectedScenarioId) return
    setSelectedPathIds(selectedScenarioId, [pathId])
    writeLastViewedPath(selectedScenarioId, pathId)
  }

  useEffect(
    () =>
      registerAgentUiBridge(
        makeMobileAgentBridge({
          selectPhase,
          selectScenario,
          openAgent: () => setAgentOpen(true),
        }),
      ),
    [selectPhase, selectScenario],
  )

  // What the shell knows about the phone's screen, for get_ui_state.
  const shellContext = [
    'Mobile shell (view-only): the shared canvas, scoped to the selected phase',
    scenario
      ? `Selected scenario: "${getSlideDisplayLabel(scenario, slides)}" (${scenario.id})`
      : `Selected scenario: none${view === 'home' ? ' (overview)' : ''}`,
    paths.length > 0 && activePathId
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

  // Navigation is a camera move on the one canvas; the drawer closes so the
  // move is visible.
  const openScenario = (scenarioId: string) => {
    selectScenario(scenarioId)
    setNavOpen(false)
  }
  const openPhase = (phaseId: string) => {
    selectPhase(phaseId)
    setPhaseExpanded(phaseId, true)
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
            hasSelection ? (
              <>
                {selectedScenarioId && paths.length > 0 ? (
                  <MobilePathSelector
                    paths={paths}
                    activePathId={activePathId}
                    onSelect={choosePath}
                  />
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-11"
                  aria-label="Fit to screen"
                  // The same camera the agent drives — the canvas viewport
                  // registers `zoom` while mounted, so this is one fit
                  // path, not a parallel implementation.
                  onClick={() => void runAgentUiCommand('zoom', 'fit')}
                >
                  <Maximize />
                </Button>
              </>
            ) : null
          }
        />

        {/* The error boundary sits HERE, inside the chrome, so a throw in
            the canvas leaves the menu and the agent reachable; its resetKey
            means navigating somewhere else clears it. The canvas subtree is
            never keyed on the selection: selecting is a camera move, not a
            remount — the remount is what used to jam the main thread. */}
        <main className="relative min-h-0 flex-1">
          <EditorErrorBoundary
            resetKey={selectedScenarioId ?? selectedPhaseId ?? 'none'}
          >
            {hasSelection ? (
              <VisualWalkthroughShell>
                <div
                  className="absolute inset-0 flex min-h-0 flex-col"
                  data-editor-view
                >
                  {/* Scoped to the selected phase: a phone renders one
                      stretch of the service, never the whole board. */}
                  <ServiceOverviewView
                    soloPhaseId={selectedPhaseId ?? undefined}
                  />
                </div>
              </VisualWalkthroughShell>
            ) : (
              <MobileEmptyState onOpenNav={() => setNavOpen(true)} />
            )}
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
        Pick a phase to frame its stretch of the service, or a scenario to
        zoom in on it.
      </p>
      <Button variant="outline" size="sm" onClick={onOpenNav}>
        <Menu /> Open the menu
      </Button>
    </div>
  )
}

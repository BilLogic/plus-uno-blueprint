import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Map as MapIcon, ScrollText, Sparkles } from 'lucide-react'
import { MobileScenarioReader } from '@/components/mobile/MobileScenarioReader'
import { MobileTopBar } from '@/components/mobile/MobileTopBar'
import { MobileNavSheet } from '@/components/mobile/MobileNavSheet'
import { MobileAgentSheet } from '@/components/mobile/MobileAgentSheet'
import { CanvasModeProvider } from '@/components/editor/CanvasModeProvider'
import { ServiceOverviewView } from '@/components/editor/ServiceOverviewView'
import { VisualWalkthroughShell } from '@/components/blueprint/VisualWalkthroughShell'
import { Button } from '@/components/ui/button'
import { SlicePresentation } from '@/components/editor/SlicePresentation'
import { EditorErrorBoundary } from '@/components/EditorErrorBoundary'
import { useEditor } from '@/contexts/EditorContext'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useCellDeepLink } from '@/hooks/useCellDeepLink'
import { useMobileSliceDeepLink } from '@/hooks/useMobileSliceDeepLink'
import { useSlices } from '@/hooks/useSlices'
import {
  registerAgentUiBridge,
  registerAgentUiContext,
} from '@/lib/agent/uiBridge'
import { makeMobileAgentBridge, type MobileSurface } from '@/components/mobile/mobileAgentBridge'
import { getSlideDisplayLabel, ordinalLabel } from '@/types/nav'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/types/nav'

/**
 * The phone's shell — the view-only visitor experience, for every tier.
 *
 * Two ways to read the same board: the READER (default) folds the 2-D grid
 * into a vertical journey, and the MAP is the real canvas with touch
 * pinch/pan. Navigation lives in a left sheet, the agent in a full-height
 * bottom sheet, and nothing here can write: no design mode, no editors,
 * and the agent's tool roster is filtered to reading (see loop.ts).
 *
 * Phase-2 shape (plan 2026-08-16-002): the shell is composition — top bar,
 * surfaces, tab bar, and three extracted children. Surface policy (what a
 * tap means for the visible view) lives HERE, in the handlers, so the
 * Phase-3 model changes one place.
 */


export function MobileShell() {
  const {
    view,
    slides,
    selectPhase,
    selectScenario,
    selectedPhaseId,
    selectedScenarioId,
  } = useEditor()
  const { canAgent } = useSupabase()
  useCellDeepLink()

  const [surface, setSurface] = useState<MobileSurface>('reader')
  const [navOpen, setNavOpen] = useState(false)
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

  const phases = useMemo(
    () => slides.filter((slide) => !slide.parentId),
    [slides],
  )
  const scenariosByPhase = useMemo(() => {
    const map = new Map<string, NavItem[]>()
    for (const slide of slides) {
      if (!slide.parentId) continue
      const list = map.get(slide.parentId)
      if (list) list.push(slide)
      else map.set(slide.parentId, [slide])
    }
    return map
  }, [slides])

  const scenario = slides.find((slide) => slide.id === selectedScenarioId)
  const title = scenario
    ? getSlideDisplayLabel(scenario, slides)
    : 'Service blueprint'

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
    `Agent sheet: ${agentOpen ? 'open' : 'closed'}`,
  ].join('\n')
  const shellContextRef = useRef(shellContext)
  useEffect(() => {
    shellContextRef.current = shellContext
  })
  useEffect(
    () => registerAgentUiContext('shell', () => shellContextRef.current),
    [],
  )

  // Surface policy: what a tap in the nav sheet means for the visible view.
  const openScenario = (scenarioId: string) => {
    selectScenario(scenarioId)
    setSurface('reader')
    setNavOpen(false)
  }
  const openPhase = (phaseId: string) => {
    selectPhase(phaseId)
    setSurface('map')
    setNavOpen(false)
  }
  const openSlice = (sliceId: string) => {
    presentSlice(sliceId)
    setNavOpen(false)
  }

  return (
    <CanvasModeProvider>
      <div className="flex h-svh flex-col overflow-hidden bg-background">
        <MobileTopBar
          title={title}
          canAgent={canAgent}
          onOpenNav={() => setNavOpen(true)}
          onOpenAgent={() => setAgentOpen(true)}
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
              {surface === 'map' ? (
                <VisualWalkthroughShell>
                  <div className="absolute inset-0 flex min-h-0 flex-col" data-editor-view>
                    {/* Scoped to the selected phase: a phone renders one
                        stretch of the service, never the whole board. */}
                    <ServiceOverviewView soloPhaseId={selectedPhaseId ?? undefined} />
                  </div>
                </VisualWalkthroughShell>
              ) : selectedScenarioId ? (
                <MobileScenarioReader scenarioId={selectedScenarioId} />
              ) : (
                <MobileJourneyIndex
                  phases={phases}
                  scenariosByPhase={scenariosByPhase}
                  slides={slides}
                  onOpenScenario={openScenario}
                />
              )}
            </div>
          </EditorErrorBoundary>
        </main>

        {/* Thumb-reach action bar: the reader ⇄ map fold, and the agent.
            Primary navigation earns full-height 44px targets (h-11 beats
            the sm variant's h-7), and aria-pressed carries the active
            state to AT and the forced-colors treatment alike. */}
        <nav
          aria-label="Primary"
          className="flex shrink-0 items-center justify-around border-t border-border bg-background px-4 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]"
        >
          <Button
            variant={surface === 'reader' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-11 flex-1"
            aria-pressed={surface === 'reader'}
            onClick={() => setSurface('reader')}
          >
            <ScrollText /> Journey
          </Button>
          <Button
            variant={surface === 'map' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-11 flex-1"
            aria-pressed={surface === 'map'}
            onClick={() => setSurface('map')}
          >
            <MapIcon /> Map
          </Button>
          {canAgent ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-11 flex-1"
              onClick={() => setAgentOpen(true)}
            >
              <Sparkles /> Ask
            </Button>
          ) : null}
        </nav>
      </div>

      <MobileNavSheet
        open={navOpen}
        onOpenChange={setNavOpen}
        slices={slices}
        phases={phases}
        scenariosByPhase={scenariosByPhase}
        slides={slides}
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

/** No scenario picked yet: the journey's table of contents — every phase
 * with its scenarios, in lifecycle order. The phone's home screen. */
function MobileJourneyIndex({
  phases,
  scenariosByPhase,
  slides,
  onOpenScenario,
}: {
  phases: NavItem[]
  scenariosByPhase: Map<string, NavItem[]>
  slides: NavItem[]
  onOpenScenario: (scenarioId: string) => void
}) {
  return (
    <div className="h-full overflow-y-auto px-4 pb-8 pt-4">
      <p className="pb-4 text-sm text-muted-foreground">
        The service journey, phase by phase. Pick a scenario to read it
        step by step, or open the Map for the whole board.
      </p>
      <ol className="flex flex-col gap-5">
        {phases.map((phase) => (
          <li key={phase.id} className="flex flex-col gap-1.5">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {ordinalLabel(phase.index, phase.label)}
            </p>
            {(scenariosByPhase.get(phase.id) ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenScenario(item.id)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm text-foreground shadow-xs active:bg-accent"
              >
                <span className="min-w-0">
                  <span className="block truncate">
                    {getSlideDisplayLabel(item, slides)}
                  </span>
                  {item.description ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </li>
        ))}
      </ol>
    </div>
  )
}

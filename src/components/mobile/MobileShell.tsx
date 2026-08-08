import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Map as MapIcon, Menu, MoreHorizontal, ScrollText, Sparkles } from 'lucide-react'
import { MobileScenarioReader } from '@/components/mobile/MobileScenarioReader'
import { AgentPanel } from '@/components/editor/AgentPanel'
import { CanvasModeProvider } from '@/components/editor/CanvasModeProvider'
import { ServiceOverviewView } from '@/components/editor/ServiceOverviewView'
import { ThemeToggle } from '@/components/editor/ThemeToggle'
import { VisualWalkthroughShell } from '@/components/blueprint/VisualWalkthroughShell'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { SlicePresentation } from '@/components/editor/SlicePresentation'
import { useEditor } from '@/contexts/EditorContext'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useCellDeepLink } from '@/hooks/useCellDeepLink'
import { useSlices } from '@/hooks/useSlices'
import {
  registerAgentUiBridge,
  registerAgentUiContext,
} from '@/lib/agent/uiBridge'
import { getSlideDisplayLabel } from '@/types/nav'
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
 */

type MobileSurface = 'reader' | 'map'

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
  // A slice presents full-bleed over the shell — SlicePresentation is
  // already linear (frame by frame), which is exactly a phone's shape.
  const [presentingSliceId, setPresentingSliceId] = useState<string | null>(
    null,
  )
  const slicesQuery = useSlices()
  const slices =
    slicesQuery.status === 'ready'
      ? slicesQuery.data
      : slicesQuery.status === 'error'
        ? (slicesQuery.fallback ?? [])
        : []

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

  // The agent's navigation hands on mobile: scenario opens land in the
  // reader (the phone's reading surface), and the ✦ sheet is the agent
  // surface. The sidebar tool has no sidebar to drive here.
  useEffect(
    () =>
      registerAgentUiBridge({
        selectPhase: (phaseId) => {
          selectPhase(phaseId)
          setSurface('map')
        },
        selectScenario: (scenarioId) => {
          selectScenario(scenarioId)
          setSurface('reader')
        },
        openAgentSurface: () => setAgentOpen(true),
        setSidebarCollapsed: () => {},
      }),
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

  const openScenario = (scenarioId: string) => {
    selectScenario(scenarioId)
    setSurface('reader')
    setNavOpen(false)
  }

  return (
    <CanvasModeProvider>
      <div className="flex h-svh flex-col overflow-hidden bg-background">
        {/* Compact top bar: nav · title · agent · overflow. */}
        <header className="flex h-13 shrink-0 items-center gap-1 border-b border-border px-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
          >
            <Menu />
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {title}
          </h1>
          {canAgent ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Ask the agent"
              onClick={() => setAgentOpen(true)}
            >
              <Sparkles />
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="More">
                  <MoreHorizontal />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="flex items-center justify-between gap-4">
                Theme
                <ThemeToggle size="icon-sm" />
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                Editing is available on desktop
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* The two readings of the board, keyed so switching remounts. The
            fold is directional: the Map arrives by growing from a miniature
            (diving INTO the board — and it lands on the semantic-zoom block
            tier, which IS the miniature), the reader rises from below (the
            journey unrolling). Reduced motion swaps instantly. */}
        <main className="relative min-h-0 flex-1">
          <div
            key={surface + (selectedScenarioId ?? 'none')}
            className={cn(
              'absolute inset-0 animate-in fade-in duration-200 motion-reduce:animate-none',
              surface === 'map' ? 'zoom-in-95' : 'slide-in-from-bottom-4',
            )}
          >
            {surface === 'map' ? (
              <VisualWalkthroughShell>
                <div className="absolute inset-0 flex min-h-0 flex-col" data-editor-view>
                  <ServiceOverviewView />
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
        </main>

        {/* Thumb-reach action bar: the reader ⇄ map fold, and the agent. */}
        <nav className="flex shrink-0 items-center justify-around border-t border-border bg-background px-4 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          <Button
            variant={surface === 'reader' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSurface('reader')}
          >
            <ScrollText /> Journey
          </Button>
          <Button
            variant={surface === 'map' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSurface('map')}
          >
            <MapIcon /> Map
          </Button>
          {canAgent ? (
            <Button variant="ghost" size="sm" onClick={() => setAgentOpen(true)}>
              <Sparkles /> Ask
            </Button>
          ) : null}
        </nav>
      </div>

      {/* Navigation: left sheet, phases → scenarios, same progressive
          disclosure as the desktop sidebar. */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-[18rem] overflow-y-auto p-0">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="text-sm">Blueprint</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-2 py-3">
            {slices.length > 0 ? (
              <div className="flex flex-col">
                <p className="px-2 py-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Slices
                </p>
                {slices.map((slice) => (
                  <button
                    key={slice.id}
                    type="button"
                    onClick={() => {
                      setPresentingSliceId(slice.id)
                      setNavOpen(false)
                    }}
                    className="flex items-center justify-between rounded-md py-1.5 pr-2 pl-6 text-left text-sm text-foreground/80"
                  >
                    <span className="min-w-0 truncate">{slice.title}</span>
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : null}
            {phases.map((phase) => (
              <div key={phase.id} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => {
                    selectPhase(phase.id)
                    setSurface('map')
                    setNavOpen(false)
                  }}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-2 py-1.5 text-left font-mono text-xs uppercase tracking-wider',
                    phase.id === selectedPhaseId && !selectedScenarioId
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  {String(phase.index).padStart(2, '0')} · {phase.label}
                </button>
                {(scenariosByPhase.get(phase.id) ?? []).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openScenario(item.id)}
                    className={cn(
                      'flex items-center justify-between rounded-md py-1.5 pr-2 pl-6 text-left text-sm',
                      item.id === selectedScenarioId
                        ? 'bg-accent font-medium text-foreground'
                        : 'text-foreground/80',
                    )}
                  >
                    <span className="min-w-0 truncate">
                      {getSlideDisplayLabel(item, slides)}
                    </span>
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Presenting a slice: full-bleed over everything, Return closes.
          The presentation surface is frame-linear already — phone-shaped. */}
      {presentingSliceId ? (
        <div className="fixed inset-0 z-40 bg-background">
          <SlicePresentation
            key={presentingSliceId}
            sliceId={presentingSliceId}
            onReturn={() => setPresentingSliceId(null)}
          />
        </div>
      ) : null}

      {/* The agent, full-height bottom sheet. AgentPanel state lives in the
          module store (panelState), so open/close never drops a session. */}
      {canAgent ? (
        <Sheet open={agentOpen} onOpenChange={setAgentOpen}>
          <SheetContent
            side="bottom"
            className="flex h-[92svh] flex-col gap-0 rounded-t-2xl p-0"
          >
            <SheetHeader className="border-b border-border px-4 py-3">
              <SheetTitle className="text-sm">Agent</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1">
              <AgentPanel />
            </div>
          </SheetContent>
        </Sheet>
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
    <div className="h-full overflow-y-auto px-4 pb-24 pt-4">
      <p className="pb-4 text-sm text-muted-foreground">
        The service journey, phase by phase. Pick a scenario to read it
        step by step, or open the Map for the whole board.
      </p>
      <ol className="flex flex-col gap-5">
        {phases.map((phase) => (
          <li key={phase.id} className="flex flex-col gap-1.5">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {String(phase.index).padStart(2, '0')} · {phase.label}
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

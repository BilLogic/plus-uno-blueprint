import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { Homepage } from '@/components/editor/Homepage'
import { ServiceOverviewView } from '@/components/editor/ServiceOverviewView'
import {
  FloatingSidebarPill,
  SidebarCollapseButton,
} from '@/components/editor/EditorChrome'
import { EditorRail, type SidebarSurface } from '@/components/editor/EditorRail'
import {
  AgentPanel,
  AgentSettingsRailButton,
} from '@/components/editor/AgentPanel'
import { VisualWalkthroughShell } from '@/components/blueprint/VisualWalkthroughShell'
import { CanvasModeProvider } from '@/components/editor/CanvasModeProvider'
import { SlideModeSidebarNav } from '@/components/editor/SlideModeView'
import { SlicePresentation } from '@/components/editor/SlicePresentation'
import { SliceView } from '@/components/editor/SliceView'
import { TabStrip } from '@/components/editor/TabStrip'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useSupabase } from '@/contexts/SupabaseProvider'
import {
  tabKey,
  useViewState,
  type TabDescriptor,
} from '@/contexts/viewStateStore'
import {
  registerAgentUiBridge,
  registerAgentUiContext,
} from '@/lib/agent/uiBridge'
import { suppressCanvasResizeRefit } from '@/lib/canvasChromeResize'
import { getSlideDisplayLabel } from '@/types/nav'
import {
  MOTION_STRUCTURAL_EASE,
  MOTION_STRUCTURAL_MS,
  prefersReducedMotion,
} from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Aside = rail (48px) + content panel. The agent surface gets a wider
 * default — transcripts need line length a nav tree doesn't — and every
 * surface is drag-resizable from the aside's right edge, remembered
 * per surface.
 */
const RAIL_WIDTH = 48
const DEFAULT_ASIDE_WIDTH: Record<SidebarSurface, number> = {
  blueprints: 288,
  slices: 288,
  agent: 368,
}
const MIN_ASIDE_WIDTH = 240
const MAX_ASIDE_WIDTH = 640
const WIDTH_STORAGE_KEY = 'uno-sidebar-widths'

function loadAsideWidths(): Record<SidebarSurface, number> {
  try {
    const raw = window.localStorage.getItem(WIDTH_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    const clamp = (value: unknown, fallback: number) =>
      typeof value === 'number' && Number.isFinite(value)
        ? Math.min(MAX_ASIDE_WIDTH, Math.max(MIN_ASIDE_WIDTH, value))
        : fallback
    return {
      blueprints: clamp(parsed.blueprints, DEFAULT_ASIDE_WIDTH.blueprints),
      slices: clamp(parsed.slices, DEFAULT_ASIDE_WIDTH.slices),
      agent: clamp(parsed.agent, DEFAULT_ASIDE_WIDTH.agent),
    }
  } catch {
    return { ...DEFAULT_ASIDE_WIDTH }
  }
}

export function EditorShell() {
  const {
    view,
    goHome,
    selectPhase,
    selectScenario,
    selectedPhaseId,
    selectedScenarioId,
    slides,
  } = useEditor()
  const { activeTab, activateTab, openTab } = useViewState()
  const { canWrite } = useSupabase()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const isLanding = view === 'landing'
  // Home reads as active only on the overview canvas itself, and only while
  // no tab is covering it.
  const isOverview = view === 'home' && activeTab === null

  const activeTabKind = activeTab?.kind ?? null

  // The rail picks a surface. Slice/present tab activation auto-selects ◇,
  // exactly as the old horizontal tabs did (initializer covers remounts
  // while a tab is already active, e.g. returning from a presentation).
  const [surface, setSurface] = useState<SidebarSurface>(
    activeTabKind !== null ? 'slices' : 'blueprints',
  )
  const [lastTabKind, setLastTabKind] = useState(activeTabKind)
  if (lastTabKind !== activeTabKind) {
    setLastTabKind(activeTabKind)
    if (activeTabKind !== null) setSurface('slices')
  }

  // Leaving presentation runs before the tab actually switches: tabs unmount
  // on switch, so the exit animation has to play while the present tab is
  // still mounted. `leavingPresent` drops the shell back to its non-present
  // pose (sidebar expands) while the presentation surface fades out, then
  // the tab switch lands at the end of the same 320 ms.
  const [leavingPresent, setLeavingPresent] = useState(false)
  const leaveTimer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current)
    },
    [],
  )

  // Presentation is full-bleed: the whole sidebar collapses (the pill hides
  // too — Return is the way back), on the same 320 ms width ease as a manual
  // collapse. It never unmounts, which is what keeps entering smooth.
  const presenting = activeTabKind === 'present' && !leavingPresent

  const railOnly = presenting || sidebarCollapsed

  useEffect(() => {
    // Entering and leaving presentation both resize the canvas container.
    suppressCanvasResizeRefit()
  }, [presenting])

  // Hand the agent its navigation hands: open_phase / open_scenario tools
  // land on the same callbacks the sidebar rows use.
  useEffect(
    () =>
      registerAgentUiBridge({
        selectPhase,
        selectScenario,
        openAgentSurface: () => {
          setSurface('agent')
          setSidebarCollapsed(false)
        },
        setSidebarCollapsed: (collapsed) => {
          suppressCanvasResizeRefit()
          setSidebarCollapsed(collapsed)
        },
      }),
    [selectPhase, selectScenario],
  )

  // The read side: what the shell itself knows about what's on screen.
  // Ref-refreshed each render, registered once — the collector always sees
  // the latest without effect churn.
  const phaseSlide = slides.find((slide) => slide.id === selectedPhaseId)
  const scenarioSlide = slides.find((slide) => slide.id === selectedScenarioId)
  const shellContext = [
    `View level: ${view}${view === 'home' ? ' (zoomed-out overview of all phases)' : ''}`,
    phaseSlide
      ? `Selected phase: "${getSlideDisplayLabel(phaseSlide, slides)}" (${phaseSlide.id})`
      : 'Selected phase: none',
    scenarioSlide
      ? `Selected scenario: "${getSlideDisplayLabel(scenarioSlide, slides)}" (${scenarioSlide.id})`
      : 'Selected scenario: none',
    activeTab
      ? `Active tab: ${activeTab.kind} for slice ${activeTab.sliceId}`
      : 'Active tab: base blueprint view (no slice tab)',
    `Sidebar: ${surface} surface${railOnly ? ', collapsed' : ''}${presenting ? ', presenting' : ''}`,
  ].join('\n')
  const shellContextRef = useRef(shellContext)
  useEffect(() => {
    shellContextRef.current = shellContext
  })
  useEffect(
    () => registerAgentUiContext('shell', () => shellContextRef.current),
    [],
  )

  const toggleSidebar = () => {
    // The width ease resizes the canvas container for 320 ms. That is
    // chrome moving, not the user navigating — the camera holds still.
    suppressCanvasResizeRefit()
    setSidebarCollapsed((collapsed) => !collapsed)
  }

  // Per-surface drag-resize. During a drag the width transition is off —
  // easing against the pointer reads as lag, not motion.
  const [asideWidths, setAsideWidths] = useState(loadAsideWidths)
  const [resizing, setResizing] = useState(false)
  const asideWidth = asideWidths[surface]
  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setResizing(true)
    suppressCanvasResizeRefit()
  }
  const moveResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizing) return
    // The aside is flush with the window's left edge, so the pointer's x IS
    // the aside width.
    const next = Math.min(
      MAX_ASIDE_WIDTH,
      Math.max(MIN_ASIDE_WIDTH, Math.round(event.clientX)),
    )
    suppressCanvasResizeRefit()
    setAsideWidths((widths) =>
      widths[surface] === next ? widths : { ...widths, [surface]: next },
    )
  }
  const endResize = () => {
    if (!resizing) return
    setResizing(false)
    setAsideWidths((widths) => {
      try {
        window.localStorage.setItem(WIDTH_STORAGE_KEY, JSON.stringify(widths))
      } catch {
        // Width memory is a nicety; failing to store is fine.
      }
      return widths
    })
  }

  /**
   * Return: exit presentation onto that slice's focus tab, creating the tab
   * if it is not already open. The three entry moves play in reverse over
   * the same durations before the switch commits.
   */
  const exitPresentation = useCallback(
    (sliceId: string) => {
      if (leaveTimer.current !== null) return
      const land = () => {
        leaveTimer.current = null
        openTab({ kind: 'slice', sliceId })
        setLeavingPresent(false)
      }
      if (prefersReducedMotion()) {
        land()
        return
      }
      setLeavingPresent(true)
      suppressCanvasResizeRefit()
      leaveTimer.current = window.setTimeout(land, MOTION_STRUCTURAL_MS)
    },
    [openTab],
  )

  // Home (in the tab strip) is the route back to the birds-eye overview
  // canvas — it deactivates any tab, clears the selection and animates the
  // fit, exactly like Escape and the workspace breadcrumb. `goHome` (not
  // `enterCanvas`) so every overview return has the same feel.
  const goOverview = () => {
    activateTab(null)
    goHome()
  }

  // What counts as a content switch for the crossfade. Navigation *inside*
  // the base canvas (home ⇄ detail) is a camera move, not a screen change,
  // so it deliberately keeps the same key.
  const contentKey = activeTab
    ? tabKey(activeTab)
    : isLanding
      ? 'landing'
      : 'blueprint'

  const sidebarBody = (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-row">
      <EditorRail
        surface={surface}
        onSelectSurface={(next) => {
          setSurface(next)
          if (sidebarCollapsed) {
            suppressCanvasResizeRefit()
            setSidebarCollapsed(false)
          }
        }}
        showAgent={canWrite}
        topSlot={
          <SidebarCollapseButton collapsed={false} onToggle={toggleSidebar} />
        }
        bottomSlot={canWrite ? <AgentSettingsRailButton /> : undefined}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <SidebarProvider
          style={
            {
              '--sidebar-width': `${asideWidth - RAIL_WIDTH}px`,
            } as CSSProperties
          }
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          {surface === 'agent' ? (
            <AgentPanel />
          ) : (
            <SlideModeSidebarNav surface={surface} />
          )}
        </SidebarProvider>
      </div>
    </div>
  )

  return (
    // The base surface's mode, hoisted to include the sidebar.
    //
    // It used to wrap only the canvas, which left the sidebar unable to answer
    // "are we editing?" — so its `+` and `⋯` were on in View mode, offering to
    // create and rename things on a surface whose whole premise is that it
    // changes nothing. A slice tab still mounts its own provider inside this
    // one and shadows it, which is what keeps the two surfaces independent.
    <CanvasModeProvider>
      <div
        className="relative flex h-svh flex-col overflow-hidden bg-background"
        data-editor-shell
      >
        {/* Full-width top nav: workspace identity, Home, open tabs. */}
        <TabStrip
          isOverview={isOverview}
          onHome={goOverview}
          onBase={() => activateTab(null)}
        />

        <div className="relative flex min-h-0 min-w-0 flex-1">
          <aside
            className={cn(
              'relative z-20 shrink-0 overflow-hidden bg-sidebar',
              !railOnly && 'border-r border-border',
            )}
            style={{
              width: railOnly ? 0 : asideWidth,
              transitionProperty: resizing ? 'none' : 'width',
              transitionDuration: `${MOTION_STRUCTURAL_MS}ms`,
              transitionTimingFunction: MOTION_STRUCTURAL_EASE,
            }}
            data-editor-sidebar=""
            data-collapsed={railOnly ? '' : undefined}
            aria-label="Workspace navigation"
          >
            {/*
              Fixed-width sidebar body (rail + panel). In flow it is clipped
              by the animating aside, so open/close reads as a wipe rather
              than a mount/unmount.
            */}
            <div
              className={cn(
                'flex h-full min-h-0 flex-row',
                'transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
                railOnly
                  ? 'pointer-events-none -translate-x-2 opacity-0'
                  : 'translate-x-0 opacity-100 delay-75',
              )}
              style={{ width: asideWidth }}
              aria-hidden={railOnly}
            >
              {sidebarBody}
            </div>
            {/* Drag the aside's right edge to resize; width is remembered
                per surface. Hidden while collapsed — there is no edge. */}
            {!railOnly ? (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize sidebar"
                onPointerDown={startResize}
                onPointerMove={moveResize}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                className={cn(
                  'absolute inset-y-0 right-0 z-30 w-1.5 cursor-col-resize',
                  'hover:bg-border/80 active:bg-border',
                  resizing && 'bg-border',
                )}
              />
            ) : null}
          </aside>

          {/*
            Collapsed remnant: the floating pill over the canvas. Hidden
            while presenting (full-bleed; Return is the way back). Its
            toggle is the same single control the rail carries expanded.
          */}
          {railOnly && !presenting ? (
            <div className="pointer-events-none absolute left-3 top-3 z-30">
              <FloatingSidebarPill onExpand={toggleSidebar} />
            </div>
          ) : null}

          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="relative min-h-0 min-w-0 flex-1">
              {/*
                Only the active tab's content mounts, so switching is a
                fade-through rather than a true crossfade: the keyed wrapper
                remounts and the incoming surface fades up over 200 ms after
                the 75 ms stagger the sidebar already uses.
              */}
              <div
                key={contentKey}
                className="absolute inset-0"
                data-editor-content=""
              >
                <ActiveTabContent
                  tab={activeTab}
                  isLanding={isLanding}
                  leavingPresent={leavingPresent}
                  onReturn={exitPresentation}
                />
              </div>
            </div>
          </main>
        </div>
      </div>
    </CanvasModeProvider>
  )
}

function ActiveTabContent({
  tab,
  isLanding,
  leavingPresent,
  onReturn,
}: {
  tab: TabDescriptor | null
  isLanding: boolean
  leavingPresent: boolean
  onReturn: (sliceId: string) => void
}) {
  if (tab === null) {
    // Base blueprint view — existing landing / home / detail behavior.
    return isLanding ? (
      <Homepage />
    ) : (
      // No provider here: the base surface's mode is the shell's, so the
      // sidebar and this canvas are always in the same one.
      <VisualWalkthroughShell>
        <div
          className="absolute inset-0 flex min-h-0 flex-col"
          data-editor-view
        >
          <ServiceOverviewView />
        </div>
      </VisualWalkthroughShell>
    )
  }
  switch (tab.kind) {
    case 'slice':
      return <SliceView key={tabKey(tab)} sliceId={tab.sliceId} />
    case 'present':
      return (
        <SlicePresentation
          key={tabKey(tab)}
          sliceId={tab.sliceId}
          leaving={leavingPresent}
          onReturn={() => onReturn(tab.sliceId)}
        />
      )
  }
}

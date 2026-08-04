import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { Homepage } from '@/components/editor/Homepage'
import { ServiceOverviewView } from '@/components/editor/ServiceOverviewView'
import {
  FloatingSidebarPill,
  SidebarCollapseButton,
  TopNavWorkspace,
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
import { suppressCanvasResizeRefit } from '@/lib/canvasChromeResize'
import {
  MOTION_STRUCTURAL_EASE,
  MOTION_STRUCTURAL_MS,
  prefersReducedMotion,
} from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Aside = rail (48px) + content panel. The agent surface gets a wider
 * panel — transcripts need line length a nav tree doesn't.
 */
const ASIDE_WIDTH_CLASS: Record<SidebarSurface, string> = {
  blueprints: 'w-[288px]',
  slices: 'w-[288px]',
  agent: 'w-[368px]',
}
const PANEL_WIDTH_PX: Record<SidebarSurface, string> = {
  blueprints: '15rem',
  slices: '15rem',
  agent: '20rem',
}

export function EditorShell() {
  const { view, goHome, goLanding } = useEditor()
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

  const toggleSidebar = () => {
    // The width ease resizes the canvas container for 320 ms. That is
    // chrome moving, not the user navigating — the camera holds still.
    suppressCanvasResizeRefit()
    setSidebarCollapsed((collapsed) => !collapsed)
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

  // The orientation landing page lives on the workspace title.
  const goLandingBase = () => {
    activateTab(null)
    goLanding()
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
              '--sidebar-width': PANEL_WIDTH_PX[surface],
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
          leading={
            <TopNavWorkspace
              isLanding={isLanding}
              onWorkspaceTitle={goLandingBase}
            />
          }
        />

        <div className="relative flex min-h-0 min-w-0 flex-1">
          <aside
            className={cn(
              'relative z-20 shrink-0 overflow-hidden bg-sidebar',
              railOnly ? 'w-0' : cn(ASIDE_WIDTH_CLASS[surface], 'border-r border-border'),
            )}
            style={{
              transitionProperty: 'width',
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
                ASIDE_WIDTH_CLASS[surface],
                'transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
                railOnly
                  ? 'pointer-events-none -translate-x-2 opacity-0'
                  : 'translate-x-0 opacity-100 delay-75',
              )}
              aria-hidden={railOnly}
            >
              {sidebarBody}
            </div>
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

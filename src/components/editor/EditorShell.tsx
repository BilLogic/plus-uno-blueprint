import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { Homepage } from '@/components/editor/Homepage'
import { ServiceOverviewView } from '@/components/editor/ServiceOverviewView'
import {
  EditorSidebarWorkspaceHeader,
  SidebarCollapseButton,
} from '@/components/editor/EditorChrome'
import {
  EDITOR_SIDEBAR_COLLAPSED_WIDTH_CLASS,
  EDITOR_SIDEBAR_WIDTH_CLASS,
  EDITOR_SIDEBAR_WIDTH_PX,
} from '@/components/editor/EditorSidebarRail'
import { VisualWalkthroughShell } from '@/components/blueprint/VisualWalkthroughShell'
import { SlideModeSidebarNav } from '@/components/editor/SlideModeView'
import { SlicePresentation } from '@/components/editor/SlicePresentation'
import { SliceView } from '@/components/editor/SliceView'
import { TabStrip } from '@/components/editor/TabStrip'
import { SidebarProvider } from '@/components/ui/sidebar'
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

export function EditorShell() {
  const { view, goHome, goLanding } = useEditor()
  const { activeTab, activateTab, openTab } = useViewState()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  // Hovering the collapsed rail peeks the panel back as an overlay. It floats
  // above the canvas rather than pushing it, so peeking never resizes the
  // stage — which is what makes it usable during a presentation.
  const [railHovered, setRailHovered] = useState(false)
  const isLanding = view === 'landing'
  // Home reads as active only on the overview canvas itself, and only while
  // no tab is covering it.
  const isOverview = view === 'home' && activeTab === null

  // The sidebar stays expanded (and functional) while a slice tab is
  // active — the Paths filter now lives there, and phase clicks return to
  // the base view via the nav wiring.
  const activeTabKind = activeTab?.kind ?? null

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

  // Presentation is full-bleed: the sidebar collapses to its icon rail on
  // the same 320 ms width ease as every other collapse — it never unmounts,
  // which is what used to make entering presentation snap. The user can still
  // pin it open from the rail while presenting; the pin is per-presentation.
  const presenting = activeTabKind === 'present' && !leavingPresent
  const [presentPinned, setPresentPinned] = useState(false)
  // Reset during render rather than in an effect: leaving presentation must
  // not paint one frame with a stale pin.
  const [wasPresenting, setWasPresenting] = useState(presenting)
  if (wasPresenting !== presenting) {
    setWasPresenting(presenting)
    if (!presenting) setPresentPinned(false)
  }

  const railOnly = presenting ? !presentPinned : sidebarCollapsed
  // Peeked = the panel is showing as an overlay over the canvas rather than
  // in flow. Only reachable from the collapsed rail.
  const peeked = railOnly && railHovered

  useEffect(() => {
    // Entering and leaving presentation both resize the canvas container.
    suppressCanvasResizeRefit()
  }, [presenting])

  const toggleSidebar = () => {
    // The width ease resizes the canvas container for 320 ms. That is
    // chrome moving, not the user navigating — the camera holds still.
    suppressCanvasResizeRefit()
    setRailHovered(false)
    if (presenting) setPresentPinned((pinned) => !pinned)
    else setSidebarCollapsed((collapsed) => !collapsed)
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

  // Home (now in the tab strip) is the route back to the birds-eye overview
  // canvas — it deactivates any tab, clears the selection and animates the
  // fit, exactly like Escape and the workspace breadcrumb. `goHome` (not
  // `enterCanvas`) so every overview return has the same feel.
  const goOverview = () => {
    activateTab(null)
    goHome()
  }

  // The orientation landing page moved onto the workspace title.
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

  return (
    <div
      className="relative flex h-svh overflow-hidden bg-background"
      data-editor-shell
    >
      <aside
        className={cn(
          'relative z-20 flex shrink-0 flex-col border-r border-border bg-sidebar',
          // Only clip while the panel is in flow: a peek overlay has to escape
          // the rail's 48 px.
          peeked ? 'overflow-visible' : 'overflow-hidden',
          railOnly
            ? EDITOR_SIDEBAR_COLLAPSED_WIDTH_CLASS
            : EDITOR_SIDEBAR_WIDTH_CLASS,
        )}
        style={{
          transitionProperty: 'width',
          transitionDuration: `${MOTION_STRUCTURAL_MS}ms`,
          transitionTimingFunction: MOTION_STRUCTURAL_EASE,
        }}
        data-editor-sidebar=""
        data-collapsed={railOnly ? '' : undefined}
        aria-label="Workspace navigation"
        onMouseEnter={() => setRailHovered(true)}
        onMouseLeave={() => setRailHovered(false)}
      >
        {/*
          Fixed-width expanded panel. In flow it is clipped by the animating
          aside, so open/close reads as a wipe rather than a mount/unmount;
          peeked from the rail it lifts out as an overlay (same 200 ms fade,
          8 px slide) and leaves the canvas exactly where it is.
        */}
        <div
          className={cn(
            'flex h-full min-h-0 w-60 flex-col',
            'transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
            peeked &&
              'absolute inset-y-0 left-0 z-30 border-r border-border bg-sidebar shadow-lg',
            railOnly && !peeked
              ? 'pointer-events-none -translate-x-2 opacity-0'
              : 'translate-x-0 opacity-100 delay-75',
          )}
          aria-hidden={railOnly && !peeked}
        >
          <SidebarProvider
            style={
              {
                '--sidebar-width': EDITOR_SIDEBAR_WIDTH_PX,
              } as CSSProperties
            }
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <EditorSidebarWorkspaceHeader
              sidebarCollapsed={railOnly}
              onToggleSidebar={toggleSidebar}
              isLanding={isLanding}
              onWorkspaceTitle={goLandingBase}
            />
            <SlideModeSidebarNav />
          </SidebarProvider>
        </div>

        {/*
          Collapsed icon rail — crossfades in as the panel closes. Its toggle
          is what pins the peeked panel open (in presentation too: that button
          used to be removed there, which left no way back to the nav).
        */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 z-10 flex w-12 flex-col items-center gap-1 px-1 py-2',
            'transition-opacity duration-200 ease-out',
            railOnly ? 'opacity-100 delay-75' : 'pointer-events-none opacity-0',
          )}
          aria-hidden={!railOnly}
        >
          <SidebarCollapseButton
            collapsed
            onToggle={toggleSidebar}
            size="icon-sm"
          />
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TabStrip isOverview={isOverview} onHome={goOverview} />
        <div className="relative min-h-0 min-w-0 flex-1">
          {/*
            Only the active tab's content mounts, so switching is a
            fade-through rather than a true crossfade: the keyed wrapper
            remounts and the incoming surface fades up over 200 ms after the
            75 ms stagger the sidebar already uses.
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

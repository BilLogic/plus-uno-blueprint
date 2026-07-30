import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { Homepage } from '@/components/editor/Homepage'
import { ServiceOverviewView } from '@/components/editor/ServiceOverviewView'
import {
  EditorSidebarWorkspaceHeader,
  HomeNavButton,
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
  const { activeTab, activateTab, openTab, tabs } = useViewState()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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
  // which is what used to make entering presentation snap.
  const presenting = activeTabKind === 'present' && !leavingPresent
  const railOnly = sidebarCollapsed || presenting

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

  // Same reasoning for the tab strip appearing/disappearing: opening the
  // first slice tab (or closing the last) changes the canvas height.
  const hasTabs = tabs.length > 0
  useEffect(() => {
    suppressCanvasResizeRefit()
  }, [hasTabs])

  // Home is the sidebar's route to the birds-eye overview canvas (nav plan
  // D2) — it deactivates any tab, clears the selection and animates the fit,
  // exactly like Escape and the workspace breadcrumb. `goHome` (not
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

  return (
    <div
      className="relative flex h-svh overflow-hidden bg-background"
      data-editor-shell
    >
      <aside
        className={cn(
          'relative flex shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar',
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
      >
        {/*
          Fixed-width expanded panel — clipped by the animating aside so open/
          close reads as a wipe instead of a hard mount/unmount.
        */}
        <div
          className={cn(
            'flex h-full min-h-0 w-60 flex-col',
            'transition-opacity duration-200 ease-out',
            railOnly
              ? 'pointer-events-none opacity-0'
              : 'opacity-100 delay-75',
          )}
          aria-hidden={railOnly}
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
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebar={toggleSidebar}
              isHome={isOverview}
              onHome={goOverview}
              isLanding={isLanding}
              onWorkspaceTitle={goLandingBase}
            />
            <SlideModeSidebarNav />
          </SidebarProvider>
        </div>

        {/* Collapsed icon rail — crossfades in as the panel closes. */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 z-10 flex w-12 flex-col items-center gap-1 px-1 py-2',
            'transition-opacity duration-200 ease-out',
            railOnly
              ? 'opacity-100 delay-75'
              : 'pointer-events-none opacity-0',
          )}
          aria-hidden={!railOnly}
        >
          <HomeNavButton
            isActive={isOverview}
            onClick={goOverview}
            size="icon-sm"
          />
          {/* Presentation already forces the rail; offering a collapse
              toggle there would be a button that changes nothing. */}
          {!presenting && (
            <SidebarCollapseButton
              collapsed={sidebarCollapsed}
              onToggle={toggleSidebar}
              size="icon-sm"
            />
          )}
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TabStrip />
        <div className="relative min-h-0 min-w-0 flex-1">
          {/* Only the active tab's content mounts. */}
          <div className="absolute inset-0">
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

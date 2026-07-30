import { useState, type CSSProperties } from 'react'
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
import { tabKey, useViewState, type TabDescriptor } from '@/contexts/viewStateStore'
import { cn } from '@/lib/utils'

const SIDEBAR_WIDTH_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

export function EditorShell() {
  const { view, goLanding } = useEditor()
  const { activeTab, activateTab } = useViewState()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const isLanding = view === 'landing'

  // The sidebar's phase/scenario nav drives the base blueprint view, so it
  // auto-collapses to the icon rail while a slice/present tab is active and
  // re-expands on return — unless the user toggled it manually in between
  // (a manual expand on a slice tab makes the nav return to the base view
  // on click).
  const activeTabKind = activeTab?.kind ?? null
  const [autoCollapsed, setAutoCollapsed] = useState(false)
  const [lastTabKind, setLastTabKind] = useState(activeTabKind)
  if (lastTabKind !== activeTabKind) {
    setLastTabKind(activeTabKind)
    if (activeTabKind !== null) {
      if (!sidebarCollapsed) {
        setSidebarCollapsed(true)
        setAutoCollapsed(true)
      }
    } else if (autoCollapsed) {
      setSidebarCollapsed(false)
      setAutoCollapsed(false)
    }
  }

  const toggleSidebar = () => {
    setAutoCollapsed(false)
    setSidebarCollapsed((collapsed) => !collapsed)
  }

  // Home always returns to the base blueprint view (deactivating any tab)
  // before landing on the homepage.
  const goHomeBase = () => {
    activateTab(null)
    goLanding()
  }

  return (
    <div
      className="relative flex h-svh overflow-hidden bg-background"
      data-editor-shell
    >
      {/* Presentation is full-bleed: the sidebar unmounts entirely while a
          present tab is active; the tab strip stays visible for exit. */}
      {activeTabKind !== 'present' && (
      <aside
        className={cn(
          'relative flex shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar',
          sidebarCollapsed
            ? EDITOR_SIDEBAR_COLLAPSED_WIDTH_CLASS
            : EDITOR_SIDEBAR_WIDTH_CLASS,
        )}
        style={{
          transitionProperty: 'width',
          transitionDuration: '320ms',
          transitionTimingFunction: SIDEBAR_WIDTH_EASE,
        }}
        data-editor-sidebar=""
        data-collapsed={sidebarCollapsed ? '' : undefined}
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
            sidebarCollapsed
              ? 'pointer-events-none opacity-0'
              : 'opacity-100 delay-75',
          )}
          aria-hidden={sidebarCollapsed}
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
              isHome={isLanding}
              onHome={goHomeBase}
            />
            <SlideModeSidebarNav />
          </SidebarProvider>
        </div>

        {/* Collapsed icon rail — crossfades in as the panel closes. */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 z-10 flex w-12 flex-col items-center gap-1 px-1 py-2',
            'transition-opacity duration-200 ease-out',
            sidebarCollapsed
              ? 'opacity-100 delay-75'
              : 'pointer-events-none opacity-0',
          )}
          aria-hidden={!sidebarCollapsed}
        >
          <HomeNavButton
            isActive={isLanding}
            onClick={goHomeBase}
            size="icon-sm"
          />
          <SidebarCollapseButton
            collapsed={sidebarCollapsed}
            onToggle={toggleSidebar}
            size="icon-sm"
          />
        </div>
      </aside>
      )}

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TabStrip />
        <div className="relative min-h-0 min-w-0 flex-1">
          {/* Only the active tab's content mounts. */}
          <ActiveTabContent tab={activeTab} isLanding={isLanding} />
        </div>
      </main>
    </div>
  )
}

function ActiveTabContent({
  tab,
  isLanding,
}: {
  tab: TabDescriptor | null
  isLanding: boolean
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
      return <SlicePresentation key={tabKey(tab)} sliceId={tab.sliceId} />
  }
}

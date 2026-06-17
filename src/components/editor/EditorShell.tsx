import { useState, type CSSProperties } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { CanvasModeView } from '@/components/editor/CanvasModeView'
import {
  EditorModeChrome,
  EditorSidebarChromeSpacer,
  EditorSidebarWorkspaceHeader,
} from '@/components/editor/EditorModeChrome'
import {
  EDITOR_SIDEBAR_COLLAPSED_WIDTH_CLASS,
  EDITOR_SIDEBAR_WIDTH_CLASS,
} from '@/components/editor/EditorSidebarRail'
import { VisualWalkthroughShell } from '@/components/blueprint/VisualWalkthroughShell'
import { SlideModeMain, SlideModeSidebarNav } from '@/components/editor/SlideModeView'
import { SidebarProvider } from '@/components/ui/sidebar'
import { CANVAS_VIEW_ENABLED } from '@/types/slides'
import { cn } from '@/lib/utils'

export function EditorShell() {
  const { mode } = useEditor()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const isStack = !CANVAS_VIEW_ENABLED || mode === 'stack'

  return (
    <div className="relative flex h-svh overflow-hidden bg-background">
      <aside
        className={cn(
          'flex shrink-0 flex-col overflow-hidden border-r border-border bg-muted/20 transition-[width,border-color,opacity] duration-300 ease-in-out dark:bg-muted/10',
          isStack
            ? sidebarCollapsed
              ? EDITOR_SIDEBAR_COLLAPSED_WIDTH_CLASS
              : EDITOR_SIDEBAR_WIDTH_CLASS
            : 'w-0 border-r-0 opacity-0',
        )}
        aria-hidden={!isStack}
      >
        <EditorSidebarChromeSpacer collapsed={sidebarCollapsed} />
        {!sidebarCollapsed && (
          <SidebarProvider
            style={
              {
                '--sidebar-width': '15rem',
              } as CSSProperties
            }
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <EditorSidebarWorkspaceHeader
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebar={() =>
                setSidebarCollapsed((collapsed) => !collapsed)
              }
            />
            <SlideModeSidebarNav />
          </SidebarProvider>
        )}
      </aside>

      <main className="relative min-h-0 min-w-0 flex-1">
        <VisualWalkthroughShell>
          <div
            className={cn(
              'absolute inset-0 flex min-h-0 flex-col transition-opacity duration-300 ease-in-out',
              isStack ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
            aria-hidden={!isStack}
          >
            <SlideModeMain />
          </div>
          {CANVAS_VIEW_ENABLED && (
            <div
              className={cn(
                'absolute inset-0 transition-opacity duration-300 ease-in-out',
                isStack ? 'pointer-events-none opacity-0' : 'opacity-100',
              )}
              aria-hidden={isStack}
            >
              <CanvasModeView />
            </div>
          )}
        </VisualWalkthroughShell>
      </main>

      <EditorModeChrome
        mode={mode}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((collapsed) => !collapsed)}
      />
    </div>
  )
}

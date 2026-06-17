import { PanelLeft } from 'lucide-react'
import { EditorModeToggle } from '@/components/editor/EditorModeToggle'
import { Button } from '@/components/ui/button'
import { CANVAS_VIEW_ENABLED, type EditorMode } from '@/types/slides'
import { cn } from '@/lib/utils'

function EditorTitleLabel() {
  return (
    <p className="truncate text-sm font-medium leading-tight text-foreground">
      PLUS Uno Blueprint
    </p>
  )
}

type SidebarCollapseButtonProps = {
  collapsed: boolean
  onToggle: () => void
  className?: string
  size?: 'icon-sm' | 'icon-xs'
}

export function SidebarCollapseButton({
  collapsed,
  onToggle,
  className,
  size = 'icon-xs',
}: SidebarCollapseButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      className={cn(
        'shrink-0 text-muted-foreground hover:text-foreground',
        className,
      )}
      onClick={onToggle}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      <PanelLeft
        className={cn(
          'size-3.5 transition-transform duration-300 ease-in-out',
          !collapsed && 'rotate-180',
        )}
      />
    </Button>
  )
}

type EditorSidebarWorkspaceHeaderProps = {
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
}

export function EditorSidebarWorkspaceHeader({
  sidebarCollapsed = false,
  onToggleSidebar,
}: EditorSidebarWorkspaceHeaderProps) {
  const showCollapse = !CANVAS_VIEW_ENABLED && onToggleSidebar

  return (
    <div
      className={cn(
        'shrink-0 px-3 py-2',
        showCollapse && 'flex items-center gap-2',
      )}
      data-editor-app-title
    >
      {showCollapse && (
        <SidebarCollapseButton
          collapsed={sidebarCollapsed}
          onToggle={onToggleSidebar}
        />
      )}
      <div className={cn(showCollapse && 'min-w-0 flex-1')}>
        <EditorTitleLabel />
      </div>
    </div>
  )
}

type EditorModeChromeProps = {
  mode: EditorMode
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function EditorModeChrome({
  mode,
  sidebarCollapsed,
  onToggleSidebar,
}: EditorModeChromeProps) {
  if (!CANVAS_VIEW_ENABLED) {
    if (!sidebarCollapsed) return null

    return (
      <div
        className="pointer-events-auto absolute left-0 top-0 z-30 flex w-12 justify-center px-1 py-2 transition-all duration-300 ease-in-out"
        data-editor-mode-toggle
        onPointerDown={(e) => e.stopPropagation()}
      >
        <SidebarCollapseButton
          collapsed={sidebarCollapsed}
          onToggle={onToggleSidebar}
          size="icon-sm"
          className="self-center"
        />
      </div>
    )
  }

  const isStack = mode === 'stack'
  const isCanvas = mode === 'canvas'

  return (
    <div
      className={cn(
        'pointer-events-auto absolute z-30 transition-all duration-300 ease-in-out',
        isCanvas &&
          'left-3 top-3 rounded-lg border border-border bg-background/95 px-2 py-1.5 shadow-sm backdrop-blur-sm',
        isStack &&
          cn(
            'left-0 top-0 rounded-none border-b border-border/60 bg-muted/20 shadow-none backdrop-blur-none dark:bg-muted/10',
            sidebarCollapsed ? 'w-12 px-1 py-2' : 'w-60 px-2 py-1.5',
          ),
      )}
      data-editor-mode-toggle
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          'flex w-full transition-[gap] duration-300 ease-in-out',
          isCanvas && 'items-center',
          isStack &&
            cn(
              sidebarCollapsed
                ? 'flex-col items-center justify-center gap-1.5'
                : 'flex-row items-center gap-2',
            ),
        )}
      >
        {isStack && (
          <SidebarCollapseButton
            collapsed={sidebarCollapsed}
            onToggle={onToggleSidebar}
            size={sidebarCollapsed ? 'icon-sm' : 'icon-xs'}
            className={sidebarCollapsed ? 'self-center' : 'self-start'}
          />
        )}

        <EditorModeToggle
          layout={isStack && sidebarCollapsed ? 'vertical' : 'horizontal'}
          compact
          className={cn(
            'shrink-0 transition-[transform,opacity] duration-300 ease-in-out',
            isStack && sidebarCollapsed && 'mx-auto !w-7',
            isStack && !sidebarCollapsed && 'ml-auto !w-auto',
            isCanvas && '!w-auto',
          )}
        />
      </div>
    </div>
  )
}

/** Reserve space under the fixed chrome in stack mode. */
export function EditorSidebarChromeSpacer({
  collapsed,
}: {
  collapsed: boolean
}) {
  if (!CANVAS_VIEW_ENABLED) return null

  return (
    <div
      aria-hidden
      className={cn(
        'shrink-0 transition-[height] duration-300 ease-in-out',
        collapsed ? 'h-[5.75rem]' : 'h-10',
      )}
    />
  )
}

import { Home, PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function EditorTitleLabel() {
  return (
    <p className="truncate text-sm font-medium leading-tight text-foreground">
      Uno Blueprint
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
          'size-3.5 transition-transform duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
          !collapsed && 'rotate-180',
        )}
      />
    </Button>
  )
}

type HomeNavButtonProps = {
  isActive?: boolean
  onClick: () => void
  className?: string
  size?: 'icon-sm' | 'icon-xs'
}

export function HomeNavButton({
  isActive = false,
  onClick,
  className,
  size = 'icon-xs',
}: HomeNavButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      className={cn(
        'shrink-0 text-muted-foreground hover:text-foreground',
        isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
        className,
      )}
      onClick={onClick}
      aria-label="Home"
      aria-current={isActive ? 'page' : undefined}
    >
      <Home className="size-3.5" />
    </Button>
  )
}

type EditorSidebarWorkspaceHeaderProps = {
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
  isHome?: boolean
  onHome?: () => void
}

export function EditorSidebarWorkspaceHeader({
  sidebarCollapsed = false,
  onToggleSidebar,
  isHome = false,
  onHome,
}: EditorSidebarWorkspaceHeaderProps) {
  return (
    <div
      className="flex shrink-0 items-center gap-2 px-3 py-2"
      data-editor-app-title
    >
      {onHome ? (
        <HomeNavButton isActive={isHome} onClick={onHome} />
      ) : null}
      <div className="min-w-0 flex-1">
        <EditorTitleLabel />
      </div>
      {onToggleSidebar ? (
        <SidebarCollapseButton
          collapsed={sidebarCollapsed}
          onToggle={onToggleSidebar}
        />
      ) : null}
    </div>
  )
}

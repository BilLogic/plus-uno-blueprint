import { Home, PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { cn } from '@/lib/utils'

const EDITOR_TITLE = 'Uno Blueprint'

/**
 * Workspace name. Since Home now goes to the overview canvas (nav plan D2),
 * the title is the sidebar's route to the orientation landing page — a
 * button when that action is wired, plain text otherwise.
 */
function EditorTitleLabel({
  onClick,
  isActive = false,
}: {
  onClick?: () => void
  isActive?: boolean
}) {
  const className = 'truncate text-sm font-medium leading-tight text-foreground'

  if (!onClick) return <p className={className}>{EDITOR_TITLE}</p>

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'block w-full rounded-md px-1 py-0.5 text-left transition-colors hover:bg-sidebar-accent',
        className,
      )}
      title="Go to the workspace landing page"
    >
      {EDITOR_TITLE}
    </button>
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
  /** The orientation landing page is the current view. */
  isLanding?: boolean
  /** Workspace title → landing page (D2). */
  onWorkspaceTitle?: () => void
}

/**
 * Workspace title + the collapse toggle. Home moved to the tab strip: it was
 * sitting where the nav's disclosure chevrons now live, and the tab strip
 * keeps it in one place across every sidebar state.
 */
export function EditorSidebarWorkspaceHeader({
  sidebarCollapsed = false,
  onToggleSidebar,
  isLanding = false,
  onWorkspaceTitle,
}: EditorSidebarWorkspaceHeaderProps) {
  const { isDevAuthoring, isEditPreview } = useSupabase()

  return (
    <div
      className="flex shrink-0 items-center gap-2 px-3 py-2"
      data-editor-app-title
    >
      <div className="min-w-0 flex-1">
        <EditorTitleLabel onClick={onWorkspaceTitle} isActive={isLanding} />
      </div>
      {/* Writing with the local authoring key is a privileged state that
          looks exactly like the read-only app otherwise. Say so. */}
      {isDevAuthoring ? (
        <span
          className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
          title="Local authoring key in use — writes go to the live database"
        >
          authoring
        </span>
      ) : null}
      {/* The opposite state, and it must not look like the one above: the Edit
          surfaces are visible so they can be worked on, and every write will
          be refused. Amber says "careful, this is live"; slate says "nothing
          you do here lands". */}
      {isEditPreview ? (
        <span
          className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
          title="Edit UI preview — no authoring key, so writes will be refused"
        >
          edit preview
        </span>
      ) : null}
      {onToggleSidebar ? (
        <SidebarCollapseButton
          collapsed={sidebarCollapsed}
          onToggle={onToggleSidebar}
        />
      ) : null}
    </div>
  )
}

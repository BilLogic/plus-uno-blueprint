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

function WorkspaceBadges() {
  const { isDevAuthoring, isEditPreview } = useSupabase()
  return (
    <>
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
    </>
  )
}

type TopNavWorkspaceProps = {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  /** The orientation landing page is the current view. */
  isLanding?: boolean
  /** Workspace title → landing page (D2). */
  onWorkspaceTitle?: () => void
}

/**
 * The workspace identity group at the top nav's left end: collapse toggle,
 * title, environment badges. It used to head the sidebar; the top nav spans
 * the full window now, so identity moved up where it survives every sidebar
 * state — including fully collapsed, when the floating pill mirrors it.
 */
export function TopNavWorkspace({
  sidebarCollapsed,
  onToggleSidebar,
  isLanding = false,
  onWorkspaceTitle,
}: TopNavWorkspaceProps) {
  return (
    <div
      className="flex min-w-0 shrink-0 items-center gap-1.5"
      data-editor-app-title
    >
      <SidebarCollapseButton
        collapsed={sidebarCollapsed}
        onToggle={onToggleSidebar}
        size="icon-sm"
      />
      <div className="min-w-0 max-w-48">
        <EditorTitleLabel onClick={onWorkspaceTitle} isActive={isLanding} />
      </div>
      <WorkspaceBadges />
    </div>
  )
}

/**
 * The collapsed sidebar's remnant: a floating pill over the canvas (Figma's
 * collapsed-file-chip). Hovering it peeks the full sidebar as an overlay;
 * the button pins it back into flow.
 */
export function FloatingSidebarPill({
  onExpand,
  onHoverChange,
}: {
  onExpand: () => void
  onHoverChange: (hovered: boolean) => void
}) {
  return (
    <div
      className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border bg-background/95 py-1 pl-3 pr-1 shadow-md backdrop-blur-sm"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      data-editor-sidebar-pill
    >
      <p className="max-w-40 truncate text-xs font-medium text-foreground">
        {EDITOR_TITLE}
      </p>
      <SidebarCollapseButton collapsed onToggle={onExpand} size="icon-sm" />
    </div>
  )
}

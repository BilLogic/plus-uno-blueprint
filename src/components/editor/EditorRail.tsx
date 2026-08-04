import type { ReactNode } from 'react'
import { Diamond, LayoutGrid, Sparkles } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Figma's sidebar IA: the rail picks a *surface* — what the content panel
 * shows — never a canvas mode. A third surface (Agent) is why the old
 * horizontal Blueprints|Slices segmented control retired: three labels ate
 * the panel's width; three icons cost 48px once.
 */
export type SidebarSurface = 'blueprints' | 'slices' | 'agent'

export const EDITOR_RAIL_WIDTH_CLASS = 'w-12'

const SURFACES: Array<{
  id: SidebarSurface
  label: string
  icon: typeof LayoutGrid
}> = [
  { id: 'blueprints', label: 'Blueprints', icon: LayoutGrid },
  { id: 'slices', label: 'Slices', icon: Diamond },
  { id: 'agent', label: 'Agent', icon: Sparkles },
]

function RailButton({
  label,
  selected,
  onClick,
  children,
}: {
  label: string
  selected?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-pressed={selected}
            onClick={onClick}
            className={cn(
              'relative flex size-9 items-center justify-center rounded-md transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
              selected
                ? 'bg-sidebar-selected text-sidebar-selected-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-selected-rail'
                : 'text-sidebar-foreground/60 hover:bg-sidebar-hover hover:text-sidebar-accent-foreground',
            )}
          >
            {children}
          </button>
        }
      />
      <TooltipContent side="right" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * The vertical icon rail. `topSlot` holds the sidebar's ONE collapse
 * toggle — same corner the floating pill occupies when collapsed.
 * `bottomSlot` is pinned under a spacer — the ⚙ settings entry lives there
 * so keys are reachable from any surface.
 */
export function EditorRail({
  surface,
  onSelectSurface,
  showAgent,
  topSlot,
  bottomSlot,
}: {
  surface: SidebarSurface
  onSelectSurface: (surface: SidebarSurface) => void
  /** Deployed read-only builds hide the agent surface entirely. */
  showAgent: boolean
  topSlot?: ReactNode
  bottomSlot?: ReactNode
}) {
  return (
    <TooltipProvider delay={300}>
      <nav
        aria-label="Sidebar surfaces"
        className={cn(
          'flex h-full shrink-0 flex-col items-center gap-1 border-r border-border/60 px-1.5 py-2',
          EDITOR_RAIL_WIDTH_CLASS,
        )}
        data-editor-rail
      >
        {topSlot ? (
          <>
            {topSlot}
            <div className="my-0.5 h-px w-6 shrink-0 bg-border/60" aria-hidden />
          </>
        ) : null}
        {SURFACES.filter((entry) => entry.id !== 'agent' || showAgent).map(
          ({ id, label, icon: Icon }) => (
            <RailButton
              key={id}
              label={label}
              selected={surface === id}
              onClick={() => onSelectSurface(id)}
            >
              <Icon className="size-4" aria-hidden />
            </RailButton>
          ),
        )}
        <div className="flex-1" aria-hidden />
        {bottomSlot}
      </nav>
    </TooltipProvider>
  )
}

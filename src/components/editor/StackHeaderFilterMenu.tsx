import { Plus } from 'lucide-react'
import { PathLabelBadge } from '@/components/blueprint/PathLabelBadge'
import {
  PathMultiSelect,
  type PathOption,
} from '@/components/blueprint/PathMultiSelect'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type StackHeaderFilterMenuProps = {
  paths: PathOption[]
  selectedPathIds: string[]
  onTogglePath: (pathId: string) => void
  /** Path descriptions are scenario-specific — only enable on scenario views. */
  showPathTooltips?: boolean
  className?: string
}

/**
 * Navbar paths control — one bounded multi-select field: a `Paths` label,
 * then a bordered chip well holding the active path chips (each removable)
 * and an `+ Add` trigger that opens the path checklist.
 */
export function StackHeaderFilterMenu({
  paths,
  selectedPathIds,
  onTogglePath,
  showPathTooltips = false,
  className,
}: StackHeaderFilterMenuProps) {
  if (paths.length === 0) return null

  const selectedIdSet = new Set(selectedPathIds)
  const activePaths = paths.filter((path) => selectedIdSet.has(path.id))
  const selectedCount = activePaths.length
  const totalCount = paths.length
  const allSelected = selectedCount === totalCount

  return (
    <div
      className={cn('flex min-w-0 shrink items-center gap-1.5', className)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <span
        id="navbar-paths-label"
        className="shrink-0 text-xs font-medium text-muted-foreground"
      >
        Paths
      </span>
      <div
        role="group"
        aria-labelledby="navbar-paths-label"
        className={cn(
          'flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden',
          'rounded-md border border-border/80 bg-card py-0.5 pr-0.5 pl-1 shadow-xs',
        )}
      >
        {activePaths.length > 0 ? (
          <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
            {activePaths.map((path) => (
              <PathLabelBadge
                key={path.id}
                name={path.name}
                description={path.description}
                pathType={path.path_type}
                compact
                side="bottom"
                className="h-4.5 max-w-[9rem] rounded-sm px-1.5 text-[11px]"
                onRemove={() => onTogglePath(path.id)}
                showTooltip={showPathTooltips}
              />
            ))}
          </div>
        ) : (
          <span className="px-1 text-[11px] text-muted-foreground/70">
            No paths shown
          </span>
        )}

        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="xs"
                className="h-4.5 shrink-0 gap-0.5 rounded-sm px-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              />
            }
            aria-label={
              allSelected
                ? 'Choose paths'
                : `Add paths (${selectedCount} of ${totalCount} shown)`
            }
          >
            <Plus className="size-3" aria-hidden />
            Add
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={6} className="w-64 p-3">
            <PathMultiSelect
              paths={paths}
              selectedPathIds={selectedPathIds}
              onToggle={onTogglePath}
              layout="vertical"
              hideLabel
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

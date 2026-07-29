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
 * Active path badges + "Add Paths" checklist for the top navbar.
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
  const isFiltered = selectedCount < totalCount

  return (
    <div
      className={cn('flex min-w-0 shrink items-center gap-1.5', className)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {activePaths.length > 0 ? (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {activePaths.map((path) => (
            <PathLabelBadge
              key={path.id}
              name={path.name}
              description={path.description}
              pathType={path.path_type}
              compact
              side="bottom"
              className="max-w-[9rem]"
              onRemove={() => onTogglePath(path.id)}
              showTooltip={showPathTooltips}
            />
          ))}
        </div>
      ) : null}

      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="icon-xs"
              className="shrink-0 rounded-full"
            />
          }
          aria-label={
            isFiltered
              ? `Add paths (${selectedCount} of ${totalCount} shown)`
              : 'Add paths'
          }
        >
          <Plus aria-hidden />
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
  )
}

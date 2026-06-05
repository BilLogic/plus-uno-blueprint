import { PathMultiSelect, type PathOption } from '@/components/blueprint/PathMultiSelect'
import { ViewTypeSelect } from '@/components/blueprint/ViewTypeSelect'
import { cn } from '@/lib/utils'
import type { SlideViewType } from '@/types/slides'

type ScenarioSlideHeaderProps = {
  title: string
  description?: string | null
  phaseLabel?: string
  viewType: SlideViewType
  onViewTypeChange: (viewType: SlideViewType) => void
  paths?: PathOption[]
  selectedPathIds?: string[]
  onTogglePath?: (pathId: string) => void
  compact?: boolean
  className?: string
}

export function ScenarioSlideHeader({
  title,
  description,
  phaseLabel,
  viewType,
  onViewTypeChange,
  paths = [],
  selectedPathIds = [],
  onTogglePath,
  compact = false,
  className,
}: ScenarioSlideHeaderProps) {
  const showPathPicker = paths.length > 0 && onTogglePath

  return (
    <header
      className={cn(
        'flex w-full min-w-full shrink-0 flex-col border-b border-border',
        compact ? 'mb-3 pb-3' : 'mb-6 pb-6',
        className,
      )}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="min-w-0">
        {phaseLabel && (
          <p
            className={cn(
              'font-medium uppercase tracking-wide text-muted-foreground',
              compact ? 'text-[10px]' : 'text-xs',
            )}
          >
            {phaseLabel}
          </p>
        )}
        <h1
          className={cn(
            'font-semibold tracking-tight text-foreground',
            compact ? 'text-xl' : 'text-3xl md:text-4xl',
            phaseLabel && 'mt-1',
          )}
        >
          {title}
        </h1>
        {description && (
          <p
            className={cn(
              'mt-2 max-w-3xl text-muted-foreground',
              compact ? 'text-xs leading-relaxed' : 'text-base leading-relaxed',
            )}
          >
            {description}
          </p>
        )}
      </div>

      <div
        className={cn(
          'flex flex-row flex-wrap items-start gap-6',
          compact ? 'mt-3 gap-4' : 'mt-4',
        )}
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={compact ? 'canvas-scenario-view-type' : 'scenario-view-type'}
            className="text-sm font-medium text-foreground"
          >
            View type
          </label>
          <ViewTypeSelect
            id={compact ? 'canvas-scenario-view-type' : 'scenario-view-type'}
            value={viewType}
            onChange={onViewTypeChange}
          />
        </div>

        {showPathPicker && (
          <PathMultiSelect
            paths={paths}
            selectedPathIds={selectedPathIds}
            onToggle={onTogglePath}
            layout="vertical"
          />
        )}
      </div>
    </header>
  )
}

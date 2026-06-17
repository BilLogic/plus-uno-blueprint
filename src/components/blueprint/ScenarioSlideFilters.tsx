import {
  PathMultiSelect,
  type PathOption,
} from '@/components/blueprint/PathMultiSelect'
import { ViewTypeSelect } from '@/components/blueprint/ViewTypeSelect'
import { cn } from '@/lib/utils'
import {
  SCENARIO_VIEW_TYPE_OPTIONS,
  SLIDE_VIEW_TYPE_LABELS,
  type SlideViewType,
} from '@/types/slides'
import { filterToolbarButtonClass } from '@/lib/filterToolbarButton'

type ScenarioSlideFiltersProps = {
  viewType: SlideViewType
  onViewTypeChange: (viewType: SlideViewType) => void
  paths?: PathOption[]
  selectedPathIds?: string[]
  onTogglePath?: (pathId: string) => void
  layout?: 'horizontal' | 'vertical' | 'bar'
  viewTypeId?: string
  className?: string
  variant?: 'default' | 'bar' | 'toolbar' | 'panel'
}

export function ScenarioSlideFilters({
  viewType,
  onViewTypeChange,
  paths = [],
  selectedPathIds = [],
  onTogglePath,
  layout = 'horizontal',
  viewTypeId = 'scenario-view-type',
  className,
  variant = 'default',
}: ScenarioSlideFiltersProps) {
  const showPathPicker = paths.length > 0 && onTogglePath

  if (variant === 'panel') {
    return (
      <div
        className={cn('flex flex-col gap-4', className)}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">View</span>
          <div className="flex gap-2">
            {SCENARIO_VIEW_TYPE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onViewTypeChange(option)}
                className={filterToolbarButtonClass(viewType === option, 'flex-1')}
                aria-pressed={viewType === option}
              >
                {SLIDE_VIEW_TYPE_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        {showPathPicker && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Paths</span>
            <PathMultiSelect
              paths={paths}
              selectedPathIds={selectedPathIds}
              onToggle={onTogglePath}
              layout="vertical"
              hideLabel
            />
          </div>
        )}
      </div>
    )
  }

  if (variant === 'toolbar') {
    return (
      <div
        className={cn('flex flex-wrap items-center justify-start gap-2', className)}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <label
          htmlFor={viewTypeId}
          className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-muted/50 px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <span className="text-muted-foreground">View</span>
          <ViewTypeSelect
            id={viewTypeId}
            value={viewType}
            onChange={onViewTypeChange}
            variant="toolbar"
            size="sm"
          />
        </label>

        {showPathPicker && (
          <PathMultiSelect
            paths={paths}
            selectedPathIds={selectedPathIds}
            onToggle={onTogglePath}
            layout="toolbar"
            hideLabel
          />
        )}
      </div>
    )
  }

  if (variant === 'bar') {
    return (
      <div
        className={cn(
          'flex flex-row flex-wrap items-center gap-x-3 gap-y-1',
          className,
        )}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          <label
            htmlFor={viewTypeId}
            className="shrink-0 text-xs font-medium text-muted-foreground"
          >
            View
          </label>
          <ViewTypeSelect
            id={viewTypeId}
            value={viewType}
            onChange={onViewTypeChange}
            size="sm"
          />
        </div>

        {showPathPicker && (
          <>
            <div className="h-3.5 w-px shrink-0 bg-border" aria-hidden />
            <div className="rounded-md bg-muted/40 px-2 py-0.5">
              <PathMultiSelect
                paths={paths}
                selectedPathIds={selectedPathIds}
                onToggle={onTogglePath}
                layout="bar"
                hideLabel
              />
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn('flex flex-row flex-wrap items-start gap-6', className)}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={viewTypeId}
          className="text-sm font-medium text-foreground"
        >
          View type
        </label>
        <ViewTypeSelect
          id={viewTypeId}
          value={viewType}
          onChange={onViewTypeChange}
        />
      </div>

      {showPathPicker && (
        <PathMultiSelect
          paths={paths}
          selectedPathIds={selectedPathIds}
          onToggle={onTogglePath}
          layout={layout}
        />
      )}
    </div>
  )
}

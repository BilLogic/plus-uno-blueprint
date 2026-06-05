import { cn } from '@/lib/utils'
import {
  SCENARIO_VIEW_TYPE_OPTIONS,
  SLIDE_VIEW_TYPE_LABELS,
  type SlideViewType,
} from '@/types/slides'

type ViewTypeSelectProps = {
  value: SlideViewType
  onChange: (value: SlideViewType) => void
  className?: string
  id?: string
}

export function ViewTypeSelect({
  value,
  onChange,
  className,
  id = 'scenario-view-type',
}: ViewTypeSelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as SlideViewType)}
      className={cn(
        'h-9 w-full min-w-[10rem] rounded-lg border border-input bg-background px-2.5 text-sm text-foreground',
        'outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
    >
      {SCENARIO_VIEW_TYPE_OPTIONS.map((viewType) => (
        <option key={viewType} value={viewType}>
          {SLIDE_VIEW_TYPE_LABELS[viewType]}
        </option>
      ))}
    </select>
  )
}

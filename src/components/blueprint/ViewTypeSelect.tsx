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
  size?: 'default' | 'sm'
  variant?: 'default' | 'notion' | 'toolbar'
}

export function ViewTypeSelect({
  value,
  onChange,
  className,
  id = 'scenario-view-type',
  size = 'default',
  variant = 'default',
}: ViewTypeSelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as SlideViewType)}
      className={cn(
        'text-foreground outline-none transition-colors',
        variant === 'default' &&
          'rounded-md border border-input bg-background focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        variant === 'notion' &&
          'cursor-pointer border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0',
        variant === 'toolbar' &&
          'h-auto min-w-0 cursor-pointer border-0 bg-transparent p-0 text-sm font-medium shadow-none focus-visible:ring-0',
        variant === 'default' && size === 'default' && 'h-9 w-full min-w-[10rem] px-2.5 text-sm',
        variant === 'default' && size === 'sm' && 'h-7 min-w-[7.5rem] px-2 text-xs',
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

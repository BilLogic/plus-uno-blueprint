import { LayoutGrid } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { CANVAS_VIEW_ENABLED, type EditorMode } from '@/types/slides'

function StackModeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect
        x="2"
        y="3"
        width="12"
        height="1.75"
        rx="0.35"
        stroke="currentColor"
        strokeWidth="1"
      />
      <rect
        x="2"
        y="7.125"
        width="12"
        height="1.75"
        rx="0.35"
        stroke="currentColor"
        strokeWidth="1"
      />
      <rect
        x="2"
        y="11.25"
        width="12"
        height="1.75"
        rx="0.35"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  )
}

type EditorModeToggleProps = {
  className?: string
  layout?: 'horizontal' | 'vertical'
  compact?: boolean
}

export function EditorModeToggle({
  className,
  layout = 'horizontal',
  compact = false,
}: EditorModeToggleProps) {
  const { mode, setMode } = useEditor()

  return (
    <ToggleGroup
      data-editor-mode-toggle
      value={[mode]}
      onValueChange={(values) => {
        const next = values[0] as EditorMode | undefined
        if (next) setMode(next)
      }}
      variant="outline"
      size="sm"
      spacing={compact ? 0 : 2}
      orientation={layout === 'vertical' ? 'vertical' : 'horizontal'}
      className={cn(
        layout === 'vertical' && 'flex-col',
        compact && layout === 'vertical' && 'w-[4.5rem] shrink-0',
        compact && layout === 'horizontal' && 'shrink-0',
        className,
      )}
    >
      <ToggleGroupItem
        value="stack"
        aria-label="Stack"
        className={cn(
          compact
            ? 'size-7 min-h-7 min-w-7 justify-center p-0'
            : 'gap-1.5 px-3',
          layout === 'vertical' && !compact && 'w-full justify-start',
        )}
        onClick={() => setMode('stack')}
      >
        <StackModeIcon className={cn('shrink-0', compact ? 'size-3.5' : 'size-4')} />
        {!compact && <span>Stack</span>}
      </ToggleGroupItem>
      {CANVAS_VIEW_ENABLED && (
        <ToggleGroupItem
          value="canvas"
          aria-label="Canvas"
          className={cn(
            compact
              ? 'size-7 min-h-7 min-w-7 justify-center p-0'
              : 'gap-1.5 px-3',
            layout === 'vertical' && !compact && 'w-full justify-start',
          )}
          onClick={() => setMode('canvas')}
        >
          <LayoutGrid className={cn('shrink-0', compact ? 'size-3.5' : 'size-4')} />
          {!compact && <span>Canvas</span>}
        </ToggleGroupItem>
      )}
    </ToggleGroup>
  )
}

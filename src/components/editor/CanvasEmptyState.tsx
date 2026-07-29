import { cn } from '@/lib/utils'

type CanvasEmptyStateProps = {
  className?: string
  title?: string
  description?: string
  /**
   * `canvas` — full viewport placeholder (no paths selected).
   * `panel` — inside a scenario compare card.
   * `phase` — inside a phase frame with no matching scenarios.
   */
  variant?: 'canvas' | 'panel' | 'phase'
}

/** Empty-canvas / empty-panel placeholder for path filter states. */
export function CanvasEmptyState({
  className,
  title = 'No paths selected',
  description = 'Choose one or more paths from Visible Paths to populate the canvas.',
  variant = 'canvas',
}: CanvasEmptyStateProps) {
  const isCanvas = variant === 'canvas'
  const isPanel = variant === 'panel'
  const isPhase = variant === 'phase'

  return (
    <div
      className={cn(
        'flex',
        isCanvas && 'min-h-0 flex-1 items-center justify-center px-6',
        isPanel && 'h-full min-h-[220px] w-[640px] items-stretch p-1',
        isPhase && 'min-h-[220px] w-full items-stretch',
        className,
      )}
      data-canvas-empty-state={variant}
    >
      <div
        className={cn(
          'flex flex-col justify-center',
          isCanvas && 'max-w-sm gap-2',
          isPanel &&
            'w-full flex-1 gap-1.5 rounded-xl border border-dashed border-black/10 bg-[color:var(--blueprint-panel-section-fill,#f4f4f7)] px-5 py-6',
          isPhase &&
            'w-full flex-1 gap-1.5 rounded-xl border border-dashed border-black/10 bg-white/60 px-6 py-7',
        )}
      >
        <p
          className={cn(
            'font-medium tracking-tight text-foreground/90',
            isCanvas ? 'text-sm' : 'text-xs',
          )}
        >
          {title}
        </p>
        <p
          className={cn(
            'text-muted-foreground',
            isCanvas
              ? 'text-xs leading-relaxed'
              : 'max-w-[18rem] text-[11px] leading-snug',
          )}
        >
          {description}
        </p>
      </div>
    </div>
  )
}

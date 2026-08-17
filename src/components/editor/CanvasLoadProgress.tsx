import { Diamond } from 'lucide-react'
import {
  loadProgressLabel,
  loadProgressPercent,
  loadProgressUnitPercent,
  type CanvasLoadStage,
} from '@/lib/canvasLoadProgress'
import { cn } from '@/lib/utils'

/**
 * Determinate canvas-load progress (plan 2026-08-17-001): mark, 2 px track,
 * stage label — centered over the canvas pad while the shaped skeleton
 * holds the geometry. Every tick is a completed query stage; there is no
 * timer fill, so a stalled stage shows a stalled bar, which is the honest
 * signal. Rendered inside the skeleton's own DeferredSkeleton session, so
 * it inherits the 250 ms hold (fast loads never see it) and leaves in the
 * same commit the content fades in.
 *
 * Presentation only (`aria-hidden`): the skeleton wrapper already carries
 * `role="status"` + the sr-only "Loading…", and a second announcement per
 * tick would be noise.
 */
export function CanvasLoadProgress({
  stages,
  units,
  className,
}: {
  stages: CanvasLoadStage[]
  /**
   * Real work-unit counts (settled requests / issued requests). When given,
   * the bar's width comes from these instead of the coarse stage fraction —
   * stages still name the work via the label.
   */
  units?: { loaded: number; total: number }
  className?: string
}) {
  const percent = units
    ? loadProgressUnitPercent(units.loaded, units.total)
    : loadProgressPercent(stages)
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none flex flex-col items-center gap-3',
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-card/80">
        <Diamond className="size-4 text-muted-foreground" />
      </div>
      <div className="h-0.5 w-40 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-400 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {loadProgressLabel(stages)}
      </p>
    </div>
  )
}

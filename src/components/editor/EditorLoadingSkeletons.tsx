import { Skeleton } from '@/components/ui/skeleton'
import { BLUEPRINT_NAVBAR_BAR_CLASS } from '@/components/editor/menubarHeaderLayout'
import { BLUEPRINT_THEME } from '@/lib/blueprintTheme'
import { COMPARE_MIN_PANEL_HEIGHT } from '@/lib/sideBySideCompareLayout'
import { cn } from '@/lib/utils'

type BlueprintPanelLoadingSkeletonProps = {
  className?: string
  /** Approximate panel height (defaults to compare min). */
  height?: number
  /**
   * Fixed width in px. Pass `null` for fluid/`w-full` (pair with className).
   * Defaults to 640.
   */
  width?: number | null
  /** Show a title chip above the panel. */
  showTitle?: boolean
}

/** Single scenario/blueprint panel placeholder. */
export function BlueprintPanelLoadingSkeleton({
  className,
  height = COMPARE_MIN_PANEL_HEIGHT,
  width = 640,
  showTitle = true,
}: BlueprintPanelLoadingSkeletonProps) {
  const isFluid = width == null

  return (
    <div
      className={cn('flex shrink-0 flex-col gap-2', className)}
      aria-hidden
    >
      {showTitle ? <Skeleton className="h-5 w-40 rounded-full" /> : null}
      <Skeleton
        className={cn('rounded-2xl', isFluid && 'w-full min-h-[320px]')}
        style={{
          height,
          ...(isFluid ? {} : { width }),
        }}
      />
    </div>
  )
}

/** Docked canvas navbar placeholder. */
export function CanvasNavbarLoadingSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <div
      data-editor-navbar
      className={cn(
        'relative flex h-9 items-center justify-center',
        BLUEPRINT_NAVBAR_BAR_CLASS,
        className,
      )}
      aria-hidden
    >
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-28 rounded-full" />
        <Skeleton className="h-4 w-3" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="size-5 rounded-full" />
      </div>
      <div className="absolute inset-y-0 right-4 flex items-center">
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  )
}

type ServiceOverviewLoadingSkeletonProps = {
  className?: string
  /** How many phase rows to hint. */
  phaseCount?: number
}

/**
 * Full service-overview loading state — navbar + stacked phase/panel shapes.
 */
export function ServiceOverviewLoadingSkeleton({
  className,
  phaseCount = 3,
}: ServiceOverviewLoadingSkeletonProps) {
  return (
    <div
      className={cn('flex min-h-0 min-w-0 flex-1 flex-col', className)}
      role="status"
      aria-busy="true"
      aria-label="Loading service overview"
    >
      <CanvasNavbarLoadingSkeleton />
      <div
        className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
        style={{ backgroundColor: BLUEPRINT_THEME.viewportPad }}
      >
        <div className="flex flex-col gap-14 p-8">
          {Array.from({ length: phaseCount }, (_, phaseIndex) => (
            <div key={phaseIndex} className="flex flex-col gap-3">
              <Skeleton className="h-5 w-36 rounded-full" />
              <div className="flex items-stretch gap-8">
                {Array.from(
                  { length: phaseIndex === 0 ? 3 : 2 },
                  (_, panelIndex) => (
                    <BlueprintPanelLoadingSkeleton
                      key={panelIndex}
                      height={280}
                      width={420}
                      showTitle
                    />
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading service overview…</span>
    </div>
  )
}

/** Full detail-canvas loading state (navbar + single blueprint). */
export function SlideCanvasLoadingSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <div
      className={cn('flex min-h-0 min-w-0 flex-1 flex-col', className)}
      role="status"
      aria-busy="true"
      aria-label="Loading blueprint"
    >
      <CanvasNavbarLoadingSkeleton />
      <div
        className="relative min-h-0 min-w-0 flex-1 overflow-hidden p-8"
        style={{ backgroundColor: BLUEPRINT_THEME.viewportPad }}
      >
        <BlueprintPanelLoadingSkeleton height={420} width={720} />
      </div>
      <span className="sr-only">Loading blueprint…</span>
    </div>
  )
}

/** Sidebar phase/scenario list placeholder. */
export function SlideNavLoadingSkeleton({
  rows = 6,
}: {
  rows?: number
}) {
  return (
    <div className="flex flex-col gap-1 px-1" aria-hidden>
      <Skeleton className="mb-1 h-7 w-full rounded-md" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-1">
          <Skeleton
            className="h-7 rounded-md"
            style={{ width: `${72 + ((i * 11) % 28)}%` }}
          />
          {i % 2 === 0 ? (
            <div className="ml-3 flex flex-col gap-1 border-l border-border/50 pl-2">
              <Skeleton className="h-6 w-[85%] rounded-md" />
              <Skeleton className="h-6 w-[70%] rounded-md" />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

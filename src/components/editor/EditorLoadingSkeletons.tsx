import { Fragment } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  OVERVIEW_CANVAS_PADDING_X,
  OVERVIEW_CANVAS_PADDING_Y,
  OVERVIEW_PHASE_ROW_GAP,
  OVERVIEW_PHASE_SECTION_BOTTOM_INSET,
  OVERVIEW_PHASE_SECTION_INSET,
  OVERVIEW_PHASE_SECTION_TOP_INSET,
  OVERVIEW_SCENARIO_GAP,
} from '@/lib/overviewLayout'
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

/** Width of one scenario placeholder panel, matching the loaded artboards. */
const SKELETON_PANEL_WIDTH = 640

/** A phase row's shape, taken from nav metadata before blueprints load. */
export type OverviewSkeletonPhase = {
  id: string
  /** Scenarios in this phase — one placeholder artboard each. */
  scenarioCount: number
}

/**
 * Neutral shape used only when nav metadata has not arrived within the
 * skeleton hold — a cold boot where even the phase list is still in flight.
 * Every other case is shaped from the real lifecycle.
 */
const UNKNOWN_SHAPE: OverviewSkeletonPhase[] = [
  { id: 'unknown', scenarioCount: 2 },
]

/**
 * Service-overview canvas placeholder, shaped from the real phase and
 * scenario counts. It carries `data-canvas-fit` and mounts *inside* the
 * viewport, so the camera frames these placeholder artboards and the first
 * content paint is already at the fitted transform.
 *
 * Deliberately not progressive: this is one flat placeholder that swaps to
 * the real canvas in a single commit, never a frame that fills in.
 */
export function ServiceOverviewCanvasSkeleton({
  phases,
  loopChannelOffset = 0,
}: {
  phases: OverviewSkeletonPhase[]
  /** Extra left padding when the lifecycle loop arrow has a channel. */
  loopChannelOffset?: number
}) {
  const rows = phases.length > 0 ? phases : UNKNOWN_SHAPE

  return (
    <div
      data-canvas-fit
      role="status"
      aria-busy="true"
      aria-label="Loading canvas"
      className="relative inline-flex w-max flex-col items-start"
      style={{
        paddingTop: OVERVIEW_CANVAS_PADDING_Y,
        paddingBottom: OVERVIEW_CANVAS_PADDING_Y,
        paddingRight: OVERVIEW_CANVAS_PADDING_X,
        paddingLeft: OVERVIEW_CANVAS_PADDING_X + loopChannelOffset,
      }}
    >
      {rows.map((phase, phaseIndex) => (
        <div
          key={phase.id}
          className="relative inline-flex w-max flex-col items-start"
          style={{
            marginBottom:
              phaseIndex < rows.length - 1 ? OVERVIEW_PHASE_ROW_GAP : undefined,
          }}
        >
          {/* Phase frame, at the same insets the loaded section uses. */}
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-2xl border border-solid border-border/60"
            style={{
              top: -OVERVIEW_PHASE_SECTION_TOP_INSET,
              left: -OVERVIEW_PHASE_SECTION_INSET,
              right: -OVERVIEW_PHASE_SECTION_INSET,
              bottom: -OVERVIEW_PHASE_SECTION_BOTTOM_INSET,
            }}
          />
          {/* Phase title badge — absolute, straddling the frame edge. */}
          <Skeleton
            aria-hidden
            className="absolute z-10 h-6 w-44 rounded-full"
            style={{
              top: -OVERVIEW_PHASE_SECTION_TOP_INSET,
              left: OVERVIEW_PHASE_SECTION_INSET,
              transform: 'translateY(-50%)',
            }}
          />
          <div className="inline-flex items-stretch" aria-hidden>
            {Array.from(
              { length: Math.max(1, phase.scenarioCount) },
              (_, scenarioIndex) => (
                <Fragment key={scenarioIndex}>
                  {scenarioIndex > 0 ? (
                    <div style={{ width: OVERVIEW_SCENARIO_GAP }} />
                  ) : null}
                  <BlueprintPanelLoadingSkeleton
                    width={SKELETON_PANEL_WIDTH}
                    height={COMPARE_MIN_PANEL_HEIGHT}
                    showTitle
                  />
                </Fragment>
              ),
            )}
          </div>
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  )
}

/**
 * Placeholder for a canvas surface whose viewport has not mounted yet (a
 * slice tab still resolving which scenario owns its cells). Positioned at
 * the viewport's own fit insets so it occupies the same rectangle the
 * camera-fitted skeleton will, and the hand-off reads as one placeholder.
 */
export function PendingCanvasLoadingSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <div
      className={cn('absolute inset-x-12 bottom-12 top-[104px]', className)}
      role="status"
      aria-busy="true"
      aria-label="Loading canvas"
    >
      <Skeleton className="size-full rounded-2xl" />
      <span className="sr-only">Loading…</span>
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

import type { CSSProperties } from 'react'
import type { PathOption } from '@/components/blueprint/PathMultiSelect'
import { ScenarioParallelInfoTooltip } from '@/components/blueprint/ScenarioParallelInfoTooltip'
import { StackHeaderFilterMenu } from '@/components/editor/StackHeaderFilterMenu'
import { Menubar } from '@/components/ui/menubar'
import {
  getSlideDisplayLabel,
  showsBlueprintFilters,
  isSubslide,
  type Slide,
  type SlideViewType,
} from '@/types/slides'
import { cn } from '@/lib/utils'

type SlideHeaderContentProps = {
  slide: Slide
  slides: Slide[]
  viewType: SlideViewType
  onViewTypeChange: (viewType: SlideViewType) => void
  paths: PathOption[]
  selectedPathIds: string[]
  onTogglePath?: (pathId: string) => void
  /** When true, title and description share one row inside a menubar. */
  inlineDescription?: boolean
}

function resolveScenarioDescription(
  slide: Slide,
  paths: PathOption[],
  selectedPathIds: string[],
): string | null | undefined {
  if (slide.description?.trim()) return slide.description

  const selectedPath = paths.find((path) => selectedPathIds.includes(path.id))
  return selectedPath?.description ?? paths[0]?.description ?? null
}

function SlideStickyMenubarHeader({
  slide,
  slides,
  viewType,
  onViewTypeChange,
  paths,
  selectedPathIds,
  onTogglePath,
}: Omit<SlideHeaderContentProps, 'inlineDescription'>) {
  const label = getSlideDisplayLabel(slide, slides)
  const isScenario = isSubslide(slide)
  const description = isScenario
    ? resolveScenarioDescription(slide, paths, selectedPathIds)
    : slide.description ??
      paths[0]?.description ??
      'Scenarios in this phase and how they connect.'
  const showFilters = showsBlueprintFilters(slide) && paths.length > 0 && onTogglePath

  return (
    <div
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card px-3 py-2 shadow-sm',
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex min-w-0 shrink-0 items-center gap-1.5">
          {isScenario ? <ScenarioParallelInfoTooltip slide={slide} /> : null}
          <span className="shrink-0 text-sm font-semibold tracking-tight text-foreground">
            {label}
          </span>
        </div>
        {description ? (
          <>
            <span
              className="shrink-0 text-xs text-muted-foreground/70"
              aria-hidden
            >
              ·
            </span>
            <p className="min-w-0 truncate text-xs text-muted-foreground">
              {description}
            </p>
          </>
        ) : null}
      </div>

      {showFilters ? (
        <Menubar
          modal={false}
          className="h-auto shrink-0 border-0 bg-transparent p-0 shadow-none"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <StackHeaderFilterMenu
            viewType={viewType}
            onViewTypeChange={onViewTypeChange}
            paths={paths}
            selectedPathIds={selectedPathIds}
            onTogglePath={onTogglePath}
          />
        </Menubar>
      ) : null}
    </div>
  )
}

function SlideHeaderContent({
  slide,
  slides,
  viewType,
  onViewTypeChange,
  paths,
  selectedPathIds,
  onTogglePath,
  inlineDescription = false,
}: SlideHeaderContentProps) {
  if (inlineDescription) {
    return (
      <SlideStickyMenubarHeader
        slide={slide}
        slides={slides}
        viewType={viewType}
        onViewTypeChange={onViewTypeChange}
        paths={paths}
        selectedPathIds={selectedPathIds}
        onTogglePath={onTogglePath}
      />
    )
  }

  const label = getSlideDisplayLabel(slide, slides)
  const isScenario = isSubslide(slide)

  const description = isScenario
    ? resolveScenarioDescription(slide, paths, selectedPathIds)
    : slide.description ??
      paths[0]?.description ??
      'Scenarios in this phase and how they connect.'

  return (
    <div
      className={cn(
        'rounded-2xl border border-border/80 bg-card shadow-sm',
        'px-4 py-3',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {isScenario ? (
              <ScenarioParallelInfoTooltip slide={slide} />
            ) : null}
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              {label}
            </h1>
          </div>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

type SlideStickyHeaderProps = SlideHeaderContentProps & {
  className?: string
}

/** Fixed overlay header for stack view. */
export function SlideStickyHeader({
  className,
  ...contentProps
}: SlideStickyHeaderProps) {
  return (
    <div
      data-slide-sticky-header
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-4',
        className,
      )}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="pointer-events-auto">
        <SlideHeaderContent {...contentProps} inlineDescription />
      </div>
    </div>
  )
}

type CanvasSlideHeaderProps = SlideHeaderContentProps & {
  style: CSSProperties
  className?: string
}

/** Header anchored above an artboard on the pannable canvas. */
export function CanvasSlideHeader({
  style,
  className,
  ...contentProps
}: CanvasSlideHeaderProps) {
  return (
    <div
      data-slide-sticky-header
      className={cn('pointer-events-none absolute z-10', className)}
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="pointer-events-auto w-full">
        <SlideHeaderContent {...contentProps} />
      </div>
    </div>
  )
}

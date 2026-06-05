import type { CSSProperties } from 'react'
import { IntegratedBlueprintGrid } from '@/components/blueprint/IntegratedBlueprintGrid'
import { ScenarioSlideHeader } from '@/components/blueprint/ScenarioSlideHeader'
import { ServiceBlueprintGrid } from '@/components/blueprint/ServiceBlueprintGrid'
import { BLUEPRINT_CANVAS_COMPARE_GAP } from '@/lib/blueprintLayout'
import type { PathListItem } from '@/lib/pathSelection'
import { cn } from '@/lib/utils'
import type { BlueprintData } from '@/types/blueprint'
import type { IntegratedBlueprintData } from '@/types/integratedBlueprint'
import {
  getParentSlide,
  getSlideDisplayLabel,
  type Slide,
  type SlideViewType,
} from '@/types/slides'
import { Skeleton } from '@/components/ui/skeleton'

type CanvasBlueprintArtboardProps = {
  slide: Slide
  slides: Slide[]
  blueprint?: BlueprintData | null
  blueprints?: BlueprintData[]
  integratedBlueprint?: IntegratedBlueprintData | null
  paths?: PathListItem[]
  selectedPathIds?: string[]
  onTogglePath?: (pathId: string) => void
  viewType: SlideViewType
  onViewTypeChange: (viewType: SlideViewType) => void
  useSideBySideLayout?: boolean
  useIntegratedLayout?: boolean
  blueprintLoading?: boolean
  isActive?: boolean
  onSelect?: () => void
  className?: string
  style?: CSSProperties
}

export function CanvasBlueprintArtboard({
  slide,
  slides,
  blueprint = null,
  blueprints,
  integratedBlueprint = null,
  paths = [],
  selectedPathIds = [],
  onTogglePath,
  viewType,
  onViewTypeChange,
  useSideBySideLayout = false,
  useIntegratedLayout = false,
  blueprintLoading,
  isActive = false,
  onSelect,
  className,
  style,
}: CanvasBlueprintArtboardProps) {
  const label = getSlideDisplayLabel(slide, slides)
  const parentSlide = getParentSlide(slide, slides)
  const noPathsSelected =
    !useIntegratedLayout && paths.length > 0 && selectedPathIds.length === 0
  const visibleBlueprints = noPathsSelected
    ? []
    : blueprints && blueprints.length > 0
      ? blueprints
      : blueprint
        ? [blueprint]
        : []
  const hasBlueprint = visibleBlueprints.length > 0
  const showIntegratedGrid =
    useIntegratedLayout && integratedBlueprint !== null

  return (
    <div
      data-canvas-artboard
      data-canvas-blueprint
      data-slide-id={slide.id}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect?.()
        }
      }}
      className={cn(
        'absolute flex flex-col overflow-hidden rounded-md border bg-card text-left shadow-md transition-[box-shadow,border-color]',
        isActive
          ? 'border-primary ring-2 ring-primary/25'
          : 'border-border hover:border-muted-foreground/40',
        className,
      )}
      style={style}
      aria-label={`${label} blueprint`}
      aria-current={isActive ? 'true' : undefined}
    >
      <div
        className="flex min-h-0 flex-1 flex-col overflow-auto p-3"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <ScenarioSlideHeader
          title={label}
          description={slide.description}
          phaseLabel={
            parentSlide ? getSlideDisplayLabel(parentSlide, slides) : undefined
          }
          viewType={viewType}
          onViewTypeChange={onViewTypeChange}
          paths={paths}
          selectedPathIds={selectedPathIds}
          onTogglePath={onTogglePath}
          compact
        />

        {!showIntegratedGrid && !noPathsSelected && blueprintLoading && !hasBlueprint ? (
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="flex-1" />
          </div>
        ) : showIntegratedGrid ? (
          <IntegratedBlueprintGrid
            data={integratedBlueprint}
            className="min-h-0 shrink-0"
            compact
          />
        ) : noPathsSelected ? null : hasBlueprint ? (
          <div
            className={cn(
              'flex min-h-0 shrink-0 items-start',
              useSideBySideLayout ? 'flex-row' : 'flex-col',
            )}
            style={
              useSideBySideLayout
                ? { gap: BLUEPRINT_CANVAS_COMPARE_GAP }
                : undefined
            }
          >
            {visibleBlueprints.map((data) => (
              <ServiceBlueprintGrid
                key={data.path.id}
                data={data}
                className="min-h-0 shrink-0"
                compact
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
            <span className="text-xs text-muted-foreground">No blueprint data</span>
          </div>
        )}
      </div>
    </div>
  )
}

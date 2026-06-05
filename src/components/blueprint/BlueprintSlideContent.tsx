import { IntegratedBlueprintGrid } from '@/components/blueprint/IntegratedBlueprintGrid'
import { ScenarioSlideHeader } from '@/components/blueprint/ScenarioSlideHeader'
import { ServiceBlueprintGrid } from '@/components/blueprint/ServiceBlueprintGrid'
import { useEditor } from '@/contexts/EditorContext'
import { useScenarioBlueprint } from '@/hooks/useScenarioBlueprint'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  SLIDE_ARTBOARD_HEIGHT,
  SLIDE_ARTBOARD_WIDTH,
} from '@/lib/slideLayout'
import {
  getParentSlide,
  getSlideDisplayLabel,
  isSubslide,
  type Slide,
} from '@/types/slides'

type BlueprintSlideContentProps = {
  slide: Slide
  slides: Slide[]
}

export function BlueprintSlideContent({ slide, slides }: BlueprintSlideContentProps) {
  const { getScenarioDisplayViewType, setScenarioDisplayViewType } = useEditor()
  const scenarioId = isSubslide(slide) ? slide.id : undefined
  const {
    paths,
    selectedPathIds,
    togglePathSelection,
    blueprints,
    integratedBlueprint,
    loading,
    error,
    configured,
  } = useScenarioBlueprint(scenarioId)

  const label = getSlideDisplayLabel(slide, slides)
  const parentSlide = getParentSlide(slide, slides)
  const displayViewType = getScenarioDisplayViewType(slide)
  const useIntegratedLayout =
    displayViewType === 'integrated' && paths.length > 0
  const useSideBySideLayout =
    displayViewType === 'side-by-side' && selectedPathIds.length > 0
  const noPathsSelected =
    !useIntegratedLayout && paths.length > 0 && selectedPathIds.length === 0

  const handleViewTypeChange = (viewType: typeof displayViewType) => {
    if (!scenarioId) return
    setScenarioDisplayViewType(scenarioId, viewType)
  }

  const handleTogglePath = (pathId: string) => {
    togglePathSelection(pathId)
  }

  const visibleBlueprints = noPathsSelected
    ? []
    : useSideBySideLayout
      ? blueprints
      : []

  const showIntegratedGrid =
    useIntegratedLayout && integratedBlueprint !== null

  if (!isSubslide(slide)) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
        <p className="text-lg font-medium">{label}</p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Select a scenario under this phase to view its service blueprint.
        </p>
      </div>
    )
  }

  const header = (
    <ScenarioSlideHeader
      title={label}
      description={slide.description}
      phaseLabel={parentSlide ? getSlideDisplayLabel(parentSlide, slides) : undefined}
      viewType={displayViewType}
      onViewTypeChange={handleViewTypeChange}
      paths={paths}
      selectedPathIds={selectedPathIds}
      onTogglePath={handleTogglePath}
    />
  )

  if (noPathsSelected) {
    return (
      <div
        className="inline-flex flex-col"
        style={{
          width: SLIDE_ARTBOARD_WIDTH,
          minHeight: SLIDE_ARTBOARD_HEIGHT,
        }}
      >
        {header}
      </div>
    )
  }

  if (loading && !showIntegratedGrid && visibleBlueprints.length === 0) {
    return (
      <div className="inline-flex w-max min-w-full flex-col">
        {header}
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="min-h-[320px] w-full" />
        </div>
      </div>
    )
  }

  if (error && !showIntegratedGrid && visibleBlueprints.length === 0) {
    return (
      <div className="inline-flex w-max min-w-full flex-col">
        {header}
        <Alert variant="destructive">
          <AlertTitle>Could not load blueprint</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!showIntegratedGrid && visibleBlueprints.length === 0) {
    return (
      <div className="inline-flex w-max min-w-full flex-col">
        {header}
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No blueprint data for this scenario yet.
          </p>
          {error && (
            <p className="mt-2 text-xs text-destructive">{error}</p>
          )}
          {!configured && (
            <p className="mt-2 text-xs text-muted-foreground">
              Without Supabase, only Warm-Up uses demo data. Copy{' '}
              <code className="text-xs">.env.example</code> to{' '}
              <code className="text-xs">.env</code> and run{' '}
              <code className="text-xs">npm run supabase:reset</code> for live data.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="inline-flex w-max min-w-full flex-col">
      {header}
      {showIntegratedGrid ? (
        <IntegratedBlueprintGrid data={integratedBlueprint} />
      ) : (
        <div className="flex flex-row items-start gap-6">
          {visibleBlueprints.map((data) => (
            <ServiceBlueprintGrid
              key={data.path.id}
              data={data}
              className="shrink-0"
            />
          ))}
        </div>
      )}
    </div>
  )
}

import { Fragment, useMemo } from 'react'
import {
  getScenarioBlueprintPanelHeight,
  ScenarioBlueprintPanel,
} from '@/components/blueprint/ScenarioBlueprintPanel'
import { useEditor } from '@/contexts/EditorContext'
import { useCanvasBlueprints } from '@/hooks/useCanvasBlueprints'
import { defaultSelectedPathIds } from '@/lib/pathSelection'
import { COMPARE_MIN_PANEL_HEIGHT } from '@/lib/sideBySideCompareLayout'
import { BLUEPRINT_THEME } from '@/lib/blueprintTheme'
import { SUBSLIDE_GAP } from '@/lib/slideLayout'
import {
  getSlideDisplayLabel,
  getSubslides,
  type Slide,
} from '@/types/slides'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

const CONNECTOR_WIDTH = SUBSLIDE_GAP

type PhaseScenarioOverviewProps = {
  phase: Slide
  slides: Slide[]
  className?: string
}

function PhaseScenarioConnector() {
  return (
    <div
      className="flex shrink-0 items-center justify-center self-center"
      style={{ width: CONNECTOR_WIDTH }}
      aria-hidden
    >
      <svg width={CONNECTOR_WIDTH} height={24} className="overflow-visible">
        <defs>
          <marker
            id="phase-scenario-blueprint-arrowhead"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 10 5 L 0 10 Z" fill={BLUEPRINT_THEME.arrow} />
          </marker>
        </defs>
        <path
          d={`M 0 12 H ${CONNECTOR_WIDTH - 8}`}
          fill="none"
          stroke={BLUEPRINT_THEME.arrow}
          strokeWidth={2}
          markerEnd="url(#phase-scenario-blueprint-arrowhead)"
        />
      </svg>
    </div>
  )
}

export function PhaseScenarioOverview({
  phase,
  slides,
  className,
}: PhaseScenarioOverviewProps) {
  const { getScenarioDisplayViewType, setActiveSlideId } = useEditor()
  const scenarios = useMemo(
    () => getSubslides(phase.id, slides),
    [phase.id, slides],
  )
  const scenarioIds = useMemo(
    () => scenarios.map((scenario) => scenario.id),
    [scenarios],
  )
  const { pathsByScenario, blueprintsByPathId, loading } =
    useCanvasBlueprints(scenarioIds)

  const sharedPanelHeight = useMemo(() => {
    const heights = scenarios.map((scenario) => {
      const paths = pathsByScenario.get(scenario.id) ?? []
      const selectedPathIds = defaultSelectedPathIds(paths)
      return getScenarioBlueprintPanelHeight({
        displayViewType: getScenarioDisplayViewType(scenario),
        paths,
        selectedPathIds,
        blueprintsByPathId,
      })
    })

    return Math.max(COMPARE_MIN_PANEL_HEIGHT, ...heights)
  }, [
    scenarios,
    pathsByScenario,
    blueprintsByPathId,
    getScenarioDisplayViewType,
  ])

  if (scenarios.length === 0) {
    return (
      <div
        className={cn(
          'flex min-h-[240px] items-center justify-center rounded-lg border border-dashed p-8 text-center',
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">
          No scenarios in this phase yet.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className={cn('inline-flex items-start', className)}
        data-phase-scenario-overview=""
      >
        {scenarios.map((scenario, index) => (
          <Fragment key={scenario.id}>
            <Skeleton
              className="shrink-0 rounded-2xl"
              style={{
                width: 640,
                height: COMPARE_MIN_PANEL_HEIGHT,
              }}
            />
            {index < scenarios.length - 1 ? <PhaseScenarioConnector /> : null}
          </Fragment>
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn('inline-flex items-start', className)}
      data-phase-scenario-overview=""
    >
      {scenarios.map((scenario, index) => {
        const label = getSlideDisplayLabel(scenario, slides)
        const paths = pathsByScenario.get(scenario.id) ?? []
        const selectedPathIds = defaultSelectedPathIds(paths)

        return (
          <Fragment key={scenario.id}>
            <ScenarioBlueprintPanel
              slide={scenario}
              slides={slides}
              paths={paths}
              selectedPathIds={selectedPathIds}
              blueprintsByPathId={blueprintsByPathId}
              sectionTitleLabel={label}
              lockedPanelHeight={sharedPanelHeight}
              lockPanelHeight
              onNavigate={() => setActiveSlideId(scenario.id)}
            />

            {index < scenarios.length - 1 ? <PhaseScenarioConnector /> : null}
          </Fragment>
        )
      })}
    </div>
  )
}

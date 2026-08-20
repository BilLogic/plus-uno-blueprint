import type { Phase, Scenario } from '@/types/database'
import { asSlideViewType, type NavItem } from '@/types/nav'

export type ScenarioRow = Pick<
  Scenario,
  'id' | 'name' | 'description' | 'position' | 'phase_id' | 'view_type'
>

export type PhaseRow = Pick<
  Phase,
  'id' | 'name' | 'description' | 'position' | 'loops_to_phase_id'
> & {
  scenarios?: ScenarioRow[]
}

/** Map phases and nested scenarios to editor slides (scenarios = subsides under their phase). */
export function phasesToSlides(phases: PhaseRow[]): NavItem[] {
  const slides: NavItem[] = []
  const sortedPhases = [...phases].sort(
    (a, b) => a.position - b.position,
  )

  sortedPhases.forEach((phase, phaseIndex) => {
    slides.push({
      id: phase.id,
      index: phaseIndex + 1,
      label: phase.name,
      description: phase.description,
      loopToId: phase.loops_to_phase_id ?? undefined,
    })

    const scenarios = [...(phase.scenarios ?? [])].sort(
      (a, b) => a.position - b.position,
    )

    scenarios.forEach((scenario, scenarioIndex) => {
      slides.push({
        id: scenario.id,
        index: scenarioIndex + 1,
        label: scenario.name,
        description: scenario.description,
        parentId: phase.id,
        // One vocabulary. The column now holds client tokens
        // (`single | stacked`), so there is no seam to cross — but a row
        // outside the CHECK still falls back rather than rendering nothing.
        viewType: asSlideViewType(scenario.view_type),
      })
    })
  })

  return slides
}

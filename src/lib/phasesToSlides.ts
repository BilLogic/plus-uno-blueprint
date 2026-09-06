import type { Phase, Scenario } from '@/types/database'
import { asSlideViewType, type NavItem } from '@/types/nav'

export type ScenarioRow = Pick<
  Scenario,
  'id' | 'name' | 'summary' | 'note' | 'position' | 'phase_id' | 'layout'
>

export type PhaseRow = Pick<
  Phase,
  'id' | 'name' | 'summary' | 'position' | 'loops_to_phase_id'
> & {
  scenarios?: ScenarioRow[]
}

/**
 * Map phases and nested scenarios to editor slides (scenarios = subsides under
 * their phase).
 *
 * This is the seam where the COLUMN `summary` becomes the slide's
 * `description` prop. The prop is a display API shared by every slide kind and
 * keeps its name; only the field read off the row was renamed.
 */
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
      summary: phase.summary,
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
        summary: scenario.summary,
        // The scenario's aside, straight off the row. It used to be a
        // `Record<uuid, string>` in `src/lib/scenarioParallelInfo.ts` keyed on
        // three hardcoded PLUS scenario ids (#326 S6, #396 Q38).
        note: scenario.note,
        parentId: phase.id,
        // One vocabulary. The column now holds client tokens
        // (`single | stacked`), so there is no seam to cross — but a row
        // outside the CHECK still falls back rather than rendering nothing.
        viewType: asSlideViewType(scenario.layout),
      })
    })
  })

  return slides
}

import { describe, expect, it } from 'vitest'

import { SAMPLE_BLUEPRINTS } from './sampleBlueprints'
import { SAMPLE_NAV } from './sampleNav'

/**
 * THE TWO HALVES OF THE OFFLINE BOARD, HELD TO EACH OTHER.
 *
 * `sample.nav` lists this deployment's phases and scenarios; `sample.blueprints`
 * is what each of those scenarios draws. The kit REPLACES each rather than
 * merging it, so a nav row whose scenario the registry does not answer is a row
 * that opens an empty canvas in every no-database build — silently, because
 * nothing about it throws. That is the state this repository was in until the
 * board was exported, and it is the state a bad export would put it back into.
 *
 * A nav item with a `parentId` is a scenario; one without is a phase, and a
 * phase draws no board of its own.
 */
const scenarioRows = SAMPLE_NAV.filter((item) => item.parentId)

describe('the offline board', () => {
  it('answers every scenario the nav names', () => {
    const unanswered = scenarioRows
      .filter((row) => !(row.id in SAMPLE_BLUEPRINTS.blueprintsByScenario))
      .map((row) => `${row.label} (${row.id})`)

    expect(unanswered).toEqual([])
  })

  it('gives every scenario it answers at least one path to draw', () => {
    const empty = Object.entries(SAMPLE_BLUEPRINTS.blueprintsByScenario)
      .filter(([, blueprints]) => blueprints.length === 0)
      .map(([id]) => id)

    expect(empty).toEqual([])
  })

  it('registers content for nothing the nav does not list', () => {
    // The registry is keyed by scenario UUID and every lookup misses on a
    // foreign key, so a stray scenario would cost nothing at runtime — it would
    // cost a reader, who would be looking at a board this deployment does not
    // show. The export takes its subject from the nav; this is that claim.
    const listed = new Set(scenarioRows.map((row) => row.id))
    const stray = Object.keys(SAMPLE_BLUEPRINTS.blueprintsByScenario).filter(
      (id) => !listed.has(id),
    )

    expect(stray).toEqual([])
  })

  it('draws a board with lanes, steps and cells rather than an empty frame', () => {
    // One scenario answering with an empty shell would pass the tests above and
    // render nothing, which is the failure those tests exist to catch.
    const hollow = Object.entries(SAMPLE_BLUEPRINTS.blueprintsByScenario)
      .filter(([, blueprints]) =>
        blueprints.some(
          (blueprint) =>
            blueprint.lanes.length === 0 ||
            blueprint.steps.length === 0 ||
            blueprint.cells.length === 0,
        ),
      )
      .map(([id]) => id)

    expect(hollow).toEqual([])
  })

  it('keys every cell to a lane and a step of its own path', () => {
    const orphans: string[] = []
    for (const blueprints of Object.values(SAMPLE_BLUEPRINTS.blueprintsByScenario)) {
      for (const blueprint of blueprints) {
        const lanes = new Set(blueprint.lanes.map((lane) => lane.id))
        const steps = new Set(blueprint.steps.map((step) => step.id))
        for (const cell of blueprint.cells) {
          if (!lanes.has(cell.lane_id) || !steps.has(cell.step_id)) {
            orphans.push(`${blueprint.path.name}: ${cell.id}`)
          }
        }
      }
    }

    expect(orphans).toEqual([])
  })
})

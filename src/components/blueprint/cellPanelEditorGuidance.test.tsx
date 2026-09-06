// @vitest-environment jsdom
/**
 * Which content guidance a cell gets, and what decides it (#324, #396 Q30).
 *
 * A touchpoint-lane cell holds a LIST — one touchpoint per line — so the number
 * worth showing an author is the longest single label, measured against the
 * width one item has on the board. Every other lane holds a sentence, measured
 * whole. The editor has always drawn both; what it got wrong was the question
 * it asked to choose between them.
 *
 * It asked `laneName === 'Front Stage Tech' || laneName === 'Back Stage Tech'`.
 * Those are two display names off one deployment's board, and `lanes.name` is
 * free-form in any language, so the guidance was silently absent on every lane
 * that plays the same role under another name — including `Front Stage
 * Touchpoints`, the name the schema's own vocabulary uses. Q30 settles it on
 * `shouldUseTouchpointCellContent`, the predicate the panel and the band
 * already resolve the same question with.
 *
 * So these are the cases the fix turns ON as much as the ones it keeps
 * working, and both belong here: a rename is invisible in a test, a behaviour
 * change is not.
 */
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BACKSTAGE_TOUCHPOINTS_ROLE,
  CUSTOMER_ACTIONS_ROLE,
  FRONTSTAGE_TOUCHPOINTS_ROLE,
} from '@/lib/laneRoles'

vi.mock('@/contexts/SupabaseProvider', () => ({
  useSupabase: () => ({ client: null, configured: false, canWrite: true }),
}))
// Both of the editor's own reads — the value-prop audiences and the touchpoint
// registry — go through this one hook, and a draft cell needs neither.
vi.mock('@/hooks/useSupabaseQuery', () => ({
  useSupabaseQuery: () => ({ status: 'ready', data: [] }),
  invalidateQueries: () => {},
}))
vi.mock('@/hooks/useBlueprintCell', () => ({
  useBlueprintCell: () => null,
}))
vi.mock('@/hooks/useCanvasBlueprints', () => ({
  invalidateCanvasBlueprintsForPath: () => {},
}))

import { CellPanelEditor } from '@/components/blueprint/CellPanelEditor'

afterEach(cleanup)

/**
 * A cell being created in the named lane. The draft branch is used because it
 * needs no row and no query — the guidance is a pure function of the lane and
 * the text in the field, and it reads identically on an existing cell.
 */
function openDraftIn(lane: { name: string; role?: string | null }) {
  render(
    <CellPanelEditor
      cellId={null}
      draft={{
        pathId: 'path-1',
        laneId: 'lane-1',
        stepId: 'step-1',
        laneName: lane.name,
        stepName: 'Hears about the service',
        stepIndex: 0,
      }}
      laneName={lane.name}
      laneRole={lane.role ?? null}
      onDone={() => {}}
    />,
  )
}

/** The one line under the Content field that says how long the text may run. */
function guidance(): string {
  const element = document.querySelector('[data-cell-content-guidance]')
  expect(element, 'the editor drew no content guidance').toBeTruthy()
  return element!.textContent ?? ''
}

describe('a touchpoint lane is measured a label at a time', () => {
  it('is decided by the role the row carries, whatever the row is called', () => {
    openDraftIn({ name: 'Tools the applicant meets', role: FRONTSTAGE_TOUCHPOINTS_ROLE })
    expect(guidance()).toContain('in the longest touchpoint')
  })

  it('covers the backstage role too', () => {
    openDraftIn({ name: 'Systems', role: BACKSTAGE_TOUCHPOINTS_ROLE })
    expect(guidance()).toContain('in the longest touchpoint')
  })

  /*
    The case the two literal names missed, and the reason Q30 is a behaviour
    change rather than a tidy-up. `Front Stage Touchpoints` is the schema's own
    word for the role, it carries no `lane_role` on a hand-written board, and
    it got the sentence guidance until this fix.
  */
  it('reaches a lane the old two-name test never covered', () => {
    openDraftIn({ name: 'Front Stage Touchpoints' })
    expect(guidance()).toContain('in the longest touchpoint')
  })

  it('still covers the two names the old test did', () => {
    for (const name of ['Front Stage Tech', 'Back Stage Tech']) {
      openDraftIn({ name })
      expect(guidance(), name).toContain('in the longest touchpoint')
      cleanup()
    }
  })
})

describe('every other lane is measured whole', () => {
  it('gives an actor lane the sentence guidance', () => {
    openDraftIn({ name: 'Regular Tutor', role: CUSTOMER_ACTIONS_ROLE })
    const text = guidance()
    expect(text).not.toContain('in the longest touchpoint')
    expect(text).toContain('characters')
  })

  it('gives a lane with no role and no known name the sentence guidance', () => {
    openDraftIn({ name: 'Something nobody has classified' })
    expect(guidance()).not.toContain('in the longest touchpoint')
  })
})

describe('the guidance counts what it says it counts', () => {
  /** The Content field's own input: the first one the form draws. */
  function typeContent(text: string) {
    const input = document.querySelector('input')
    expect(input, 'the editor drew no Content field').toBeTruthy()
    fireEvent.change(input!, { target: { value: text } })
  }

  /*
    Two touchpoints in one cell, comma-separated.

    The Content control is an `<input>`, which strips newlines on its way into
    the DOM, so a comma is how a second touchpoint is actually typed here —
    `parseCellContentItems` splits on either.
  */
  const TWO_TOUCHPOINTS = 'Zoom, Handshake Employer Profile'

  it('measures the longest single label on a touchpoint lane', () => {
    openDraftIn({ name: 'Front Stage Tech' })

    // What an author needs to know is the longer of the two — 26 characters —
    // and not the 32 of both together, because each is drawn on its own row of
    // the cell and it is one row that has to fit.
    typeContent(TWO_TOUCHPOINTS)
    expect(guidance()).toContain('26 characters in the longest touchpoint')
  })

  it('measures the whole sentence everywhere else', () => {
    openDraftIn({ name: 'Regular Tutor', role: CUSTOMER_ACTIONS_ROLE })

    typeContent(TWO_TOUCHPOINTS)
    expect(guidance()).toContain('32 characters')
  })
})

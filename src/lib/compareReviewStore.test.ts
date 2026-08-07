import { describe, expect, it } from 'vitest'
import {
  getCompareReviewState,
  registerCompareReview,
  setCompareFolded,
  type CompareReviewRegistration,
} from '@/lib/compareReviewStore'
import type { CompareModel } from '@/lib/compareSlots'

const EMPTY_MODEL = {
  slots: [],
  columns: [],
  runs: [],
  cellStatus: {},
} as unknown as CompareModel

function makeRegistration(slideId: string): CompareReviewRegistration {
  return {
    slideId,
    scenarioName: slideId,
    viewMode: 'stacked',
    model: EMPTY_MODEL,
    blueprints: [],
  }
}

describe('compareReviewStore registration handoff', () => {
  it('preserves fold across a same-scenario re-register (mode switch / refetch)', () => {
    const unregisterFirst = registerCompareReview(makeRegistration('warm-up'))
    setCompareFolded(true)

    // A mode switch re-registers the SAME scenario through an effect
    // cleanup: unregister runs first, then the new registration. The fold
    // is contracted (Phase 4a locked decision) to survive this — and the
    // Merged reading preset (Phase 4b) depends on it, since the preset's
    // fold lands before the re-registration does.
    unregisterFirst()
    const unregisterSecond = registerCompareReview(makeRegistration('warm-up'))
    expect(getCompareReviewState().fold.folded).toBe(true)

    unregisterSecond()
  })

  it('resets fold when a different scenario registers', () => {
    const unregisterFirst = registerCompareReview(makeRegistration('warm-up'))
    setCompareFolded(true)
    unregisterFirst()

    const unregisterSecond = registerCompareReview(
      makeRegistration('goal-setting'),
    )
    expect(getCompareReviewState().fold.folded).toBe(false)

    unregisterSecond()
  })
})

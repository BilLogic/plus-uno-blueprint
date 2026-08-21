/**
 * The tier a moving camera renders at.
 *
 * This behaviour shipped twice on `fix/semantic-tier-travel` (PR #54) and was
 * reverted both times, each revert carrying only the auto-generated message —
 * so no record survives of what went wrong. That is the reason this file
 * exists: whatever the objection was, it was not written down, and the next
 * person to hit it should find an assertion rather than a third revert.
 *
 * The contract, in one line: while the camera moves, both directions render
 * the CHEAPER tier; the destination tier lands on arrival.
 */
import { describe, expect, it } from 'vitest'
import { tierZoomForTravel } from '@/hooks/useZoomPanViewport'

// Any value below this renders flat blocks; at or above it, real text.
const THRESHOLD = 0.95

const rendersText = (zoom: number) => zoom >= THRESHOLD

describe('semantic tier while travelling', () => {
  it('renders the cheap tier in both directions', () => {
    const overview = 0.4
    const detail = 1.6

    // Zooming IN: text used to be stamped on frame one, so the full board's
    // text rasterized on every frame of the ease at a scale that changes each
    // frame — the most expensive thing this canvas can be asked to draw.
    expect(rendersText(tierZoomForTravel(overview, detail))).toBe(false)

    // Zooming OUT: blocks used to be stamped on frame one, so detail vanished
    // before the camera had moved — a cut, not a transition.
    expect(rendersText(tierZoomForTravel(detail, overview))).toBe(false)
  })

  it('is symmetric, which is the whole point', () => {
    // The two directions felt like different animations because they WERE
    // different animations. Same pair of endpoints, same tier, either way
    // round.
    expect(tierZoomForTravel(0.4, 1.6)).toBe(tierZoomForTravel(1.6, 0.4))
  })

  it('leaves a move that never crosses the threshold exactly as it was', () => {
    // Both ends above: the minimum is above too, so the board keeps its text
    // for the whole move. This covers overview→phase, the transition that
    // already felt right and must not regress.
    expect(rendersText(tierZoomForTravel(1.2, 1.6))).toBe(true)

    // Both ends below: still blocks, nothing to fade.
    expect(rendersText(tierZoomForTravel(0.3, 0.6))).toBe(false)
  })

  it('never picks a tier neither end asked for', () => {
    // The travelling tier is always one of the two endpoints — it interpolates
    // nothing and invents nothing.
    for (const [a, b] of [
      [0.4, 1.6],
      [1.6, 0.4],
      [0.95, 0.95],
      [0.2, 0.2],
    ] as const) {
      expect([a, b]).toContain(tierZoomForTravel(a, b))
    }
  })
})

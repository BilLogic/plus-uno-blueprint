import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  CELL_SHEET_DEFAULT_SNAP,
  CELL_SHEET_SNAP_POINTS,
} from '@/lib/cellSheetSnap'

const shellSrc = readFileSync(
  resolve(__dirname, 'panelShell.tsx'),
  'utf8',
)

/**
 * The phone's cell sheet used to open at one height and be dragged from there,
 * so reading a long cell was always a drag and glancing at a short one always
 * wasted the screen (#133). Three snap points fix that, and two things about
 * the fix are silent when broken — which is why they are asserted rather than
 * described.
 */
describe('the cell sheet has somewhere to come to rest', () => {
  /** Base UI: a number in (0,1] is a fraction of viewport height. */
  const asFraction = (point: number | string): number | null =>
    typeof point === 'number' ? point : null

  it('offers three points: a peek, a half and a full', () => {
    expect(CELL_SHEET_SNAP_POINTS).toHaveLength(3)
  })

  it('peek is a length and the other two are fractions', () => {
    // Peek has to clear the identity block, whose height comes from type and
    // padding rather than from the phone. A fraction would make it too short
    // on a small screen and pointlessly tall on a large one.
    expect(typeof CELL_SHEET_SNAP_POINTS[0]).toBe('string')
    expect(CELL_SHEET_SNAP_POINTS[0]).toMatch(/^\d+(\.\d+)?(rem|px)$/)
    expect(typeof CELL_SHEET_SNAP_POINTS[1]).toBe('number')
    expect(typeof CELL_SHEET_SNAP_POINTS[2]).toBe('number')
  })

  it('the fractions ascend and the last one is full', () => {
    const half = asFraction(CELL_SHEET_SNAP_POINTS[1])!
    const full = asFraction(CELL_SHEET_SNAP_POINTS[2])!
    expect(half).toBeGreaterThan(0)
    expect(full).toBeGreaterThan(half)
    expect(full).toBeLessThanOrEqual(1)
  })

  it('opens on the MIDDLE point, which is the whole reason there are three', () => {
    // Peek would make every read start with a drag — the complaint itself.
    // Full would bury the board on every tap. The middle costs at most one
    // drag in either direction, and nothing else does.
    expect(CELL_SHEET_DEFAULT_SNAP).toBe(CELL_SHEET_SNAP_POINTS[1])
    expect(CELL_SHEET_DEFAULT_SNAP).not.toBe(CELL_SHEET_SNAP_POINTS[0])
    expect(CELL_SHEET_DEFAULT_SNAP).not.toBe(CELL_SHEET_SNAP_POINTS[2])
  })
})

/**
 * THE REGRESSION THIS FILE MOSTLY EXISTS FOR.
 *
 * Under snap points the drawer primitive sets `--drawer-content-height: 100dvh`
 * and moves the sheet with `--drawer-snap-point-offset`, so the visible height
 * IS the offset. The sheet used to carry `!h-auto max-h-[70svh]`, and either of
 * those coming back clamps the tallest snap to 70% of the viewport while the
 * drag still travels the whole way — the full point silently stops short, and
 * nothing throws.
 */
describe('the sheet does not cap its own height', () => {
  const mobileClasses =
    /mobile\s*\n?\s*\?[\s\S]*?'([^']*--drawer-inset:0px[^']*)'/.exec(shellSrc)?.[1]

  it('the mobile branch was found at all', () => {
    // If this fails the regex has drifted, and every assertion below would
    // pass vacuously. That is worth catching separately.
    expect(mobileClasses).toBeTruthy()
  })

  it('sets no max height', () => {
    expect(mobileClasses).not.toMatch(/max-h-/)
  })

  it('does not force height to auto', () => {
    expect(mobileClasses).not.toMatch(/h-auto/)
  })

  it('still pins itself to the bottom edge, full width', () => {
    // The rest of the sheet posture, so removing the cap cannot quietly take
    // the positioning with it.
    expect(mobileClasses).toMatch(/!inset-x-0/)
    expect(mobileClasses).toMatch(/!bottom-0/)
  })
})

describe('the desktop inspector gets no snap points', () => {
  it('passes them only in the sheet posture', () => {
    // A pinned card has room for its whole content; there is nothing to snap
    // between, and snap points would give it a 100dvh height it must not have.
    expect(shellSrc).toMatch(
      /snapPoints=\{mobile \? CELL_SHEET_SNAP_POINTS : undefined\}/,
    )
    expect(shellSrc).toMatch(
      /defaultSnapPoint=\{mobile \? CELL_SHEET_DEFAULT_SNAP : undefined\}/,
    )
  })
})

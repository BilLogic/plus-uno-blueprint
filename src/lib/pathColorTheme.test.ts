import { describe, expect, it } from 'vitest'
import {
  getPathColor,
  getPathDashArray,
  getPathDashArrayFromKey,
  getPathSectionBorderStyle,
} from '@/lib/pathColorTheme'
import { getContrastRatio } from '@/lib/blueprintCellStyle'

/**
 * Path identity has to survive both a monochrome print and a viewer who cannot
 * separate the hues (SC 1.4.1), so every path carries a stroke pattern as well
 * as a colour — and the badge renders white text on the colour, so the colour
 * itself owes 4.5:1.
 */
describe('path identity', () => {
  const types = ['happy', 'unhappy', 'exception', 'alternative', 'named'] as const

  it.each(types)('%s badge colour clears 4.5:1 against white', (pathType) => {
    const color = getPathColor({ path_type: pathType, name: 'Unregistered' })
    expect(getContrastRatio(color, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
  })

  it('gives every non-happy type a distinct dash pattern', () => {
    const dashes = types.map((path_type) =>
      getPathDashArray({ path_type, name: '' }),
    )
    expect(dashes[0]).toBeUndefined() // happy stays solid
    const nonHappy = dashes.slice(1)
    expect(new Set(nonHappy).size).toBe(nonHappy.length)
  })

  it('separates two unregistered named paths', () => {
    const a = { path_type: 'named', name: 'Alpha' } as const
    const b = { path_type: 'named', name: 'Beta' } as const
    // They may share a hue slot, but not both a hue and a dash.
    const same =
      getPathColor(a) === getPathColor(b) &&
      getPathDashArray(a) === getPathDashArray(b)
    expect(same).toBe(false)
  })

  it('reads the same dash from a colour key as from the path', () => {
    const path = { path_type: 'unhappy', name: 'Sad Path' } as const
    expect(getPathDashArrayFromKey('unhappy:Sad Path')).toBe(
      getPathDashArray(path),
    )
    // Bare key with no colon is the legacy default-path form.
    expect(getPathDashArrayFromKey('happy')).toBeUndefined()
  })

  it('dashes the section frame for every type except happy', () => {
    expect(
      getPathSectionBorderStyle({ path_type: 'happy', name: 'Happy Path' })
        .borderStyle,
    ).toBe('solid')
    expect(
      getPathSectionBorderStyle({ path_type: 'exception', name: 'Boom' })
        .borderStyle,
    ).toBe('dashed')
  })
})

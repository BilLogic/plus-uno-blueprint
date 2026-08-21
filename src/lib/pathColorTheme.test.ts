import { describe, expect, it } from 'vitest'
import {
  getPathColor,
  getPathDashArray,
  getPathDashArrayFromKey,
  getPathSectionBorderStyle,
} from '@/lib/pathColorTheme'

/**
 * Path identity has to survive both a monochrome print and a viewer who cannot
 * separate the hues (SC 1.4.1), so every path carries a stroke pattern as well
 * as a colour. The colour side is measured in `palette.test.ts`, which can
 * resolve the tokens against the stylesheet.
 */
describe('path identity', () => {
  it('gives every non-happy path its own dash pattern', () => {
    // The dash belongs to the PATH, not to its type. It used to belong to the
    // type — one entry in `PATH_TYPE_DASH` each — which was fine while a
    // scenario held at most one path per type and wrong the moment Goal
    // Setting held five of one. Only `happy` keeps a type dash, because a
    // scenario can only ever have one.
    const paths = [
      { path_type: 'happy', name: 'Signs up without conflicts' },
      { path_type: 'exception', name: 'Missed hours' },
      { path_type: 'exception', name: 'Escalation' },
      { path_type: 'variant', name: 'No screen share' },
    ] as const
    const dashes = paths.map(getPathDashArray)
    expect(dashes[0]).toBeUndefined() // happy stays solid
    const nonHappy = dashes.slice(1)
    expect(new Set(nonHappy).size).toBe(nonHappy.length)
  })

  it('keeps a path\'s colour when its TYPE changes', () => {
    // The slot is keyed on the name alone. Keying it on `${type}:${name}` is
    // what dropped the five Goal Setting paths out of their pinned slots when
    // they moved off `custom` on 2026-08-21 — a re-type silently re-coloured
    // them, and the dash moved with it.
    const asVariant = { path_type: 'variant', name: 'Set Goals' } as const
    const asException = { path_type: 'exception', name: 'Set Goals' } as const
    expect(getPathColor(asVariant)).toBe(getPathColor(asException))
    expect(getPathDashArray(asVariant)).toBe(getPathDashArray(asException))
  })

  it('separates two unregistered named paths', () => {
    const a = { path_type: 'variant', name: 'Alpha' } as const
    const b = { path_type: 'variant', name: 'Beta' } as const
    // They may share a hue slot, but not both a hue and a dash.
    const same =
      getPathColor(a) === getPathColor(b) &&
      getPathDashArray(a) === getPathDashArray(b)
    expect(same).toBe(false)
  })

  it('reads the same dash from a colour key as from the path', () => {
    const path = { path_type: 'exception', name: 'Sad Path' } as const
    expect(getPathDashArrayFromKey('exception:Sad Path')).toBe(
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

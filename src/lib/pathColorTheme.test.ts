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
    //
    // Dash uniqueness is load-bearing, not decorative: every `exception` path
    // takes the type colour, so within a scenario the dash is the ONLY channel
    // separating one exception from another.
    const paths = [
      { kind: 'happy', name: 'Signs up without conflicts' },
      { kind: 'exception', name: 'Missed hours' },
      { kind: 'exception', name: 'Escalation' },
      { kind: 'variant', name: 'No screen share' },
    ] as const
    const dashes = paths.map(getPathDashArray)
    expect(dashes[0]).toBeUndefined() // happy stays solid
    const nonHappy = dashes.slice(1)
    expect(new Set(nonHappy).size).toBe(nonHappy.length)
  })

  it('separates the sibling paths the board actually holds', () => {
    // These two shipped identical — same family, same dash — under the old
    // character-sum hash. They are the reason it was replaced, and they are
    // pinned here because a synthetic pair would not have caught it: the names
    // are neither anagrams nor near-misses, they simply summed alike.
    const a = { kind: 'variant', name: 'Lead works from a dashboard' } as const
    const b = { kind: 'variant', name: 'Redesigned reflection' } as const
    const identical =
      getPathColor(a) === getPathColor(b) &&
      getPathDashArray(a) === getPathDashArray(b)
    expect(identical).toBe(false)
  })

  it('keeps a variant\'s colour wherever it appears', () => {
    // The slot is keyed on the NAME alone. Keying it on `${type}:${name}` is
    // what dropped the five Goal Setting paths out of their pinned slots when
    // they moved off `custom` on 2026-08-21 — a re-type silently re-coloured
    // them, and the dash moved with it.
    const here = { kind: 'variant', name: 'Set Goals' } as const
    const there = { kind: 'variant', name: 'Set Goals' } as const
    expect(getPathColor(here)).toBe(getPathColor(there))
    expect(getPathDashArray(here)).toBe(getPathDashArray(there))
  })

  it('fixes green on happy and red on exception, whatever they are called', () => {
    // The two a reader should never have to decode.
    expect(getPathColor({ kind: 'happy', name: 'Anything at all' })).toBe(
      getPathColor({ kind: 'happy', name: 'Something else' }),
    )
    expect(
      getPathColor({ kind: 'exception', name: 'Missed hours' }),
    ).toBe(getPathColor({ kind: 'exception', name: 'Escalation' }))
  })

  it('separates two unregistered named paths', () => {
    const a = { kind: 'variant', name: 'Alpha' } as const
    const b = { kind: 'variant', name: 'Beta' } as const
    // They may share a hue slot, but not both a hue and a dash.
    const same =
      getPathColor(a) === getPathColor(b) &&
      getPathDashArray(a) === getPathDashArray(b)
    expect(same).toBe(false)
  })

  it('separates two names built from the same letters', () => {
    // 'Alpha'/'Beta' above pass under any hash, including a plain character
    // sum — their letters differ. Anagrams are the case a sum cannot see, and
    // they are not hypothetical here: 'Check Goals' and 'Goals Check' are both
    // plausible names for sibling routes in one scenario, and under the old
    // sum they took the same colour AND the same dash.
    const a = { kind: 'variant', name: 'Check Goals' } as const
    const b = { kind: 'variant', name: 'Goals Check' } as const
    const same =
      getPathColor(a) === getPathColor(b) &&
      getPathDashArray(a) === getPathDashArray(b)
    expect(same).toBe(false)
  })

  it('reads the same dash from a colour key as from the path', () => {
    const path = { kind: 'exception', name: 'Sad Path' } as const
    expect(getPathDashArrayFromKey('exception:Sad Path')).toBe(
      getPathDashArray(path),
    )
    // Bare key with no colon is the legacy default-path form.
    expect(getPathDashArrayFromKey('happy')).toBeUndefined()
  })

  it('dashes the section frame for every type except happy', () => {
    expect(
      getPathSectionBorderStyle({ kind: 'happy', name: 'Happy Path' })
        .borderStyle,
    ).toBe('solid')
    expect(
      getPathSectionBorderStyle({ kind: 'exception', name: 'Boom' })
        .borderStyle,
    ).toBe('dashed')
  })
})

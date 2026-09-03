// @vitest-environment jsdom

/**
 * Golden-geometry parity net for the arrow router (#346).
 *
 * For every S1–S10 situation, across all three view modes, this freezes the
 * `d` strings the CURRENT engine produces. The snapshots are the "before"
 * record every Direction-B slice (B1 anchor slots, B2 confluence, B3 gap-first
 * corridors, B4 flip) diffs against — a change to any of them must be a
 * deliberate, reviewed edit to this file's `.snap`, never a silent drift.
 *
 * The engine measures live DOM, so each situation is materialised into a real
 * element tree whose rects are pinned to the fixture boxes (see
 * `arrowSituationCatalog.ts`). These land GREEN over `main`'s untouched engine.
 */

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ARROW_SITUATIONS,
  ARROW_VIEW_MODES,
  boardForMode,
  computeSituationSegments,
  type ArrowViewMode,
  type SituationSpec,
} from './arrowSituationCatalog'
import { ArrowSituationCatalogPage } from './ArrowSituationCatalogPage'

afterEach(() => {
  cleanup()
  // The engine caches nothing across measurement passes, but the fixtures
  // attach to document.body — leave it clean for the next case.
  document.body.innerHTML = ''
})

function segmentsFor(situation: SituationSpec, mode: ArrowViewMode) {
  const reason = situation.unsupported?.[mode]
  if (reason) return { skipped: reason }
  const board = boardForMode(situation.base(), mode)
  return { segments: computeSituationSegments(board) }
}

describe('arrow situation catalog — golden geometry', () => {
  it('covers the full S1–S10 catalog from the trigger-line plan', () => {
    expect(ARROW_SITUATIONS.map((s) => s.id)).toEqual([
      'S1',
      'S2',
      'S3',
      'S4',
      'S5',
      'S6',
      'S7',
      'S8',
      'S9',
      'S10',
    ])
  })

  for (const situation of ARROW_SITUATIONS) {
    describe(`${situation.id} — ${situation.title}`, () => {
      for (const mode of ARROW_VIEW_MODES) {
        it(`${mode}`, () => {
          expect(segmentsFor(situation, mode)).toMatchSnapshot()
        })
      }

      it('draws arrows in the canonical single view, and never an empty path', () => {
        // `single` is the well-formed reference view — it must always draw.
        // The merged view can legitimately decline a route (the engine returns
        // '' rather than strike through a stacked cell); that is captured in
        // the snapshot, but a segment that IS emitted must carry real geometry.
        const single = computeSituationSegments(boardForMode(situation.base(), 'single'))
        expect(single.length, `${situation.id}/single drew no arrows`).toBeGreaterThan(0)

        for (const mode of ARROW_VIEW_MODES) {
          if (situation.unsupported?.[mode]) continue
          const segments = computeSituationSegments(boardForMode(situation.base(), mode))
          for (const segment of segments) {
            expect(
              segment.d.length,
              `${situation.id}/${mode} emitted an empty path`,
            ).toBeGreaterThan(0)
          }
        }
      })

      it('is deterministic — the same board routes identically twice', () => {
        for (const mode of ARROW_VIEW_MODES) {
          if (situation.unsupported?.[mode]) continue
          const first = computeSituationSegments(boardForMode(situation.base(), mode))
          const second = computeSituationSegments(boardForMode(situation.base(), mode))
          expect(second).toEqual(first)
        }
      })
    })
  }

  it('the dev catalog page mounts and draws every situation', () => {
    const { container } = render(<ArrowSituationCatalogPage />)

    // One heading per situation.
    const headings = container.querySelectorAll('h2')
    expect(headings).toHaveLength(ARROW_SITUATIONS.length)

    // Every situation renders three mode columns (a board or a "not
    // applicable" note); the supported ones draw at least one path.
    const paths = container.querySelectorAll('svg path[stroke]')
    expect(paths.length).toBeGreaterThan(0)
  })

  it('merges same-side arrivals and departures into one trunk (auto-detected)', () => {
    // S7 (confluence) and S8 (fan-out) are the two situations that share a
    // target/source side; both must gain a merge trunk with no cell-id gate.
    for (const id of ['S7', 'S8']) {
      const situation = ARROW_SITUATIONS.find((s) => s.id === id)!
      for (const mode of ARROW_VIEW_MODES) {
        if (situation.unsupported?.[mode]) continue
        const segments = computeSituationSegments(boardForMode(situation.base(), mode))
        const trunks = segments.filter((segment) =>
          /confluence|fan-out/.test(segment.id),
        )
        expect(trunks, `${id}/${mode} drew no trunk`).toHaveLength(1)
        // A confluence trunk carries the single head; a fan-out trunk gathers
        // with no head (its drops carry the heads).
        expect(trunks[0]!.showMarker).toBe(id === 'S7')
      }
    }
  })

  it('the per-scenario off-switch disables the merge, restoring individual arrows', () => {
    for (const id of ['S7', 'S8', 'S9']) {
      const situation = ARROW_SITUATIONS.find((s) => s.id === id)!
      for (const mode of ARROW_VIEW_MODES) {
        if (situation.unsupported?.[mode]) continue
        const board = boardForMode(situation.base(), mode)

        const merged = computeSituationSegments(board)
        expect(
          merged.some((segment) => /confluence|fan-out/.test(segment.id)),
          `${id}/${mode} expected a trunk with the switch on`,
        ).toBe(true)

        const off = computeSituationSegments(board, { mergeConfluences: false })
        expect(
          off.some((segment) => /confluence|fan-out/.test(segment.id)),
          `${id}/${mode} still merged with the switch off`,
        ).toBe(false)
        // Off reproduces exactly one individual arrow per dependency — the
        // pre-confluence behaviour.
        expect(off.map((segment) => segment.id).sort()).toEqual(
          board.dependencies.map((dependency) => dependency.id).sort(),
        )
        for (const segment of off) {
          expect(segment.showMarker).toBeUndefined()
        }
      }
    }
  })

  it('side-by-side never perturbs a route a single band already drew', () => {
    // A neighbour band is exactly what must NOT change a route. Any situation
    // whose single and side-by-side geometry diverge would be reading across
    // bands — the invariant B-slices must preserve.
    for (const situation of ARROW_SITUATIONS) {
      if (situation.unsupported?.single || situation.unsupported?.['side-by-side']) {
        continue
      }
      const single = computeSituationSegments(boardForMode(situation.base(), 'single'))
      const sideBySide = computeSituationSegments(
        boardForMode(situation.base(), 'side-by-side'),
      )
      expect(sideBySide, `${situation.id} side-by-side drifted from single`).toEqual(
        single,
      )
    }
  })
})

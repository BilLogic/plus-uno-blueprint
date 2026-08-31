/**
 * URL view state — the one module that owns the view query-param names.
 *
 * Params: `slice` (slice id), `mode` (`present` only; absence of `mode` with a
 * `slice` param means slice focus view), `slide` (presentation slide index),
 * `cell` (cell id — opens the base blueprint with that cell's panel showing).
 * Unknown params are ignored on parse and dropped on serialize.
 *
 * `cell` is the share link an outside tool hands back: uno-bot's
 * blueprint_search cites a cell and attaches `…/?cell=<id>` so a Slack or IDE
 * reader can open the exact cell it quoted. It belongs to the BASE view — a
 * slice tab is a different reading of the blueprint, so `slice` wins and `cell`
 * is dropped when both appear rather than opening a panel behind a tab.
 *
 * The cross-repo relationship: docs/connectors/plus-uno.md.
 */

import { BLUEPRINT_CONTRACT } from '@/lib/blueprintContract'

// Param names come from the cross-repo contract (uno-bot builds links with
// the same constants, vendored from blueprintContract.ts).
const PARAMS = BLUEPRINT_CONTRACT.urlParams

export type UrlViewState =
  | { kind: 'blueprint'; cellId?: string }
  | { kind: 'slice'; sliceId: string }
  | { kind: 'present'; sliceId: string; slide: number }

/**
 * The spelling this param had until 2026-08-30, still READ and never written.
 *
 * A present link is a thing people paste into Slack, so the old spelling has
 * to keep resolving — the same argument `breadcrumb.aliases` made for the
 * embedded label, and the same shape: one alias, read-only, so nothing new
 * can be produced wearing it. It costs one `??` and it is what stops a rename
 * from quietly sending an old link to slide 1.
 */
const RETIRED_SLIDE_PARAM = 'frame'

/** Malformed or missing indexes parse to 0; negative integers clamp to 0. */
function parseSlideParam(raw: string | null): number {
  if (raw === null) return 0
  const value = Number(raw)
  if (!Number.isInteger(value)) return 0
  return value < 0 ? 0 : value
}

/** Parse a location search string; null when no view params are present. */
export function parseUrlViewState(search: string): UrlViewState | null {
  const params = new URLSearchParams(search)
  const sliceId = params.get(PARAMS.slice)

  if (sliceId) {
    if (params.get(PARAMS.mode) === 'present') {
      return {
        kind: 'present',
        sliceId,
        slide: parseSlideParam(
          params.get(PARAMS.slide) ?? params.get(RETIRED_SLIDE_PARAM),
        ),
      }
    }
    return { kind: 'slice', sliceId }
  }

  const cellId = params.get(PARAMS.cell)
  if (cellId) return { kind: 'blueprint', cellId }

  return null
}

/** Serialize to a search string ('' for the plain blueprint view). */
export function serializeUrlViewState(state: UrlViewState): string {
  const params = new URLSearchParams()

  switch (state.kind) {
    case 'blueprint':
      if (state.cellId) params.set(PARAMS.cell, state.cellId)
      break
    case 'slice':
      params.set(PARAMS.slice, state.sliceId)
      break
    case 'present':
      params.set(PARAMS.slice, state.sliceId)
      params.set(PARAMS.mode, 'present')
      params.set(PARAMS.slide, String(Math.max(0, Math.trunc(state.slide))))
      break
  }

  const search = params.toString()
  return search ? `?${search}` : ''
}

/**
 * URL view state — the one module that owns the view query-param names.
 *
 * Params: `slice` (slice id), `mode` (`present` only; absence of `mode` with a
 * `slice` param means slice focus view), `frame` (presentation frame index),
 * `lens` (`assumption` only). Unknown params are ignored on parse and dropped
 * on serialize.
 */

export type UrlViewState =
  | { kind: 'blueprint'; lens?: 'assumption' }
  | { kind: 'slice'; sliceId: string; lens?: 'assumption' }
  | { kind: 'present'; sliceId: string; frame: number }

/** Malformed or missing frames parse to 0; negative integers clamp to 0. */
function parseFrameParam(raw: string | null): number {
  if (raw === null) return 0
  const value = Number(raw)
  if (!Number.isInteger(value)) return 0
  return value < 0 ? 0 : value
}

/** Parse a location search string; null when no view params are present. */
export function parseUrlViewState(search: string): UrlViewState | null {
  const params = new URLSearchParams(search)
  const sliceId = params.get('slice')
  const lens = params.get('lens') === 'assumption' ? ('assumption' as const) : undefined

  if (sliceId) {
    if (params.get('mode') === 'present') {
      return { kind: 'present', sliceId, frame: parseFrameParam(params.get('frame')) }
    }
    return lens ? { kind: 'slice', sliceId, lens } : { kind: 'slice', sliceId }
  }

  if (lens) return { kind: 'blueprint', lens }
  return null
}

/** Serialize to a search string ('' for the plain blueprint view). */
export function serializeUrlViewState(state: UrlViewState): string {
  const params = new URLSearchParams()

  switch (state.kind) {
    case 'blueprint':
      if (state.lens) params.set('lens', state.lens)
      break
    case 'slice':
      params.set('slice', state.sliceId)
      if (state.lens) params.set('lens', state.lens)
      break
    case 'present':
      params.set('slice', state.sliceId)
      params.set('mode', 'present')
      params.set('frame', String(Math.max(0, Math.trunc(state.frame))))
      break
  }

  const search = params.toString()
  return search ? `?${search}` : ''
}

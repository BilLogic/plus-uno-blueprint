/**
 * URL view state — the one module that owns the view query-param names.
 *
 * Params: `slice` (slice id), `mode` (`present` only; absence of `mode` with a
 * `slice` param means slice focus view), `frame` (presentation frame index).
 * Unknown params are ignored on parse and dropped on serialize.
 */

export type UrlViewState =
  | { kind: 'blueprint' }
  | { kind: 'slice'; sliceId: string }
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

  if (sliceId) {
    if (params.get('mode') === 'present') {
      return { kind: 'present', sliceId, frame: parseFrameParam(params.get('frame')) }
    }
    return { kind: 'slice', sliceId }
  }

  return null
}

/** Serialize to a search string ('' for the plain blueprint view). */
export function serializeUrlViewState(state: UrlViewState): string {
  const params = new URLSearchParams()

  switch (state.kind) {
    case 'blueprint':
      break
    case 'slice':
      params.set('slice', state.sliceId)
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

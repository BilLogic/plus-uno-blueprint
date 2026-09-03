import { describe, expect, it } from 'vitest'
import { parseServiceSlug, serviceRoutePath } from '@/lib/serviceRoute'
import { parseUrlViewState } from '@/lib/urlViewState'

/*
 * The service lives in the path, the view state lives in the search. These pin
 * that they parse independently, so a shared cell link `/<slug>?cell=<id>`
 * carries both the service and the cell.
 */

describe('parseServiceSlug', () => {
  it('is null at the bare root', () => {
    expect(parseServiceSlug('/')).toBeNull()
    expect(parseServiceSlug('')).toBeNull()
  })

  it('reads the first path segment as the slug', () => {
    expect(parseServiceSlug('/plus-tutoring')).toBe('plus-tutoring')
  })

  it('lowercases so a hand-typed slug still resolves', () => {
    expect(parseServiceSlug('/Plus-Tutoring')).toBe('plus-tutoring')
  })

  it('ignores anything past the first segment', () => {
    expect(parseServiceSlug('/plus-tutoring/anything/else')).toBe('plus-tutoring')
  })
})

describe('serviceRoutePath', () => {
  it('builds the path for a slug', () => {
    expect(serviceRoutePath('plus-tutoring')).toBe('/plus-tutoring')
  })

  it('preserves the search string', () => {
    expect(serviceRoutePath('plus-tutoring', '?cell=abc')).toBe('/plus-tutoring?cell=abc')
  })

  it('maps a null slug to the bare root', () => {
    expect(serviceRoutePath(null)).toBe('/')
    expect(serviceRoutePath(null, '?cell=abc')).toBe('/?cell=abc')
  })
})

describe('a shared cell link carries the service and the cell', () => {
  it('resolves the service from the path and the cell from the search', () => {
    // The URL uno-bot builds when it cites a cell in a multi-service deployment.
    const pathname = '/plus-tutoring'
    const search = '?cell=cell-123'

    expect(parseServiceSlug(pathname)).toBe('plus-tutoring')
    expect(parseUrlViewState(search)).toEqual({ kind: 'blueprint', cellId: 'cell-123' })
  })
})

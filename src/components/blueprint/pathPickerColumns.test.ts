import { describe, expect, it } from 'vitest'
import { groupPathsIntoColumns } from '@/components/blueprint/PathMultiSelect'
import { PATH_TYPES } from '@/lib/versionValidation'

/**
 * #514 — one column per kind.
 *
 * The picker assigned columns from two `Set`s of kinds, each listing a member
 * twice: the residue of `20260830190000` folding `alternative` onto `variant`
 * and `unhappy` onto `exception`, which turned two entries into one. A `Set`
 * absorbs a repeat rather than failing, so the literals read as nonsense and
 * behaved correctly, and nothing in the tree could say so.
 *
 * What a test can hold is the property the shape now has: every path is drawn,
 * and drawn once. That is the failure the template hit from the other
 * direction — its sets genuinely overlapped on `variant`, and a variant path
 * was drawn in both columns.
 */

const path = (id: string, kind: string) => ({ id, name: id, kind }) as never

describe('the picker s columns', () => {
  it('draws every path exactly once, for every kind the schema allows', () => {
    const paths = PATH_TYPES.map((kind) => path(kind, kind))
    const drawn = groupPathsIntoColumns(paths).flat()
    expect(drawn).toHaveLength(paths.length)
    expect(new Set(drawn.map((p) => p.id)).size).toBe(paths.length)
  })

  it('keeps happy and variant left of exception', () => {
    const columns = groupPathsIntoColumns([
      path('e', 'exception'),
      path('h', 'happy'),
      path('v', 'variant'),
    ])
    const order = columns.flat().map((p) => p.id)
    expect(order.indexOf('e')).toBeGreaterThan(order.indexOf('h'))
    expect(order.indexOf('e')).toBeGreaterThan(order.indexOf('v'))
  })

  it('still draws a kind this build does not know', () => {
    // A row written against a newer schema lands in `other` rather than
    // vanishing — which is the whole reason that column exists.
    const drawn = groupPathsIntoColumns([path('x', 'from-the-future')]).flat()
    expect(drawn.map((p) => p.id)).toEqual(['x'])
  })

  it('yields no empty column', () => {
    expect(groupPathsIntoColumns([]).length).toBe(0)
    expect(
      groupPathsIntoColumns([path('h', 'happy')]).every((c) => c.length > 0),
    ).toBe(true)
  })
})

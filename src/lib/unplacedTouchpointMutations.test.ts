/**
 * What the two queue operations record, and what they refuse.
 *
 * Both are destructive — each removes a row from the queue, and one of them
 * also writes over whatever the placement was carrying. So the facts worth
 * asserting are the ones a reviewer cannot read off the source: which values
 * the captured inverse holds, and whether a response shaped like a success but
 * naming nothing is allowed to look like one.
 *
 * The last is not hypothetical. A zero-row write reads as a 200 through
 * PostgREST, and an operation that records an inverse for something that never
 * happened puts a revert in the sheet that would write the detail back into a
 * cell it was never taken out of.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Database, UnplacedTouchpointDetail } from '@/types/database'
import { clearSession, sessionSnapshot } from '@/lib/authoringSession'
import {
  discardTouchpointDetail,
  placeTouchpointDetail,
} from '@/lib/unplacedTouchpointMutations'

const DETAIL: UnplacedTouchpointDetail = {
  id: 'detail-1',
  cell_id: 'cell-1',
  name: 'Workday (Employee View)',
  summary: 'Where a new hire confirms their start date.',
  screenshot: 'https://example.invalid/shot.png',
  url: null,
  prominence: null,
  origin: 'import',
  created_at: '2026-08-31T00:00:00Z',
  updated_at: '2026-08-31T00:00:00Z',
}

/**
 * Answers `rpc` and nothing else — the only call either function makes. An
 * unknown shape should fail the test rather than be quietly served.
 */
function fakeClient(answer: unknown) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
  const client = {
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args })
      return Promise.resolve({ data: answer, error: null })
    },
  }
  return { client: client as unknown as SupabaseClient<Database>, calls }
}

const PLACED = {
  detail: DETAIL,
  cell_id: 'cell-1',
  touchpoint_id: 'tp-workday',
  touchpoint_name: 'Workday',
  previous: {
    summary: 'The employer view of the same tool.',
    screenshot: null,
    url: null,
    prominence: 'core',
  },
}

beforeEach(() => {
  clearSession()
})

describe('placeTouchpointDetail', () => {
  it('sends the detail and the touchpoint the person chose, and nothing else', () => {
    const { client, calls } = fakeClient(PLACED)
    return placeTouchpointDetail(client, 'detail-1', 'tp-workday').then(() => {
      expect(calls).toEqual([
        {
          fn: 'place_touchpoint_detail',
          args: { p_detail_id: 'detail-1', p_touchpoint_id: 'tp-workday' },
        },
      ])
    })
  })

  it('captures an inverse that restores BOTH halves', async () => {
    // Restoring only the queue row would leave the words written on the
    // placement as well — the same detail in two places. Restoring only the
    // placement would lose the row. One call, both halves.
    const { client } = fakeClient(PLACED)
    await placeTouchpointDetail(client, 'detail-1', 'tp-workday')

    const [entry] = sessionSnapshot()
    expect(entry.fn).toBe('place_touchpoint_detail')
    expect(entry.revert?.fn).toBe('restore_touchpoint_detail')
    // The row comes back under its OWN id: a detail restored as a new row
    // reads as a second piece of work nobody did.
    expect((entry.revert?.args.detail as UnplacedTouchpointDetail).id).toBe(
      'detail-1',
    )
    expect(entry.revert?.args.placement).toEqual({
      cell_id: 'cell-1',
      touchpoint_id: 'tp-workday',
      summary: 'The employer view of the same tool.',
      screenshot: null,
      url: null,
      prominence: 'core',
    })
  })

  it('names both touchpoints in the ledger row', async () => {
    // The pair IS the decision, and it is the thing somebody might want back.
    const { client } = fakeClient(PLACED)
    await placeTouchpointDetail(client, 'detail-1', 'tp-workday')
    const [entry] = sessionSnapshot()
    expect(entry.args.name).toBe('Workday (Employee View)')
    expect(entry.args.touchpoint_name).toBe('Workday')
  })

  it('refuses an answer that names no detail, and records nothing', async () => {
    const { client } = fakeClient({ detail: null })
    await expect(
      placeTouchpointDetail(client, 'detail-1', 'tp-workday'),
    ).rejects.toThrow(/no longer waiting/)
    expect(sessionSnapshot()).toEqual([])
  })

  it('logs nothing when the caller is a revert', async () => {
    const { client } = fakeClient(PLACED)
    await placeTouchpointDetail(client, 'detail-1', 'tp-workday', {
      record: false,
    })
    expect(sessionSnapshot()).toEqual([])
  })
})

describe('discardTouchpointDetail', () => {
  it('captures the row it destroyed, with no placement to put back', async () => {
    const { client } = fakeClient({ detail: DETAIL })
    await discardTouchpointDetail(client, 'detail-1')

    const [entry] = sessionSnapshot()
    expect(entry.fn).toBe('discard_touchpoint_detail')
    expect(entry.revert?.fn).toBe('restore_touchpoint_detail')
    expect(entry.revert?.args.detail).toEqual(DETAIL)
    // A discard never touched a placement, so there is nothing to restore on
    // one — and passing a stale placement here would write over words the
    // author has since edited.
    expect(entry.revert?.args.placement).toBeNull()
  })

  it('refuses an answer that names no detail', async () => {
    const { client } = fakeClient(null)
    await expect(discardTouchpointDetail(client, 'detail-1')).rejects.toThrow(
      /no longer waiting/,
    )
    expect(sessionSnapshot()).toEqual([])
  })
})

/**
 * The queue lists; a person decides.
 *
 * Every assertion here is about that sentence. The rows carry a name, and the
 * name is the one thing that must NOT be allowed to choose anything — reading
 * it as an instruction is what produced the 57 unreachable details in the
 * first place, and it is what an automatic fix would do again on a larger
 * scale. So the targets a row offers come from the placements its cell
 * actually has, and the test below hands the shaper a row whose name matches a
 * touchpoint the cell does not show, to prove it offers nothing.
 */
import { describe, expect, it } from 'vitest'
import {
  queueHeadline,
  unplacedQueue,
  type RawUnplacedDetail,
} from '@/lib/unplacedTouchpointDetails'

const cell = (patch: Partial<NonNullable<RawUnplacedDetail['cells']>> = {}) => ({
  content: 'PLUS App\nWorkday',
  lanes: { name: 'Front Stage Touchpoints' },
  steps: { name: 'Accepts the offer' },
  paths: {
    name: 'Happy path',
    scenarios: { name: 'Onboarding', phases: { name: 'Enrollment' } },
  },
  cell_touchpoints: [
    { position: 2, touchpoint_id: 'tp-workday', touchpoints: { name: 'Workday' } },
    { position: 1, touchpoint_id: 'tp-plus', touchpoints: { name: 'PLUS App' } },
  ],
  ...patch,
})

const row = (patch: Partial<RawUnplacedDetail> = {}): RawUnplacedDetail => ({
  id: 'detail-1',
  cell_id: 'cell-1',
  name: 'Workday (Employee View)',
  summary: 'Where a new hire confirms their start date.',
  screenshot: 'https://example.invalid/shot.png',
  url: null,
  cells: cell(),
  ...patch,
})

describe('unplacedQueue', () => {
  it('says what the cell actually shows, beside the name that matched nothing', () => {
    const [entry] = unplacedQueue([row()])
    expect(entry.name).toBe('Workday (Employee View)')
    expect(entry.shows).toEqual(['PLUS App', 'Workday'])
    expect(entry.where).toBe(
      'Enrollment · Onboarding · Happy path · Accepts the offer · Front Stage Touchpoints',
    )
  })

  it('offers only the touchpoints the cell places, in the order it draws them', () => {
    const [entry] = unplacedQueue([row()])
    expect(entry.targets).toEqual([
      { touchpointId: 'tp-plus', name: 'PLUS App' },
      { touchpointId: 'tp-workday', name: 'Workday' },
    ])
  })

  it('offers nothing named like the detail when the cell does not show it', () => {
    // The whole ticket in one assertion. `Workday (Employee View)` is a real
    // string somebody wrote and it resembles `Workday` closely enough that a
    // matcher would pair them — which would put a screenshot of the employee
    // view under a pill that means the employer one. No target may carry the
    // detail's own name unless the cell genuinely places it.
    const [entry] = unplacedQueue([row()])
    expect(entry.targets.map((target) => target.name)).not.toContain(
      'Workday (Employee View)',
    )
  })

  it('offers no target at all when the cell places nothing', () => {
    // Not an error and not a hidden row: the cell shows no touchpoint, so
    // there is nowhere to put the detail until somebody edits the cell. The
    // author has to be able to see that, which means the row is listed.
    const [entry] = unplacedQueue([
      row({ cells: cell({ content: 'Signs the contract', cell_touchpoints: [] }) }),
    ])
    expect(entry.targets).toEqual([])
    expect(entry.shows).toEqual(['Signs the contract'])
  })

  it('lists a row whose cell did not come back rather than dropping it', () => {
    // A detail that vanishes from the queue is the defect this queue exists
    // to end, arrived at from the other direction.
    const [entry] = unplacedQueue([row({ cells: null })])
    expect(entry.id).toBe('detail-1')
    expect(entry.shows).toEqual([])
    expect(entry.targets).toEqual([])
    expect(entry.where).toBe('Somewhere in this service')
  })

  it('groups the queue by where the work is, then by name', () => {
    const entries = unplacedQueue([
      row({ id: 'b', name: 'Zoom Recording' }),
      row({ id: 'a', name: 'Handshake Employer Profile' }),
      row({
        id: 'c',
        cell_id: 'cell-2',
        // Sorts ahead of "Accepts the offer", so this row leads despite its
        // name sorting last of the three: where beats name.
        cells: cell({ steps: { name: 'A first look' } }),
      }),
    ])
    expect(entries.map((entry) => entry.id)).toEqual(['c', 'a', 'b'])
  })

  it('keeps a detail that carries only a screenshot', () => {
    // "Detail" is not "words". A screenshot with no summary is still somebody's
    // work, and dropping it here would repeat the loss quietly.
    const [entry] = unplacedQueue([row({ summary: null })])
    expect(entry.summary).toBeNull()
    expect(entry.screenshot).toBe('https://example.invalid/shot.png')
  })
})

describe('queueHeadline', () => {
  it('says so when the queue is empty', () => {
    // An empty queue that rendered nothing would be indistinguishable from a
    // queue that failed to load, which is how half the authored content went
    // missing without anybody noticing.
    expect(queueHeadline(0)).toBe('No unplaced touchpoint details')
  })

  it('counts one and many', () => {
    expect(queueHeadline(1)).toBe('1 unplaced touchpoint detail')
    expect(queueHeadline(57)).toBe('57 unplaced touchpoint details')
  })
})

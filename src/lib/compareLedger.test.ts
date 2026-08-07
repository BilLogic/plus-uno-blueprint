import { describe, expect, it } from 'vitest'
import type { BlueprintCell, BlueprintData } from '@/types/blueprint'
import { buildCompareModel, type CompareBlueprints } from '@/lib/compareSlots'
import {
  compareSlotFocusCellIds,
  compareZoneFocusCellIds,
  countCompareDifferences,
  deriveCompareZones,
  filterCompareSlots,
  getDetailOnlyCompareSlots,
  isDetailOnlyCompareSlot,
  parseCompareLedgerFilter,
} from '@/lib/compareLedger'

type CellSpec = {
  lane: string
  step: string
  content: string
  description?: string
  id?: string
}

let autoId = 0
const nextId = (prefix: string) => `${prefix}-${(autoId += 1)}`

function makeBlueprint(
  pathId: string,
  steps: string[],
  cells: CellSpec[],
  lanes?: string[],
): BlueprintData {
  const laneNames = lanes ?? [...new Set(cells.map((cell) => cell.lane))]
  const layers = laneNames.map((name, index) => ({
    id: `${pathId}-lane-${name}`,
    name,
    row_position: index,
  }))
  const stepRows = steps.map((name, index) => ({
    id: `${pathId}-step-${index}`,
    name,
    column_position: index,
  }))
  const stepIdByName = new Map(stepRows.map((step) => [step.name, step.id]))
  const blueprintCells: BlueprintCell[] = cells.map((cell) => ({
    id: cell.id ?? nextId(`${pathId}-cell`),
    layer_id: `${pathId}-lane-${cell.lane}`,
    step_id: stepIdByName.get(cell.step) ?? '',
    content: cell.content,
    picture: null,
    description: cell.description ?? null,
    links: [],
  }))
  return {
    path: {
      id: pathId,
      name: pathId,
      description: null,
      note: null,
      path_type: 'happy',
    },
    layers,
    steps: stepRows,
    cells: blueprintCells,
    triggers: [],
  }
}

const pair = (a: BlueprintData, b: BlueprintData): CompareBlueprints => [a, b]

/**
 * Shared fixture: steps Browse/Pay/Confirm/Ship/Rate; Browse and Ship are
 * shared; Pay+Confirm diverge (zone ①), Rate diverges (zone ②); Ship has a
 * detail-only (description) difference.
 */
function fixture() {
  const a = makeBlueprint(
    'A',
    ['Browse', 'Pay', 'Confirm', 'Ship', 'Rate'],
    [
      { lane: 'Front Stage', step: 'Browse', content: 'Browse catalog' },
      { lane: 'Front Stage', step: 'Pay', content: 'Pay by card' },
      { lane: 'Back Stage', step: 'Pay', content: 'Charge card' },
      { lane: 'Front Stage', step: 'Confirm', content: 'Confirmation email' },
      {
        lane: 'Front Stage',
        step: 'Ship',
        content: 'Ship order',
        description: 'Courier A',
      },
      { lane: 'Front Stage', step: 'Rate', content: 'Rate purchase' },
    ],
  )
  const b = makeBlueprint(
    'B',
    ['Browse', 'Pay', 'Confirm', 'Ship', 'Rate'],
    [
      { lane: 'Front Stage', step: 'Browse', content: 'Browse catalog' },
      { lane: 'Front Stage', step: 'Pay', content: 'Pay declined' },
      { lane: 'Back Stage', step: 'Pay', content: 'Callback queued' },
      { lane: 'Front Stage', step: 'Confirm', content: 'Agent calls' },
      {
        lane: 'Front Stage',
        step: 'Ship',
        content: 'Ship order',
        description: 'Courier B',
      },
      { lane: 'Front Stage', step: 'Rate', content: 'Rate the call' },
    ],
  )
  return buildCompareModel(pair(a, b))
}

describe('deriveCompareZones', () => {
  it('numbers divergent runs left-to-right with step ranges and labels', () => {
    const zones = deriveCompareZones(fixture())
    expect(zones).toHaveLength(2)
    expect(zones[0].index).toBe(1)
    expect(zones[0].stepRangeLabel).toBe('Steps 2–3')
    expect(zones[0].titleLabel).toBe('Pay → Confirm')
    expect(zones[1].index).toBe(2)
    expect(zones[1].stepRangeLabel).toBe('Step 5')
    expect(zones[1].titleLabel).toBe('Rate')
  })

  it('collects only canvas-difference slots, in model order', () => {
    const zones = deriveCompareZones(fixture())
    // Zone ①: Front Stage Pay, Back Stage Pay, Front Stage Confirm.
    expect(zones[0].slots.map((slot) => slot.columnLabel)).toEqual([
      'Pay',
      'Pay',
      'Confirm',
    ])
    expect(zones[1].slots).toHaveLength(1)
    // The detail-only Ship slot belongs to no zone.
    for (const zone of zones) {
      expect(zone.slots.some((slot) => slot.columnLabel === 'Ship')).toBe(false)
    }
  })

  it('treats a detail-only column as shared for zone purposes (V7)', () => {
    // Ship differs only by description: no canvas fork, no zone — it lives
    // exclusively in the unnumbered detail-only group.
    const model = fixture()
    const detailOnly = getDetailOnlyCompareSlots(model)
    expect(detailOnly).toHaveLength(1)
    expect(detailOnly[0].columnLabel).toBe('Ship')
    expect(detailOnly[0].differingFields).toEqual(['description'])
  })
})

describe('isDetailOnlyCompareSlot', () => {
  it('requires every path present and content equal', () => {
    const model = fixture()
    const paySlot = model.slots.find(
      (slot) => slot.columnLabel === 'Pay' && slot.laneLabel === 'Front Stage',
    )!
    expect(isDetailOnlyCompareSlot(paySlot)).toBe(false)
    const shipSlot = model.slots.find((slot) => slot.columnLabel === 'Ship')!
    expect(isDetailOnlyCompareSlot(shipSlot)).toBe(true)
  })

  it('never classifies presence differences as detail-only', () => {
    const a = makeBlueprint(
      'A',
      ['Browse', 'Extra'],
      [
        { lane: 'Front Stage', step: 'Browse', content: 'Browse' },
        { lane: 'Front Stage', step: 'Extra', content: 'Only in A' },
      ],
    )
    const b = makeBlueprint('B', ['Browse'], [
      { lane: 'Front Stage', step: 'Browse', content: 'Browse' },
    ])
    const model = buildCompareModel(pair(a, b))
    const onlySlot = model.slots.find((slot) => slot.verdict === 'only')!
    expect(isDetailOnlyCompareSlot(onlySlot)).toBe(false)
    const zones = deriveCompareZones(model)
    expect(zones).toHaveLength(1)
    expect(zones[0].slots).toContain(onlySlot)
  })
})

describe('countCompareDifferences', () => {
  it('counts every non-shared slot (zones + detail-only)', () => {
    const model = fixture()
    const zones = deriveCompareZones(model)
    const zoneCount = zones.reduce((sum, zone) => sum + zone.slots.length, 0)
    const detailCount = getDetailOnlyCompareSlots(model).length
    expect(countCompareDifferences(model)).toBe(zoneCount + detailCount)
    expect(countCompareDifferences(model)).toBe(5)
  })
})

describe('parseCompareLedgerFilter', () => {
  it('parses quoted lanes and verdicts, multi-select', () => {
    const parsed = parseCompareLedgerFilter(
      'lane:"Front Stage" lane:backstage verdict:divergent verdict:only',
    )
    expect(parsed.lanes).toEqual(['front stage', 'backstage'])
    expect(parsed.verdicts).toEqual(['divergent', 'only'])
    expect(parsed.errors).toEqual([])
  })

  it('normalizes lane values the way the model aligns lanes', () => {
    const parsed = parseCompareLedgerFilter('lane:"The Front-Stage."')
    expect(parsed.lanes).toEqual(['front stage'])
  })

  it('reports unknown verdicts and stray tokens as errors', () => {
    const parsed = parseCompareLedgerFilter('verdict:shared banana')
    expect(parsed.verdicts).toEqual([])
    expect(parsed.errors).toEqual(['verdict:shared', 'banana'])
  })

  it('empty input clears everything', () => {
    const parsed = parseCompareLedgerFilter('')
    expect(parsed.lanes).toEqual([])
    expect(parsed.verdicts).toEqual([])
    expect(parsed.errors).toEqual([])
  })
})

describe('filterCompareSlots', () => {
  it('empty facets pass everything; facets intersect', () => {
    const model = fixture()
    const zones = deriveCompareZones(model)
    const slots = zones[0].slots
    expect(filterCompareSlots(slots, { lanes: [], verdicts: [] })).toHaveLength(
      slots.length,
    )
    const backStageOnly = filterCompareSlots(slots, {
      lanes: ['back stage'],
      verdicts: [],
    })
    expect(backStageOnly).toHaveLength(1)
    expect(backStageOnly[0].laneLabel).toBe('Back Stage')
    expect(
      filterCompareSlots(slots, { lanes: ['back stage'], verdicts: ['only'] }),
    ).toHaveLength(0)
  })
})

describe('focus cell id derivation', () => {
  it('leads with the first present path and includes all counterparts', () => {
    const model = fixture()
    const zones = deriveCompareZones(model)
    const ids = compareZoneFocusCellIds(zones[0])
    expect(ids.length).toBe(2)
    expect(ids[0].startsWith('A-cell')).toBe(true)
    expect(ids[1].startsWith('B-cell')).toBe(true)
    const slotIds = compareSlotFocusCellIds(zones[0].slots[0])
    expect(slotIds).toEqual(ids)
  })
})

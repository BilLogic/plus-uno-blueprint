import type { BlueprintCell, BlueprintData, BlueprintLane } from '@/types/blueprint'

const WARM_UP_ALTERNATE_PATH_ID =
  'a0000000-0000-4000-8000-000000000350'

/** Alternate-path lane ids keyed by warm-up cell id suffix (…060103 → 03). */
const WARM_UP_ALTERNATE_LAYER_ID_BY_CELL_SUFFIX: Record<string, string> = {
  '01': 'a0000000-0000-4000-8000-000000000401',
  '02': 'a0000000-0000-4000-8000-000000000402',
  '03': 'a0000000-0000-4000-8000-000000000403',
  '04': 'a0000000-0000-4000-8000-000000000404',
  '06': 'a0000000-0000-4000-8000-000000000406',
  '07': 'a0000000-0000-4000-8000-000000000407',
  '08': 'a0000000-0000-4000-8000-000000000408',
  '09': 'a0000000-0000-4000-8000-000000000409',
  '10': 'a0000000-0000-4000-8000-000000000410',
}

const WARM_UP_ALTERNATE_CELL_ID_PATTERN =
  /^a0000000-0000-4000-8000-00000006\d{4}$/

export function resolveWarmUpAlternateCellLayerId(
  cellId: string,
): string | undefined {
  if (!WARM_UP_ALTERNATE_CELL_ID_PATTERN.test(cellId)) return undefined
  return WARM_UP_ALTERNATE_LAYER_ID_BY_CELL_SUFFIX[cellId.slice(-2)]
}

export function assignWarmUpAlternateCellLayerId(
  cell: BlueprintCell,
): BlueprintCell {
  const laneId = resolveWarmUpAlternateCellLayerId(cell.id)
  if (!laneId || cell.lane_id === laneId) return cell
  return { ...cell, lane_id: laneId }
}

/** Align lane row positions with reference swimlanes (fixes legacy DB drift). */
export function repairWarmUpPathLayerPositions(
  data: BlueprintData,
  referenceLayers: readonly BlueprintLane[],
): BlueprintData {
  const rowByName = new Map(
    referenceLayers.map((lane) => [lane.name, lane.position]),
  )
  const lanes = data.lanes.map((lane) => {
    const position = rowByName.get(lane.name)
    if (position === undefined || lane.position === position) {
      return lane
    }
    return { ...lane, position: position }
  })
  lanes.sort((a, b) => a.position - b.position)

  const changed = lanes.some(
    (lane, index) => lane.position !== data.lanes[index]?.position,
  )

  return changed ? { ...data, lanes } : data
}

/** Correct swimlane assignment for Warm-Up Alternate Path cells. */
export function repairWarmUpAlternatePathBlueprint(
  data: BlueprintData,
): BlueprintData {
  if (data.path.id !== WARM_UP_ALTERNATE_PATH_ID) return data

  const cells = data.cells.map(assignWarmUpAlternateCellLayerId)
  const cellsChanged = cells.some(
    (cell, index) => cell.lane_id !== data.cells[index]?.lane_id,
  )

  if (!cellsChanged) {
    return data
  }

  return { ...data, cells }
}

/**
 * Legacy drift on Warm-Up's second path, patched on the way in.
 *
 * **Both faults are fixed at source as of 2026-08-21** — the lane positions by
 * migration `20260821270000`, and the cell-to-lane assignment was already
 * clean (0 of 28 misfiled when checked). Against the live database every
 * function here is now a no-op.
 *
 * It stays for the no-DB dev fallback, which has not been verified. When
 * somebody confirms the fixture agrees with the board, this file goes.
 */
import type { BlueprintCell, BlueprintData, BlueprintLane } from '@/types/blueprint'

const WARM_UP_ALTERNATE_PATH_ID =
  'a0000000-0000-4000-8000-000000000350'

/** Alternate-path lane ids keyed by warm-up cell id suffix (…060103 → 03). */
const WARM_UP_ALTERNATE_LANE_ID_BY_CELL_SUFFIX: Record<string, string> = {
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

export function resolveWarmUpAlternateCellLaneId(
  cellId: string,
): string | undefined {
  if (!WARM_UP_ALTERNATE_CELL_ID_PATTERN.test(cellId)) return undefined
  return WARM_UP_ALTERNATE_LANE_ID_BY_CELL_SUFFIX[cellId.slice(-2)]
}

export function assignWarmUpAlternateCellLaneId(
  cell: BlueprintCell,
): BlueprintCell {
  const laneId = resolveWarmUpAlternateCellLaneId(cell.id)
  if (!laneId || cell.lane_id === laneId) return cell
  return { ...cell, lane_id: laneId }
}

/** Align lane row positions with reference swimlanes (fixes legacy DB drift). */
export function repairWarmUpPathLanePositions(
  data: BlueprintData,
  referenceLanes: readonly BlueprintLane[],
): BlueprintData {
  const rowByName = new Map(
    referenceLanes.map((lane) => [lane.name, lane.position]),
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

  const cells = data.cells.map(assignWarmUpAlternateCellLaneId)
  const cellsChanged = cells.some(
    (cell, index) => cell.lane_id !== data.cells[index]?.lane_id,
  )

  if (!cellsChanged) {
    return data
  }

  return { ...data, cells }
}

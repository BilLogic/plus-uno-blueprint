import type { BlueprintData } from '@/types/blueprint'
import type { CompareStatus } from '@/types/integratedBlueprint'

/**
 * The highlight pass's primitive: classify every cell of the compared
 * paths *in place* — no merged grid, no moved layout, just a verdict per
 * real cell id that the side-by-side renderer paints from.
 *
 * Matching is the same grammar the merged spine used (and its tests
 * cover): steps align across paths by name, paired by occurrence order;
 * lanes align by name; a slot's text is the sorted multiset of its cells'
 * trimmed contents. All paths present and equal ⇒ every cell in the slot
 * is `shared`; one path only ⇒ `only`; anything else ⇒ `divergent`.
 */
export function comparePathCells(
  blueprints: BlueprintData[],
): Map<string, CompareStatus> {
  const result = new Map<string, CompareStatus>()
  if (blueprints.length < 2) return result

  const normalize = (name: string) => name.trim().toLowerCase()

  // Unified step columns by name + occurrence, mapping each path's step id
  // onto a shared column key.
  const columnKeyByPathStep = new Map<string, string>()
  const columnOccupancy: string[] = []
  for (const blueprint of blueprints) {
    const seen = new Map<string, number>()
    for (const step of [...blueprint.steps].sort(
      (a, b) => a.column_position - b.column_position,
    )) {
      const name = normalize(step.name)
      const occurrence = seen.get(name) ?? 0
      seen.set(name, occurrence + 1)
      const key = `${name}#${occurrence}`
      if (!columnOccupancy.includes(key)) columnOccupancy.push(key)
      columnKeyByPathStep.set(`${blueprint.path.id}:${step.id}`, key)
    }
  }

  type SlotCell = { id: string; pathId: string; content: string }
  const slots = new Map<string, SlotCell[]>()

  for (const blueprint of blueprints) {
    const laneNameById = new Map(
      blueprint.layers.map((layer) => [layer.id, normalize(layer.name)]),
    )
    for (const cell of blueprint.cells) {
      const columnKey = columnKeyByPathStep.get(
        `${blueprint.path.id}:${cell.step_id}`,
      )
      const laneKey = laneNameById.get(cell.layer_id)
      if (!columnKey || !laneKey) continue
      const slotKey = `${laneKey}::${columnKey}`
      const list = slots.get(slotKey)
      const entry: SlotCell = {
        id: cell.id,
        pathId: blueprint.path.id,
        content: cell.content,
      }
      if (list) list.push(entry)
      else slots.set(slotKey, [entry])
    }
  }

  const pathCount = blueprints.length
  for (const slotCells of slots.values()) {
    const byPath = new Map<string, SlotCell[]>()
    for (const cell of slotCells) {
      const list = byPath.get(cell.pathId)
      if (list) list.push(cell)
      else byPath.set(cell.pathId, [cell])
    }

    if (byPath.size === 1) {
      for (const cell of slotCells) result.set(cell.id, 'only')
      continue
    }

    const signatureOf = (list: SlotCell[]) =>
      list
        .map((cell) => cell.content.trim())
        .sort()
        .join('\u0000')
    const signatures = [...byPath.values()].map(signatureOf)
    const allEqual =
      byPath.size === pathCount &&
      signatures.every((entry) => entry === signatures[0])

    for (const cell of slotCells) {
      result.set(cell.id, allEqual ? 'shared' : 'divergent')
    }
  }

  return result
}

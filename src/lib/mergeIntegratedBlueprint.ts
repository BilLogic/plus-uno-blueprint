import { remapDiscoverySadFinalStepId } from '@/lib/repairDiscoverySadPathBlueprint'
import { pickPreferredPath } from '@/lib/pathSelection'
import type { BlueprintData } from '@/types/blueprint'
import {
  getIntegratedCellDisplayOpacity,
  INTEGRATED_UNSELECTED_OPACITY,
  type IntegratedBlueprintCell,
  type IntegratedBlueprintData,
  type IntegratedBlueprintStep,
  type IntegratedBlueprintTrigger,
} from '@/types/integratedBlueprint'

function pathOpacity(pathId: string, selectedPathIds: string[]): number {
  if (selectedPathIds.length === 0) {
    return INTEGRATED_UNSELECTED_OPACITY
  }
  return selectedPathIds.includes(pathId)
    ? 1
    : INTEGRATED_UNSELECTED_OPACITY
}

function pickPrimaryBlueprint(blueprints: BlueprintData[]): BlueprintData {
  if (blueprints.length === 0) {
    throw new Error('pickPrimaryBlueprint requires at least one blueprint')
  }
  const preferredPath = pickPreferredPath(
    blueprints.map((blueprint) => blueprint.path),
  )
  return (
    blueprints.find((blueprint) => blueprint.path.id === preferredPath?.id) ??
    blueprints[0]
  )
}

function mergeSteps(
  blueprints: BlueprintData[],
  primary: BlueprintData,
): IntegratedBlueprintStep[] {
  const integratedSteps: IntegratedBlueprintStep[] = []
  const integratedStepById = new Map<string, IntegratedBlueprintStep>()

  const appendSteps = (blueprint: BlueprintData) => {
    for (const step of [...blueprint.steps].sort(
      (a, b) => a.column_position - b.column_position,
    )) {
      const existing = integratedStepById.get(step.id)
      if (existing) {
        existing.pathStepIds[blueprint.path.id] = step.id
        continue
      }

      const integrated: IntegratedBlueprintStep = {
        id: step.id,
        name: step.name,
        column_position: integratedSteps.length + 1,
        pathStepIds: { [blueprint.path.id]: step.id },
      }
      integratedStepById.set(step.id, integrated)
      integratedSteps.push(integrated)
    }
  }

  appendSteps(primary)
  for (const blueprint of blueprints) {
    if (blueprint.path.id === primary.path.id) continue
    appendSteps(blueprint)
  }

  integratedSteps.forEach((step, index) => {
    step.column_position = index + 1
  })

  return integratedSteps
}

/**
 * Classify every occupied slot across the compared paths — the primitive all
 * of the comparison view stands on ("this cell in path A and that cell in
 * path B are the same thing").
 *
 * Position-and-lane matching: two cells are counterparts when they sit at
 * the same (lane, step) slot. Same trimmed text ⇒ `shared`; different text
 * ⇒ `divergent`; slot occupied by exactly one path ⇒ `only`. A slot where
 * some but not all paths have a cell is a disagreement about *existence*
 * and classifies as divergent-plus-only rather than shared.
 *
 * Returns the cells to keep (shared slots collapse to one copy, preferring
 * `primaryPathId`) and a remap of dropped duplicate ids onto the kept copy —
 * the caller re-points arrows through it, which is what makes arrows from
 * different paths visually fork *out of* the shared spine.
 */
export function classifyCompareCells(
  cells: IntegratedBlueprintCell[],
  selectedPathIds: string[],
  primaryPathId: string,
): { cells: IntegratedBlueprintCell[]; remap: Map<string, string> } {
  const selected = new Set(selectedPathIds)
  const inScope = cells.filter((cell) => selected.has(cell.path_id))

  const slots = new Map<string, IntegratedBlueprintCell[]>()
  for (const cell of inScope) {
    const key = `${cell.layer_id}::${cell.step_id}`
    const list = slots.get(key)
    if (list) list.push(cell)
    else slots.set(key, [cell])
  }

  const kept: IntegratedBlueprintCell[] = []
  const remap = new Map<string, string>()

  for (const slotCells of slots.values()) {
    const byPath = new Map<string, IntegratedBlueprintCell[]>()
    for (const cell of slotCells) {
      const list = byPath.get(cell.path_id)
      if (list) list.push(cell)
      else byPath.set(cell.path_id, [cell])
    }

    if (byPath.size === 1) {
      for (const cell of slotCells) kept.push({ ...cell, compare: 'only' })
      continue
    }

    // A path's "text" at a slot is the sorted multiset of its cells' trimmed
    // contents — tech lanes hold one cell per touchpoint, so a slot is equal
    // only when the whole set of touchpoints is.
    const signatureOf = (list: IntegratedBlueprintCell[]) =>
      list
        .map((cell) => cell.content.trim())
        .sort()
        .join('\u0000')
    const signatures = [...byPath.values()].map(signatureOf)
    const allSelectedPresent = byPath.size === selected.size
    const allEqual = signatures.every((entry) => entry === signatures[0])

    if (allSelectedPresent && allEqual) {
      const keeper =
        byPath.get(primaryPathId) ?? byPath.values().next().value!
      for (const cell of keeper) kept.push({ ...cell, compare: 'shared' })
      // Counterpart matching for arrow re-pointing: same slot, same sorted
      // rank — exact because the signatures are equal.
      const keeperSorted = [...keeper].sort((a, b) =>
        a.content.trim().localeCompare(b.content.trim()),
      )
      for (const list of byPath.values()) {
        if (list === keeper) continue
        const sorted = [...list].sort((a, b) =>
          a.content.trim().localeCompare(b.content.trim()),
        )
        sorted.forEach((cell, index) => {
          remap.set(cell.id, keeperSorted[index].id)
        })
      }
      continue
    }

    for (const cell of slotCells) kept.push({ ...cell, compare: 'divergent' })
  }

  return { cells: kept, remap }
}

/**
 * Compare-mode step alignment: two steps are the same *column* when their
 * names match, even though each path carries its own step rows.
 *
 * Merging by id (the integrated view's default) only unifies paths that
 * physically share `steps` rows — duplicated paths do, independently
 * authored ones do not. Without this, comparing two paths that both have a
 * "Set goals" column rendered it twice, every slot classified "only", and
 * the merged spine read as nonsense. Names pair by occurrence order, so a
 * path with two "Discovers PLUS" columns maps its first onto the other
 * path's first, second onto second.
 *
 * Returns the unified step list plus an alias map (`pathId:stepId` → the
 * unified step id) the cell pass translates through.
 */
function mergeStepsByName(
  blueprints: BlueprintData[],
  primary: BlueprintData,
): { steps: IntegratedBlueprintStep[]; alias: Map<string, string> } {
  const unified: IntegratedBlueprintStep[] = []
  const alias = new Map<string, string>()
  const normalize = (name: string) => name.trim().toLowerCase()

  const append = (blueprint: BlueprintData) => {
    // Occurrence counter per name, so repeated step names pair in order.
    const seen = new Map<string, number>()
    for (const step of [...blueprint.steps].sort(
      (a, b) => a.column_position - b.column_position,
    )) {
      const name = normalize(step.name)
      const occurrence = seen.get(name) ?? 0
      seen.set(name, occurrence + 1)

      const match = unified.filter(
        (entry) => normalize(entry.name) === name,
      )[occurrence]
      if (match) {
        match.pathStepIds[blueprint.path.id] = step.id
        alias.set(`${blueprint.path.id}:${step.id}`, match.id)
        continue
      }

      const created: IntegratedBlueprintStep = {
        id: step.id,
        name: step.name,
        column_position: unified.length + 1,
        pathStepIds: { [blueprint.path.id]: step.id },
      }
      unified.push(created)
      alias.set(`${blueprint.path.id}:${step.id}`, created.id)
    }
  }

  append(primary)
  for (const blueprint of blueprints) {
    if (blueprint.path.id === primary.path.id) continue
    append(blueprint)
  }

  unified.forEach((step, index) => {
    step.column_position = index + 1
  })

  return { steps: unified, alias }
}

export function mergeIntegratedBlueprint(
  blueprints: BlueprintData[],
  selectedPathIds: string[],
  options: { compare?: boolean } = {},
): IntegratedBlueprintData | null {
  if (blueprints.length === 0) return null

  const primary = pickPrimaryBlueprint(blueprints)
  const layers = [...primary.layers].sort(
    (a, b) => a.row_position - b.row_position,
  )
  const layerNameToId = new Map(layers.map((layer) => [layer.name, layer.id]))
  const comparing = Boolean(options.compare) && selectedPathIds.length >= 2
  const namedMerge = comparing
    ? mergeStepsByName(blueprints, primary)
    : null
  const steps = namedMerge?.steps ?? mergeSteps(blueprints, primary)
  const stepAlias = namedMerge?.alias ?? null

  const integratedStepIds = new Set(steps.map((step) => step.id))
  const integratedStepById = new Map(steps.map((step) => [step.id, step]))
  const cells: IntegratedBlueprintCell[] = []
  const cellIdByPathCell = new Map<string, string>()

  for (const blueprint of blueprints) {
    for (const cell of blueprint.cells) {
      const layer = blueprint.layers.find((entry) => entry.id === cell.layer_id)
      const resolvedStepId = remapDiscoverySadFinalStepId(
        cell.step_id,
        blueprint.path.id,
      )
      // Compare mode: the cell's own step id translates onto the unified
      // (name-aligned) column it belongs to.
      const aliasedStepId =
        stepAlias?.get(`${blueprint.path.id}:${resolvedStepId}`) ??
        resolvedStepId
      const step =
        integratedStepById.get(aliasedStepId) ??
        blueprint.steps.find((entry) => entry.id === resolvedStepId)
      if (!layer || !step) continue

      const integratedLayerId = layerNameToId.get(layer.name)
      if (!integratedLayerId || !integratedStepIds.has(step.id)) continue

      const integratedStep = integratedStepById.get(step.id)
      if (!integratedStep) continue

      const integratedCellId = `integrated-cell-${blueprint.path.id}-${cell.id}`
      cellIdByPathCell.set(`${blueprint.path.id}:${cell.id}`, integratedCellId)

      const mergedCell: IntegratedBlueprintCell = {
        id: integratedCellId,
        layer_id: integratedLayerId,
        step_id: step.id,
        path_id: blueprint.path.id,
        path_type: blueprint.path.path_type,
        content: cell.content,
        picture: cell.picture,
        description: cell.description,
        links: cell.links,
        opacity: pathOpacity(blueprint.path.id, selectedPathIds),
      }

      cells.push({
        ...mergedCell,
        opacity: getIntegratedCellDisplayOpacity(mergedCell, integratedStep),
      })
    }
  }

  /*
    Compare mode: classify slots, collapse the shared spine to one copy, and
    re-point every arrow that referenced a dropped duplicate onto the kept
    copy. That re-pointing is what the arrows are *for* here — an arrow
    leaving the shared spine into a path-colored band is the divergence,
    drawn as a vector.
  */
  let finalCells = cells
  let compareRemap: Map<string, string> | null = null
  if (comparing) {
    const classified = classifyCompareCells(
      cells,
      selectedPathIds,
      primary.path.id,
    )
    finalCells = classified.cells
    compareRemap = classified.remap
  }
  const compareByCellId = comparing
    ? new Map(finalCells.map((cell) => [cell.id, cell.compare]))
    : null

  const triggers: IntegratedBlueprintTrigger[] = []
  const seenTriggerEdges = new Set<string>()
  for (const blueprint of blueprints) {
    for (const trigger of blueprint.triggers) {
      let sourceCellId = cellIdByPathCell.get(
        `${blueprint.path.id}:${trigger.source_cell_id}`,
      )
      let targetCellId = cellIdByPathCell.get(
        `${blueprint.path.id}:${trigger.target_cell_id}`,
      )
      if (!sourceCellId || !targetCellId) continue
      if (compareRemap) {
        sourceCellId = compareRemap.get(sourceCellId) ?? sourceCellId
        targetCellId = compareRemap.get(targetCellId) ?? targetCellId
        if (!compareByCellId?.has(sourceCellId) || !compareByCellId.has(targetCellId)) {
          continue
        }
        // Two paths drawing the identical arrow between two shared cells is
        // one fact — draw it once.
        const edgeKey = `${sourceCellId}->${targetCellId}`
        if (seenTriggerEdges.has(edgeKey)) continue
        seenTriggerEdges.add(edgeKey)
      }

      const sourceCompare = compareByCellId?.get(sourceCellId)
      const targetCompare = compareByCellId?.get(targetCellId)
      const touchesDivergence =
        sourceCompare === 'divergent' ||
        sourceCompare === 'only' ||
        targetCompare === 'divergent' ||
        targetCompare === 'only'

      triggers.push({
        id: `integrated-trigger-${blueprint.path.id}-${trigger.id}`,
        source_cell_id: sourceCellId,
        target_cell_id: targetCellId,
        path_id: blueprint.path.id,
        path_type: blueprint.path.path_type,
        // In compare mode the arrows point out the divergence: full weight
        // where an arrow enters or leaves a band, receded along the spine.
        opacity: comparing
          ? touchesDivergence
            ? 1
            : 0.35
          : pathOpacity(blueprint.path.id, selectedPathIds),
      })
    }
  }

  return {
    paths: blueprints.map((blueprint) => ({
      id: blueprint.path.id,
      name: blueprint.path.name,
      description: blueprint.path.description,
      note: blueprint.path.note,
      path_type: blueprint.path.path_type,
    })),
    layers,
    steps,
    cells: finalCells,
    triggers,
  }
}

/** Per-path blueprint slices for shared compare row-height math on integrated grids. */
export function deriveSourceBlueprintsFromIntegrated(
  data: IntegratedBlueprintData,
): BlueprintData[] {
  return data.paths.map((path) => ({
    path: {
      id: path.id,
      name: path.name,
      description: path.description,
      note: path.note,
      path_type: path.path_type,
    },
    layers: data.layers,
    steps: data.steps
      .filter((step) => path.id in step.pathStepIds)
      .sort((a, b) => a.column_position - b.column_position)
      .map((step) => ({
        id: step.id,
        name: step.name,
        column_position: step.column_position,
      })),
    cells: data.cells
      .filter((cell) => cell.path_id === path.id)
      .map((cell) => ({
        id: cell.id,
        layer_id: cell.layer_id,
        step_id: cell.step_id,
        content: cell.content,
        picture: cell.picture,
        description: cell.description,
        links: cell.links,
      })),
    triggers: [],
  }))
}

/** Layout adapter for shared blueprint sizing helpers. */
export function integratedBlueprintToLayoutData(
  data: IntegratedBlueprintData,
): BlueprintData {
  return {
    path: {
      id: 'integrated',
      name: 'Integrated',
      description: null,
      note: null,
      path_type: 'happy',
    },
    layers: data.layers,
    steps: data.steps.map((step) => ({
      id: step.id,
      name: step.name,
      column_position: step.column_position,
    })),
    cells: data.cells.map((cell) => ({
      id: cell.id,
      layer_id: cell.layer_id,
      step_id: cell.step_id,
      content: cell.content,
      picture: cell.picture,
      description: cell.description,
      links: cell.links,
    })),
    triggers: data.triggers.map((trigger) => ({
      id: trigger.id,
      source_cell_id: trigger.source_cell_id,
      target_cell_id: trigger.target_cell_id,
    })),
  }
}

import type { BlueprintData } from '@/types/blueprint'
import {
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
  return (
    blueprints.find((blueprint) => blueprint.path.path_type === 'happy') ??
    blueprints[0]
  )
}

function mergeSteps(
  blueprints: BlueprintData[],
  primary: BlueprintData,
): IntegratedBlueprintStep[] {
  const integratedSteps: IntegratedBlueprintStep[] = []
  const seenNames = new Set<string>()

  const appendSteps = (blueprint: BlueprintData) => {
    for (const step of [...blueprint.steps].sort(
      (a, b) => a.column_position - b.column_position,
    )) {
      if (seenNames.has(step.name)) {
        const existing = integratedSteps.find(
          (integrated) => integrated.name === step.name,
        )
        if (existing) {
          existing.pathStepIds[blueprint.path.id] = step.id
        }
        continue
      }

      seenNames.add(step.name)
      integratedSteps.push({
        id: `integrated-step-${integratedSteps.length + 1}`,
        name: step.name,
        column_position: integratedSteps.length + 1,
        pathStepIds: { [blueprint.path.id]: step.id },
      })
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

export function mergeIntegratedBlueprint(
  blueprints: BlueprintData[],
  selectedPathIds: string[],
): IntegratedBlueprintData | null {
  if (blueprints.length === 0) return null

  const primary = pickPrimaryBlueprint(blueprints)
  const layers = [...primary.layers].sort(
    (a, b) => a.row_position - b.row_position,
  )
  const layerNameToId = new Map(layers.map((layer) => [layer.name, layer.id]))
  const steps = mergeSteps(blueprints, primary)

  const stepNameToId = new Map(steps.map((step) => [step.name, step.id]))
  const cells: IntegratedBlueprintCell[] = []
  const cellIdByPathCell = new Map<string, string>()

  for (const blueprint of blueprints) {
    for (const cell of blueprint.cells) {
      const layer = blueprint.layers.find((entry) => entry.id === cell.layer_id)
      const step = blueprint.steps.find((entry) => entry.id === cell.step_id)
      if (!layer || !step) continue

      const integratedLayerId = layerNameToId.get(layer.name)
      const integratedStepId = stepNameToId.get(step.name)
      if (!integratedLayerId || !integratedStepId) continue

      const integratedCellId = `integrated-cell-${blueprint.path.id}-${cell.id}`
      cellIdByPathCell.set(`${blueprint.path.id}:${cell.id}`, integratedCellId)

      cells.push({
        id: integratedCellId,
        layer_id: integratedLayerId,
        step_id: integratedStepId,
        path_id: blueprint.path.id,
        path_type: blueprint.path.path_type,
        content: cell.content,
        opacity: pathOpacity(blueprint.path.id, selectedPathIds),
      })
    }
  }

  const triggers: IntegratedBlueprintTrigger[] = []
  for (const blueprint of blueprints) {
    for (const trigger of blueprint.triggers) {
      const sourceCellId = cellIdByPathCell.get(
        `${blueprint.path.id}:${trigger.source_cell_id}`,
      )
      const targetCellId = cellIdByPathCell.get(
        `${blueprint.path.id}:${trigger.target_cell_id}`,
      )
      if (!sourceCellId || !targetCellId) continue

      triggers.push({
        id: `integrated-trigger-${blueprint.path.id}-${trigger.id}`,
        source_cell_id: sourceCellId,
        target_cell_id: targetCellId,
        path_id: blueprint.path.id,
        path_type: blueprint.path.path_type,
        opacity: pathOpacity(blueprint.path.id, selectedPathIds),
      })
    }
  }

  return {
    paths: blueprints.map((blueprint) => ({
      id: blueprint.path.id,
      name: blueprint.path.name,
      path_type: blueprint.path.path_type,
    })),
    layers,
    steps,
    cells,
    triggers,
  }
}

/** Layout adapter for shared blueprint sizing helpers. */
export function integratedBlueprintToLayoutData(
  data: IntegratedBlueprintData,
): BlueprintData {
  return {
    path: {
      id: 'integrated',
      name: 'Integrated',
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
    })),
    triggers: data.triggers.map((trigger) => ({
      id: trigger.id,
      source_cell_id: trigger.source_cell_id,
      target_cell_id: trigger.target_cell_id,
    })),
  }
}

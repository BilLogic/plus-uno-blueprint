import { GOAL_SETTING_SCENARIO_ID } from '@/data/goalSettingHappyPathFallback'

/** Iteration flags — flip when Visual rows and cell detail are ready to ship globally. */
export const BLUEPRINT_VISUAL_LAYER_UI_ENABLED = false
export const BLUEPRINT_CELL_DETAIL_UI_ENABLED = false
/** Visual walkthrough / presentation mode (play button + modal). */
export const BLUEPRINT_VISUAL_WALKTHROUGH_ENABLED = false

/** Scenarios where the Visual row is shown before global rollout. */
const BLUEPRINT_VISUAL_LAYER_SCENARIO_IDS = new Set<string>([
  GOAL_SETTING_SCENARIO_ID,
])

/** Scenarios where cell click → side panel is enabled before global rollout. */
const BLUEPRINT_CELL_DETAIL_SCENARIO_IDS = new Set<string>([
  GOAL_SETTING_SCENARIO_ID,
])

export function isBlueprintVisualLayerEnabled(
  scenarioId?: string | null,
): boolean {
  if (BLUEPRINT_VISUAL_LAYER_UI_ENABLED) return true
  if (!scenarioId) return false
  return BLUEPRINT_VISUAL_LAYER_SCENARIO_IDS.has(scenarioId)
}

export function isBlueprintCellDetailEnabled(
  scenarioId?: string | null,
): boolean {
  if (BLUEPRINT_CELL_DETAIL_UI_ENABLED) return true
  if (!scenarioId) return false
  return BLUEPRINT_CELL_DETAIL_SCENARIO_IDS.has(scenarioId)
}

export function isBlueprintVisualWalkthroughEnabled(): boolean {
  return BLUEPRINT_VISUAL_WALKTHROUGH_ENABLED
}

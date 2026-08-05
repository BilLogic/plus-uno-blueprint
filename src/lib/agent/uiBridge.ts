import { scrollBlueprintCellIntoView } from '@/lib/blueprintCellConnections'

/**
 * The agent's hands on the UI itself — camera and navigation, not data.
 * The shell registers the editor's navigation callbacks here so the tool
 * layer (plain functions, no React) can drive them when the user says
 * "take me to the Warm-Up scenario".
 *
 * Deliberately tiny: navigation only. Anything that *changes* data goes
 * through the write tools and the ledger; moving the camera is free.
 */
export type AgentUiBridge = {
  selectPhase: (phaseId: string) => void
  selectScenario: (scenarioId: string) => void
}

let bridge: AgentUiBridge | null = null

export function registerAgentUiBridge(next: AgentUiBridge): () => void {
  bridge = next
  return () => {
    if (bridge === next) bridge = null
  }
}

export function agentOpenPhase(phaseId: string): string {
  if (!bridge) return 'UI navigation is not available right now.'
  bridge.selectPhase(phaseId)
  return 'Opened the phase on the canvas.'
}

export function agentOpenScenario(scenarioId: string): string {
  if (!bridge) return 'UI navigation is not available right now.'
  bridge.selectScenario(scenarioId)
  return 'Opened the scenario on the canvas.'
}

export function agentFocusCell(cellId: string): string {
  // Works only when the cell is mounted on the current canvas — the tool
  // description tells the model to open the scenario first.
  scrollBlueprintCellIntoView(cellId)
  return 'Scrolled the canvas to the cell (it must be on the open scenario to be visible).'
}

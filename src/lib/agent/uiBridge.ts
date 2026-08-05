import { getSharedCanvasMode } from '@/contexts/canvasModeContext'
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
  /** Open the ✦ sidebar surface (used by "Send to the agent" hand-offs). */
  openAgentSurface: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
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

export function openAgentSurface(): boolean {
  if (!bridge) return false
  bridge.openAgentSurface()
  return true
}

export function agentFocusCell(cellId: string): string {
  // Works only when the cell is mounted on the current canvas — the tool
  // description tells the model to open the scenario first.
  scrollBlueprintCellIntoView(cellId)
  return 'Scrolled the canvas to the cell (it must be on the open scenario to be visible).'
}

export function agentSetSidebar(collapsed: boolean): string {
  if (!bridge) return 'UI control is not available right now.'
  bridge.setSidebarCollapsed(collapsed)
  return collapsed ? 'Sidebar collapsed.' : 'Sidebar expanded.'
}

/**
 * Open the cell detail panel by driving the SAME gesture the human uses:
 * a click on the rendered cell (double-click in Design mode, where a
 * plain click gathers instead). No parallel code path to drift — if the
 * UI can open it, this can; if the cell isn't interactive (wrong view
 * level), neither can the human, and the message says what to do.
 */
export function agentOpenCellPanel(cellId: string): string {
  const el = document.querySelector<HTMLElement>(
    `[data-blueprint-cell="${cellId}"][data-blueprint-cell-interactive]`,
  )
  if (!el)
    return 'That cell is not clickable on the current canvas — open its scenario first (open_scenario), then retry.'
  scrollBlueprintCellIntoView(cellId)
  if (getSharedCanvasMode() === 'design') {
    el.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, cancelable: true }),
    )
  } else {
    el.click()
  }
  return 'Opened the cell detail panel.'
}

// The annotator lives with the annotation provider (it owns stroke state
// and colors); registered like the nav bridge.
type AgentAnnotator = (cellIds: string[], note?: string) => string

let annotator: AgentAnnotator | null = null

export function registerAgentAnnotator(next: AgentAnnotator): () => void {
  annotator = next
  return () => {
    if (annotator === next) annotator = null
  }
}

export function agentAnnotateCells(cellIds: string[], note?: string): string {
  if (!annotator)
    return 'No annotatable canvas is open right now — open a scenario first.'
  return annotator(cellIds, note)
}

// ---------------------------------------------------------------------------
// UI context — the read side of the bridge. Scattered surfaces (shell,
// canvas viewport, cell panel, design-mode picker) each register a
// contributor that describes their live state in a line or two; the agent
// panel and the get_ui_state tool collect them all. Same shape as the
// navigation bridge: module registry, so the tool layer needs no React.
// ---------------------------------------------------------------------------

type UiContextContributor = () => string | null

const contributors = new Map<string, UiContextContributor>()

export function registerAgentUiContext(
  key: string,
  contributor: UiContextContributor,
): () => void {
  contributors.set(key, contributor)
  return () => {
    if (contributors.get(key) === contributor) contributors.delete(key)
  }
}

/** All registered contributors' lines, empty string when nothing reports. */
export function collectAgentUiContext(): string {
  const lines: string[] = []
  for (const contributor of contributors.values()) {
    try {
      const line = contributor()
      if (line) lines.push(line)
    } catch {
      // A broken contributor should never take the send down with it.
    }
  }
  return lines.join('\n')
}

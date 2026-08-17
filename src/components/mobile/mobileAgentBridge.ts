import type { AgentUiBridge } from '@/lib/agent/uiBridge'

export type MobileSurface = 'reader' | 'map'

/**
 * The agent's navigation hands on mobile, pure and in a leaf module so the
 * four handlers can be pinned by a node unit test without dragging the
 * shell's `?raw` import graph in: scenario opens land in the reader (the
 * phone's reading surface), phase opens land on the map, and the ✦ sheet is
 * the agent surface. The sidebar tool has no sidebar to drive here — the
 * stub is a known dishonesty (`agentSetSidebar` still claims success; see
 * todo 027) scheduled for the Phase-3 bridge rework.
 */
export function makeMobileAgentBridge({
  selectPhase,
  selectScenario,
  setSurface,
  openAgent,
}: {
  selectPhase: (phaseId: string) => void
  selectScenario: (scenarioId: string) => void
  setSurface: (surface: MobileSurface) => void
  openAgent: () => void
}): AgentUiBridge {
  return {
    selectPhase: (phaseId) => {
      selectPhase(phaseId)
      setSurface('map')
    },
    selectScenario: (scenarioId) => {
      selectScenario(scenarioId)
      setSurface('reader')
    },
    openAgentSurface: openAgent,
    setSidebarCollapsed: () => {},
  }
}

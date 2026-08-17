import { describe, expect, it, vi } from 'vitest'
import { makeMobileAgentBridge } from '@/components/mobile/mobileAgentBridge'
import { resolveBootSlice } from '@/hooks/useMobileSliceDeepLink'

// Pins the agent bridge's handlers: the phone shows ONE surface (the shared
// canvas, decided 2026-08-17), so phase and scenario opens are plain
// selections — the camera move IS the surface change. No setSurface hand
// exists anymore; this test pins that simplification.
describe('makeMobileAgentBridge', () => {
  function harness() {
    const selectPhase = vi.fn()
    const selectScenario = vi.fn()
    const openAgent = vi.fn()
    const bridge = makeMobileAgentBridge({
      selectPhase,
      selectScenario,
      openAgent,
    })
    return { bridge, selectPhase, selectScenario, openAgent }
  }

  it('phase opens select the phase and nothing else', () => {
    const h = harness()
    h.bridge.selectPhase('phase-1')
    expect(h.selectPhase).toHaveBeenCalledWith('phase-1')
    expect(h.selectScenario).not.toHaveBeenCalled()
    expect(h.openAgent).not.toHaveBeenCalled()
  })

  it('scenario opens select the scenario and nothing else', () => {
    const h = harness()
    h.bridge.selectScenario('scen-1')
    expect(h.selectScenario).toHaveBeenCalledWith('scen-1')
    expect(h.selectPhase).not.toHaveBeenCalled()
    expect(h.openAgent).not.toHaveBeenCalled()
  })

  it('openAgentSurface opens the agent and touches nothing else', () => {
    const h = harness()
    h.bridge.openAgentSurface()
    expect(h.openAgent).toHaveBeenCalledTimes(1)
    expect(h.selectPhase).not.toHaveBeenCalled()
    expect(h.selectScenario).not.toHaveBeenCalled()
  })

  it('setSidebarCollapsed reports honestly that no sidebar exists (todo 027)', () => {
    const h = harness()
    const result = h.bridge.setSidebarCollapsed(true)
    expect(typeof result).toBe('string')
    expect(result).toMatch(/no sidebar/)
    expect(h.selectPhase).not.toHaveBeenCalled()
  })
})

// Pins the ?slice= boot decision (todo 025 documents the known
// derived-from-query defect; Phase 4 replaces the mechanism, and these
// cases state what must stay true across that replacement).
describe('resolveBootSlice', () => {
  const base = {
    bootSliceId: 'abc',
    bootSliceDismissed: false,
    presentingSliceId: null,
    sliceIds: ['abc', 'def'],
  }

  it('presents the boot slice when it exists and nothing else presents', () => {
    expect(resolveBootSlice(base)).toBe('abc')
  })

  it('never presents after dismissal', () => {
    expect(resolveBootSlice({ ...base, bootSliceDismissed: true })).toBeNull()
  })

  it('defers to an explicit user presentation', () => {
    expect(resolveBootSlice({ ...base, presentingSliceId: 'def' })).toBeNull()
  })

  it('a dead link presents nothing (falls back to the reader)', () => {
    expect(resolveBootSlice({ ...base, sliceIds: ['def'] })).toBeNull()
  })

  it('no boot link, no presentation', () => {
    expect(resolveBootSlice({ ...base, bootSliceId: null })).toBeNull()
  })

  it('presents nothing while the slice list is still empty', () => {
    expect(resolveBootSlice({ ...base, sliceIds: [] })).toBeNull()
  })
})

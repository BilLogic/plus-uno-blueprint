import { describe, expect, it, vi } from 'vitest'
import { makeMobileAgentBridge } from '@/components/mobile/mobileAgentBridge'
import { resolveBootSlice } from '@/hooks/useMobileSliceDeepLink'

// Pins the agent bridge's four handlers (plan 2026-08-16-002 Phase 2): the
// composition — which navigation lands on which surface — is exactly the
// behaviour the Phase-3 redesign must consciously change, not drift.
describe('makeMobileAgentBridge', () => {
  function harness() {
    const selectPhase = vi.fn()
    const selectScenario = vi.fn()
    const setSurface = vi.fn()
    const openAgent = vi.fn()
    const bridge = makeMobileAgentBridge({
      selectPhase,
      selectScenario,
      setSurface,
      openAgent,
    })
    return { bridge, selectPhase, selectScenario, setSurface, openAgent }
  }

  it('phase opens land on the map', () => {
    const h = harness()
    h.bridge.selectPhase('phase-1')
    expect(h.selectPhase).toHaveBeenCalledWith('phase-1')
    expect(h.setSurface).toHaveBeenCalledWith('map')
    expect(h.selectScenario).not.toHaveBeenCalled()
  })

  it('scenario opens land in the reader', () => {
    const h = harness()
    h.bridge.selectScenario('scen-1')
    expect(h.selectScenario).toHaveBeenCalledWith('scen-1')
    expect(h.setSurface).toHaveBeenCalledWith('reader')
    expect(h.selectPhase).not.toHaveBeenCalled()
  })

  it('openAgentSurface opens the agent and touches nothing else', () => {
    const h = harness()
    h.bridge.openAgentSurface()
    expect(h.openAgent).toHaveBeenCalledTimes(1)
    expect(h.setSurface).not.toHaveBeenCalled()
    expect(h.selectPhase).not.toHaveBeenCalled()
    expect(h.selectScenario).not.toHaveBeenCalled()
  })

  it('setSidebarCollapsed exists and is a no-op (known dishonesty, todo 027)', () => {
    const h = harness()
    expect(() => h.bridge.setSidebarCollapsed(true)).not.toThrow()
    expect(h.setSurface).not.toHaveBeenCalled()
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

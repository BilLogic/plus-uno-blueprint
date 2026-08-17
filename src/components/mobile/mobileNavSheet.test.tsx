// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MobileNavSheet } from '@/components/mobile/MobileNavSheet'
import type { NavItem } from '@/types/nav'
import type { Slice } from '@/types/database'

// Render tests for the nav sheet (plan 2026-08-16-002 Phase 2): the sheet
// only reports what was tapped — slice, phase, or scenario — and the pinned
// contract is that each row calls exactly its own callback. The shell owns
// what a tap means for the visible surface.

const nav = (over: Partial<NavItem> & { id: string; label: string }): NavItem =>
  ({
    parentId: null,
    index: 0,
    description: '',
    ...over,
  }) as NavItem

const phases = [
  nav({ id: 'ph-1', label: 'Application', index: 1 }),
  nav({ id: 'ph-2', label: 'Onboarding', index: 2 }),
]
const scenarios = [
  nav({ id: 'sc-1', label: 'Discovery', parentId: 'ph-1' }),
  nav({ id: 'sc-2', label: 'Tech Setup', parentId: 'ph-2' }),
]
const slides = [...phases, ...scenarios]
const scenariosByPhase = new Map<string, NavItem[]>([
  ['ph-1', [scenarios[0]]],
  ['ph-2', [scenarios[1]]],
])
const slices = [{ id: 'sl-1', title: 'Regular Tutor lane: warm-up' } as Slice]

function renderSheet(over: Partial<Parameters<typeof MobileNavSheet>[0]> = {}) {
  const onSelectSlice = vi.fn()
  const onSelectPhase = vi.fn()
  const onSelectScenario = vi.fn()
  render(
    <MobileNavSheet
      open
      onOpenChange={() => {}}
      slices={slices}
      phases={phases}
      scenariosByPhase={scenariosByPhase}
      slides={slides}
      selectedPhaseId={null}
      selectedScenarioId={null}
      onSelectSlice={onSelectSlice}
      onSelectPhase={onSelectPhase}
      onSelectScenario={onSelectScenario}
      {...over}
    />,
  )
  return { onSelectSlice, onSelectPhase, onSelectScenario }
}

afterEach(cleanup)

describe('MobileNavSheet routing', () => {
  it('a slice row reports the slice and only the slice', () => {
    const h = renderSheet()
    screen.getByText('Regular Tutor lane: warm-up').click()
    expect(h.onSelectSlice).toHaveBeenCalledWith('sl-1')
    expect(h.onSelectPhase).not.toHaveBeenCalled()
    expect(h.onSelectScenario).not.toHaveBeenCalled()
  })

  it('a phase row reports the phase and only the phase', () => {
    const h = renderSheet()
    screen.getByText(/Application/).click()
    expect(h.onSelectPhase).toHaveBeenCalledWith('ph-1')
    expect(h.onSelectScenario).not.toHaveBeenCalled()
    expect(h.onSelectSlice).not.toHaveBeenCalled()
  })

  it('a scenario row reports the scenario and only the scenario', () => {
    const h = renderSheet()
    screen.getByText('Discovery').click()
    expect(h.onSelectScenario).toHaveBeenCalledWith('sc-1')
    expect(h.onSelectPhase).not.toHaveBeenCalled()
    expect(h.onSelectSlice).not.toHaveBeenCalled()
  })

  it('marks the selected scenario with aria-current', () => {
    renderSheet({ selectedScenarioId: 'sc-2' })
    const row = screen.getByText('Tech Setup').closest('button')
    expect(row?.getAttribute('aria-current')).toBe('true')
  })

  it('marks the selected phase only while no scenario is selected', () => {
    renderSheet({ selectedPhaseId: 'ph-1', selectedScenarioId: 'sc-1' })
    const phaseRow = screen.getByText(/Application/).closest('button')
    expect(phaseRow?.getAttribute('aria-current')).toBeNull()
  })
})

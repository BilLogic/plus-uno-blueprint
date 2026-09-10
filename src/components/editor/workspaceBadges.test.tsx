// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { WorkspaceBadges } from '@/components/editor/EditorChrome'
import { SupabaseProvider } from '@/contexts/SupabaseProvider'
import { setDevSimulatedTier, setDevSimulation, SIMULATION_OFF } from '@/lib/devPortal'

/**
 * The simulated tier is told on in the badge row, not only in the popover
 * that sets it.
 *
 * `devPortal.test.tsx` pins the badge component itself; this pins that the
 * shell MOUNTS it, beside the authoring and edit-preview badges. A portal
 * whose only tell is the settings section it was switched on from is a
 * session that looks like the reader's own account everywhere they actually
 * work.
 */

beforeEach(() => {
  window.localStorage.clear()
  act(() => setDevSimulation(SIMULATION_OFF))
})

afterEach(cleanup)

function renderBadges() {
  render(
    <SupabaseProvider>
      <WorkspaceBadges />
    </SupabaseProvider>,
  )
}

test('the badge row is empty for an ordinary session', () => {
  renderBadges()
  expect(document.querySelector('[data-dev-tier-badge]')).toBeNull()
})

test('the badge row names the simulated tier while the simulation is on', () => {
  act(() => setDevSimulatedTier('regular'))
  renderBadges()
  expect(screen.getByText('simulating regular')).toBeTruthy()
  expect(document.querySelector('[data-dev-tier-badge="regular"]')).not.toBeNull()
})

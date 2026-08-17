// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MobileTopBar } from '@/components/mobile/MobileTopBar'

// Pins the read-only-tier rule from the canvas contract: viewers get no
// agent affordance anywhere in the chrome (plan 2026-08-16-002 Phase 2).

afterEach(cleanup)

describe('MobileTopBar', () => {
  it('hides the agent button entirely when the session cannot run the agent', () => {
    render(
      <MobileTopBar
        title="Warm-Up"
        canAgent={false}
        onOpenNav={() => {}}
        onOpenAgent={() => {}}
      />,
    )
    expect(screen.queryByLabelText('Ask the agent')).toBeNull()
  })

  it('shows the agent button for agent-capable sessions and wires it', () => {
    const onOpenAgent = vi.fn()
    render(
      <MobileTopBar
        title="Warm-Up"
        canAgent
        onOpenNav={() => {}}
        onOpenAgent={onOpenAgent}
      />,
    )
    screen.getByLabelText('Ask the agent').click()
    expect(onOpenAgent).toHaveBeenCalledTimes(1)
  })

  it('opens navigation from the menu button and shows the title', () => {
    const onOpenNav = vi.fn()
    render(
      <MobileTopBar
        title="Standard Scheduling"
        canAgent={false}
        onOpenNav={onOpenNav}
        onOpenAgent={() => {}}
      />,
    )
    screen.getByLabelText('Open navigation').click()
    expect(onOpenNav).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Standard Scheduling')).toBeDefined()
  })
})

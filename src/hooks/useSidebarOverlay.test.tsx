// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MOBILE_SHELL_QUERY } from '@/hooks/useMobileShell'
import {
  SIDEBAR_OVERLAY_BREAKPOINT,
  SIDEBAR_OVERLAY_QUERY,
  collapseSidebarByUser,
  reconcileSidebarCollapse,
  useSidebarCollapse,
  type SidebarCollapse,
} from '@/hooks/useSidebarOverlay'

// Pins issue #132: below the gate the sidebar collapses and reopening it
// overlays the canvas. The half that is easy to get wrong is the way back up
// — a collapse the gate imposed must be given back, and a collapse the reader
// asked for must not be, and a boolean alone cannot tell those apart.

afterEach(cleanup)

/**
 * A resizable window. jsdom's own `matchMedia` never re-evaluates, so the
 * only way to test a crossing is to own the query evaluation here.
 */
type MediaListener = (event: { matches: boolean }) => void

function fakeViewport(width: number) {
  const live: { query: string; matches: boolean; listeners: Set<MediaListener> }[] =
    []
  const evaluate = (query: string) => {
    const max = /\(max-width:\s*(\d+)px\)/.exec(query)
    if (!max) throw new Error(`the fake viewport only speaks max-width: ${query}`)
    return width <= Number(max[1])
  }
  window.matchMedia = ((query: string) => {
    const entry = {
      query,
      matches: evaluate(query),
      listeners: new Set<MediaListener>(),
    }
    live.push(entry)
    return {
      media: query,
      get matches() {
        return evaluate(query)
      },
      addEventListener: (_: string, fn: MediaListener) => entry.listeners.add(fn),
      removeEventListener: (_: string, fn: MediaListener) =>
        entry.listeners.delete(fn),
    }
  }) as unknown as typeof window.matchMedia
  return {
    resizeTo(next: number) {
      act(() => {
        width = next
        for (const entry of live) {
          const matches = evaluate(entry.query)
          if (matches === entry.matches) continue
          entry.matches = matches
          entry.listeners.forEach((fn) => fn({ matches }))
        }
      })
    },
  }
}

/**
 * The shell's own wiring, called rather than re-implemented.
 *
 * This used to copy the three lines `DesktopEditorShell` composes, which left
 * the copy free to stay green while the shell drifted away from it. They are
 * one `useSidebarCollapse` now, so what runs here is what runs there.
 *
 * Rendering the real shell is still out of reach — it would need every
 * provider in the app to prove a fact about two numbers and a reducer — so
 * the hook gets a button for a body. StrictMode is deliberate: the
 * render-phase reconcile has to survive a double-invoked render without
 * laundering the gate's own collapse into the reader's.
 */
function Shell() {
  const { collapsed, setCollapsedByUser } = useSidebarCollapse()
  return (
    <button onClick={() => setCollapsedByUser(!collapsed)}>
      {collapsed ? 'collapsed' : 'expanded'}
    </button>
  )
}

function sidebarState() {
  return screen.getByRole('button').textContent
}

describe('the overlay gate itself', () => {
  it('sits above the mobile gate, so the band between them is non-empty', () => {
    const mobileMax = /\(max-width:\s*(\d+)px\)/.exec(MOBILE_SHELL_QUERY)
    expect(mobileMax).not.toBeNull()
    // [768, 900): the floor is the mobile gate's, because below it the
    // desktop shell does not render at all.
    expect(SIDEBAR_OVERLAY_BREAKPOINT).toBeGreaterThan(Number(mobileMax![1]) + 1)
  })

  it('is one-sided, so there is no min-width half to drift out of step', () => {
    expect(SIDEBAR_OVERLAY_QUERY).toBe(`(max-width: ${SIDEBAR_OVERLAY_BREAKPOINT - 1}px)`)
    expect(SIDEBAR_OVERLAY_QUERY).not.toMatch(/min-width/)
  })
})

describe('crossing the gate', () => {
  it('collapses on the way down and restores on the way back up', () => {
    const viewport = fakeViewport(1200)
    render(
      <StrictMode>
        <Shell />
      </StrictMode>,
    )
    expect(sidebarState()).toBe('expanded')

    viewport.resizeTo(SIDEBAR_OVERLAY_BREAKPOINT - 1)
    expect(sidebarState()).toBe('collapsed')

    viewport.resizeTo(1200)
    expect(sidebarState()).toBe('expanded')
  })

  it('leaves a collapse the reader asked for collapsed when the window widens', () => {
    const viewport = fakeViewport(1200)
    render(
      <StrictMode>
        <Shell />
      </StrictMode>,
    )
    act(() => screen.getByRole('button').click())
    expect(sidebarState()).toBe('collapsed')

    // Down and back up: the gate had nothing to take, so it gives nothing back.
    viewport.resizeTo(SIDEBAR_OVERLAY_BREAKPOINT - 1)
    expect(sidebarState()).toBe('collapsed')
    viewport.resizeTo(1200)
    expect(sidebarState()).toBe('collapsed')
  })

  it('does not reopen one the reader shut while narrow, overlay and all', () => {
    const viewport = fakeViewport(SIDEBAR_OVERLAY_BREAKPOINT - 1)
    render(
      <StrictMode>
        <Shell />
      </StrictMode>,
    )
    // Booting inside the band starts collapsed — the gate's doing.
    expect(sidebarState()).toBe('collapsed')

    // Reopened as an overlay, then shut again: that second collapse is the
    // reader's, and it must outlive the widening.
    act(() => screen.getByRole('button').click())
    expect(sidebarState()).toBe('expanded')
    act(() => screen.getByRole('button').click())
    viewport.resizeTo(1200)
    expect(sidebarState()).toBe('collapsed')
  })

  it('keeps an overlay the reader opened open once there is room for it', () => {
    const viewport = fakeViewport(SIDEBAR_OVERLAY_BREAKPOINT - 1)
    render(
      <StrictMode>
        <Shell />
      </StrictMode>,
    )
    act(() => screen.getByRole('button').click())
    viewport.resizeTo(1200)
    expect(sidebarState()).toBe('expanded')
  })
})

describe('reconcileSidebarCollapse', () => {
  const expanded: SidebarCollapse = { collapsed: false, auto: false, narrow: false }

  it('marks the collapse as its own on the way down', () => {
    expect(reconcileSidebarCollapse(expanded, true)).toEqual({
      collapsed: true,
      auto: true,
      narrow: true,
    })
  })

  it('claims nothing it did not do', () => {
    const shutByReader: SidebarCollapse = { collapsed: true, auto: false, narrow: false }
    expect(reconcileSidebarCollapse(shutByReader, true).auto).toBe(false)
  })

  it('is identity on the side it is already on', () => {
    // The guard that keeps a replayed render — StrictMode, a re-render on any
    // other state — from reading a fresh auto-collapse as a pre-existing one.
    const collapsed = reconcileSidebarCollapse(expanded, true)
    expect(reconcileSidebarCollapse(collapsed, true)).toBe(collapsed)
  })

  it('drops its claim on the way up whether or not it had one', () => {
    const collapsed = reconcileSidebarCollapse(expanded, true)
    expect(reconcileSidebarCollapse(collapsed, false)).toEqual(expanded)
    const shutByReader: SidebarCollapse = { collapsed: true, auto: false, narrow: true }
    expect(reconcileSidebarCollapse(shutByReader, false)).toEqual({
      collapsed: true,
      auto: false,
      narrow: false,
    })
  })
})

describe('collapseSidebarByUser', () => {
  it('clears the gate’s claim, so the next widening leaves the state alone', () => {
    const autoCollapsed: SidebarCollapse = { collapsed: true, auto: true, narrow: true }
    expect(collapseSidebarByUser(autoCollapsed, true).auto).toBe(false)
    expect(collapseSidebarByUser(autoCollapsed, false)).toEqual({
      collapsed: false,
      auto: false,
      narrow: true,
    })
  })
})

describe('Escape, which is what the missing scrim has to buy', () => {
  it('shuts the overlay from anywhere, since focus is usually out on the canvas', () => {
    const viewport = fakeViewport(SIDEBAR_OVERLAY_BREAKPOINT)
    render(
      <StrictMode>
        <Shell />
      </StrictMode>,
    )
    expect(sidebarState()).toBe('expanded')

    // Below the gate and reopened by the reader — the overlay posture, drawn
    // over the canvas with nothing to click outside it.
    act(() => viewport.resizeTo(SIDEBAR_OVERLAY_BREAKPOINT - 1))
    fireEvent.click(screen.getByRole('button'))
    expect(sidebarState()).toBe('expanded')

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(sidebarState()).toBe('collapsed')
  })

  it('leaves a sidebar in the flow alone, and leaves a handled Escape alone', () => {
    const viewport = fakeViewport(SIDEBAR_OVERLAY_BREAKPOINT)
    render(
      <StrictMode>
        <Shell />
      </StrictMode>,
    )

    // Above the gate the sidebar is a column, not a panel over anything.
    // Closing it on Escape would rearrange the page for no reason.
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(sidebarState()).toBe('expanded')

    // Below the gate, an Escape something else already answered is not ours
    // to take — a dialog or an inline editor closes, the panel stays.
    act(() => viewport.resizeTo(SIDEBAR_OVERLAY_BREAKPOINT - 1))
    fireEvent.click(screen.getByRole('button'))
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
      event.preventDefault()
      document.dispatchEvent(event)
    })
    expect(sidebarState()).toBe('expanded')
  })
})

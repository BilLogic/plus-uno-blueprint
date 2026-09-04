// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CoverFigure } from '@/components/cover/CoverFigure'

// Pins the lightbox contract: no separate close button (everything closes it
// on click), a plain pointer cursor on the thumbnail (the corner hint is the
// only "this expands" signal), and — crucially — NO further zoom step on the
// opened figure. The opened image is fit-to-viewport and inert to clicks, so a
// click anywhere, the diagram included, reaches the close catcher beneath.

afterEach(cleanup)

const figure = {
  src: '/cover/example.svg',
  alt: 'An example diagram',
  width: 880,
  height: 400,
}

describe('CoverFigure', () => {
  it('opens on a plain pointer, not a zoom cursor — the corner hint is the only expand signal', () => {
    render(<CoverFigure figure={figure} />)
    const trigger = screen.getByRole('button', { name: 'Expand: An example diagram' })
    expect(trigger.className).toContain('cursor-pointer')
    expect(trigger.className).not.toContain('cursor-zoom-in')
  })

  it('opens the popup with no visible, focusable close button', () => {
    render(<CoverFigure figure={figure} />)
    fireEvent.click(screen.getByRole('button', { name: 'Expand: An example diagram' }))
    expect(screen.getByRole('dialog')).toBeDefined()
    /*
      The invisible full-bleed close catcher is still a `button` by role —
      that is how any click outside the diagram closes the popup — but it is
      `tabIndex={-1}` and carries no visible chrome. This asserts the absence
      of a FOCUSABLE, visible close control, not the absence of the catcher.
    */
    const closeButtons = screen.getAllByRole('button', { name: 'Close' })
    expect(closeButtons).toHaveLength(1)
    expect(closeButtons[0]?.getAttribute('tabIndex')).toBe('-1')
  })

  it('the opened figure is fit-to-viewport and inert — no second zoom step', () => {
    render(<CoverFigure figure={figure} />)
    fireEvent.click(screen.getByRole('button', { name: 'Expand: An example diagram' }))

    const opened = within(screen.getByRole('dialog')).getByRole('img', {
      name: 'An example diagram',
    })
    // Fits the viewport, ignores clicks (so a click reaches the close catcher
    // beneath it), and offers no zoom affordance of its own.
    expect(opened.className).toContain('pointer-events-none')
    expect(opened.className).toContain('max-h-full')
    expect(opened.className).not.toContain('cursor-zoom-in')
    expect(opened.className).not.toContain('cursor-zoom-out')
    // The removed second step: no "view at full size" / "shrink to fit" control.
    expect(screen.queryByRole('img', { name: 'View at full size' })).toBeNull()
    expect(screen.queryByRole('img', { name: 'Shrink to fit' })).toBeNull()
  })

  it('reopens cleanly after closing', () => {
    render(<CoverFigure figure={figure} />)
    fireEvent.click(screen.getByRole('button', { name: 'Expand: An example diagram' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Expand: An example diagram' }))
    expect(screen.getByRole('dialog')).toBeDefined()
  })
})

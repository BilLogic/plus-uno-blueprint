// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BlueprintTouchpointCell } from '@/components/blueprint/BlueprintTouchpointCell'

afterEach(cleanup)

/** #277 — a name-only placement is the same face, dashed. */
describe('BlueprintTouchpointCell', () => {
  it('draws a name-only placement dashed and says so in the DOM', () => {
    const { container } = render(
      <BlueprintTouchpointCell item="Handshake Employer Profile" nameOnly asSpan />,
    )
    const face = container.querySelector('[data-name-only]')
    expect(face).not.toBeNull()
    expect(face!.className).toContain('border-dashed')
    expect(face!.textContent).toContain('Handshake Employer Profile')
  })

  it('draws a linked placement plainly', () => {
    const { container } = render(<BlueprintTouchpointCell item="Handshake" asSpan />)
    expect(container.querySelector('[data-name-only]')).toBeNull()
    expect(container.querySelector('span')!.className).not.toContain('border-dashed')
  })

  // The button branch used to spread `data-name-only` onto `BlueprintCellButton`,
  // and a JSX spread is not excess-property checked: the attribute was dropped
  // on the floor, so only the read-only face ever carried the marker. `nameOnly`
  // is a declared prop now, and this is what says the attribute lands (#325 S6).
  it('says so in the DOM on the interactive branch too', () => {
    const { container } = render(
      <BlueprintTouchpointCell item="Handshake Employer Profile" nameOnly />,
    )
    const button = container.querySelector('button[data-name-only]')
    expect(button).not.toBeNull()
    expect(button!.className).toContain('border-dashed')
  })
})

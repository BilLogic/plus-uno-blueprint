// @vitest-environment jsdom
/**
 * Panel consistency and de-brand (#307).
 *
 * Two claims a reader can check:
 *
 *   - the Status field explains itself the way Summary does — a hint that
 *     discloses on hover, not a bare label sitting mute beside a neighbour
 *     that has one. Asserted by rendering `CellContentSection` and hovering
 *     the label.
 *   - the files this ticket touched carry no `PLUS` reference, so the shared
 *     template ships clean. Read as TEXT, because it is a claim about the whole
 *     source of each file. Prior art for the source-reading half:
 *     `stakeholderDefinitionReader.test.ts`.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/contexts/SupabaseProvider', () => ({
  useSupabase: () => ({ client: {}, configured: true }),
}))
vi.mock('@/hooks/useBlueprintCell', () => ({
  useBlueprintCell: () => ({
    status: 'live',
    owner: null,
    perceived_owner: null,
  }),
}))

import { CellContentSection } from '@/components/blueprint/CellContentSection'

afterEach(cleanup)

/**
 * Hover, as Base UI actually learns it — pointerover carrying `pointerType`,
 * then mouseenter and mousemove. The same sequence `definitionCard.test.tsx`
 * uses, and for the same reason: jsdom has no `PointerEvent`.
 */
function hover(element: Element) {
  const trigger =
    element.closest('[tabindex], [role="button"], button') ?? element
  const pointerOver = new MouseEvent('pointerover', {
    bubbles: true,
    cancelable: true,
  })
  Object.defineProperty(pointerOver, 'pointerType', { value: 'mouse' })
  trigger.dispatchEvent(pointerOver)
  fireEvent.mouseEnter(trigger)
  fireEvent.mouseMove(trigger)
}

describe('the Status field carries a hint like Summary', () => {
  it('discloses what Status means on hover, and reads as a plain label', async () => {
    render(<CellContentSection cellId="cell-1" />)
    const label = screen.getByText('Status')
    // A plain field label, not a badge caption.
    expect(label.hasAttribute('data-panel-term-badge')).toBe(false)
    hover(label)
    expect(
      await screen.findByText('How far along the thing this cell describes is.'),
    ).not.toBeNull()
  })
})

describe('no PLUS reference ships in the files #307 touched', () => {
  // Scoped to THIS ticket's files: the workspace title and the wider template
  // de-brand are other #301 tickets, and the data/config files that still name
  // PLUS are theirs, not this one's.
  const TOUCHED = [
    'src/lib/panelTerms.ts',
    'src/components/blueprint/BlueprintCellDetailPanel.tsx',
    'src/components/blueprint/StepPanel.tsx',
    'src/components/blueprint/CellContentSection.tsx',
    'src/components/editor/PathSelectorMenu.tsx',
  ]

  // Case-sensitive: the brand is always the token `PLUS`. Lowercase `plus` is
  // ordinary English — "the main way, plus variants and exceptions" — and must
  // not trip the check.
  it.each(TOUCHED)('%s names no PLUS', (path) => {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8')
    expect(source).not.toMatch(/PLUS/)
  })
})

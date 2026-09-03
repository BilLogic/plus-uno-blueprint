// @vitest-environment jsdom
/**
 * The cover's Services tab (#336, #303).
 *
 * Two services turn the singular "The service" tab into a "Services" tab that
 * heads its panel with the service selector; picking one makes that service
 * active. One service (or none) leaves the tab exactly as it was — singular
 * label, no selector row. Driven through `CoverPageView`, the provider-free
 * surface the cover's other tests drive, with the roster handed in as props.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CoverPageView } from '@/components/cover/CoverPage'
import type { CoverContent } from '@/components/cover/coverModel'
import type { ActiveService } from '@/contexts/ActiveServiceContext'

beforeAll(() => {
  // jsdom has no ResizeObserver; the cover strip's indicator effect needs one.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(cleanup)

const content: CoverContent = {
  title: 'Test Workspace',
  lede: 'A lede.',
  primaryCtaLabel: 'Open the blueprint',
  commandCopy: { copyLabel: 'Copy', copiedLabel: 'Copied' },
  states: { noSlices: 'No slices yet.' },
  tabs: [
    {
      value: 'the-service',
      label: 'The service',
      services: { pluralLabel: 'Services' },
      sections: [
        {
          kind: 'prose',
          id: 's1',
          heading: 'A service',
          paragraphs: ['Body.'],
        },
      ],
    },
    {
      value: 'overview',
      label: 'Overview',
      sections: [
        { kind: 'prose', id: 's2', heading: 'Overview', paragraphs: ['Body.'] },
      ],
    },
  ],
}

const TWO: ActiveService[] = [
  { id: 'svc-a', name: 'PLUS Tutoring', slug: 'plus-tutoring' },
  { id: 'svc-b', name: 'Support Desk', slug: 'support-desk' },
]

/** The selector row, told apart from the cover's own tab strip by its label. */
const selectorRow = () => screen.queryByRole('tablist', { name: 'Services' })

describe('with one service, the tab is its singular self', () => {
  it('reads "The service" and shows no selector row', () => {
    render(
      <CoverPageView
        content={content}
        onOpenCanvas={() => {}}
        services={[TWO[0]]}
        activeServiceSlug="plus-tutoring"
      />,
    )
    expect(screen.getByRole('tab', { name: 'The service' })).toBeDefined()
    expect(screen.queryByRole('tab', { name: 'Services' })).toBeNull()
    expect(selectorRow()).toBeNull()
  })

  it('is unchanged with no roster handed in at all', () => {
    render(<CoverPageView content={content} onOpenCanvas={() => {}} />)
    expect(screen.getByRole('tab', { name: 'The service' })).toBeDefined()
    expect(selectorRow()).toBeNull()
  })
})

describe('with two services, the tab becomes the Services selector', () => {
  it('pluralizes the tab label', () => {
    render(
      <CoverPageView
        content={content}
        onOpenCanvas={() => {}}
        services={TWO}
        activeServiceSlug="plus-tutoring"
      />,
    )
    expect(screen.getByRole('tab', { name: 'Services' })).toBeDefined()
    expect(screen.queryByRole('tab', { name: 'The service' })).toBeNull()
  })

  it('heads the panel with a tab per service, the active one selected', () => {
    render(
      <CoverPageView
        content={content}
        onOpenCanvas={() => {}}
        services={TWO}
        activeServiceSlug="plus-tutoring"
      />,
    )
    const row = selectorRow()
    expect(row).not.toBeNull()
    const active = within(row!).getByRole('tab', { name: 'PLUS Tutoring' })
    expect(active.getAttribute('aria-selected')).toBe('true')
    expect(
      within(row!)
        .getByRole('tab', { name: 'Support Desk' })
        .getAttribute('aria-selected'),
    ).toBe('false')
  })

  it('selects a service when its tab is clicked', () => {
    const onSelectService = vi.fn<(slug: string) => void>()
    render(
      <CoverPageView
        content={content}
        onOpenCanvas={() => {}}
        services={TWO}
        activeServiceSlug="plus-tutoring"
        onSelectService={onSelectService}
      />,
    )
    fireEvent.click(
      within(selectorRow()!).getByRole('tab', { name: 'Support Desk' }),
    )
    expect(onSelectService).toHaveBeenCalledWith('support-desk')
  })
})

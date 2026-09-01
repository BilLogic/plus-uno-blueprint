// @vitest-environment jsdom
/**
 * How the service identity bar answers the sidebar (#239).
 *
 * Three separate failures, one subject. At COLLAPSED width the bar had no
 * reference to collapse at all, so the service title was simply lost — while
 * `SlideStickyHeader` and `SliceHeaderBand` had been handing theirs to the
 * floating navbar all along. On a NARROW viewport the aside goes out of the
 * flow at `z-20` and drew over the bar's left half, so a title read as half a
 * title. And the floating navbar's expand toggle sat at its right end,
 * furthest from the edge the sidebar returns to.
 *
 * The seam is the bar rendered beside the navbar that answers it, with the
 * module store in between driven the way `EditorShell` drives it — the two
 * components are the two ends of the hand-off, and asserting on both is what
 * makes "the name arrived" an observation rather than a claim about a hook.
 * Prior art: `mobileTopBar.test.tsx` renders one bar across its states and
 * asserts on labels; `entityHeader.test.tsx` drives this same bar over the
 * app's real query defaults.
 *
 * The inset is asserted as the bar's resolved left offset in pixels, never as
 * a class name: the aside's width is a number the reader can drag, so the
 * claim is that the bar tracks whatever that number currently is.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FloatingSidebarNavbar } from '@/components/editor/EditorChrome'
import { ServiceOverviewHeader } from '@/components/editor/ServiceOverviewHeader'
import { TooltipProvider } from '@/components/ui/tooltip'
import { setSidebarCollapsedState } from '@/contexts/sidebarCollapsedContext'
import { SlideStickyHeader } from '@/components/editor/SlideStickyHeader'
import { PathSelectionProvider } from '@/contexts/PathSelectionContext'
import type { NavItem } from '@/types/nav'
import { QUERY_DEFAULTS } from '@/lib/queryClient'

const supabase = vi.hoisted(() => ({ client: null as unknown, calls: 0 }))

vi.mock('@/contexts/SupabaseProvider', () => ({
  useSupabase: () => ({
    client: supabase.client,
    configured: true,
    session: null,
    isLoading: false,
    canWrite: false,
    isDevAuthoring: false,
    isEditPreview: false,
    canAgent: false,
  }),
}))

const SERVICE_NAME = 'Ecoeled'
const SERVICE_SUMMARY = 'Rooftop solar, end to end.'

type Result = { data: unknown; error: { message: string } | null }

/** Just enough PostgREST for `useServiceSpec` — the shape #237's test pins. */
function fakeSupabase() {
  const rows: Record<string, unknown[]> = {
    services: [
      {
        id: 'svc-1',
        name: SERVICE_NAME,
        summary: SERVICE_SUMMARY,
        business_models: null,
      },
    ],
    phases: [{ id: 'phase-1', scenarios: [{ id: 'scenario-1' }] }],
  }

  return {
    from(table: string) {
      supabase.calls += 1
      const result: Result = { data: rows[table] ?? [], error: null }
      const api: Record<string, unknown> = {
        maybeSingle: () =>
          Promise.resolve({
            data: (result.data as unknown[])[0] ?? null,
            error: null,
          }),
        then: (resolve: (value: Result) => unknown) =>
          Promise.resolve(result).then(resolve),
      }
      for (const verb of ['select', 'order', 'limit', 'eq', 'abortSignal']) {
        api[verb] = () => api
      }
      return api
    },
  }
}

const bar = () =>
  document.querySelector('[data-editor-navbar]') as HTMLElement | null
const floatingNavbar = () =>
  document.querySelector('[data-editor-sidebar-navbar]') as HTMLElement | null
const skeleton = () =>
  document.querySelector('[data-entity-header-skeleton]') as HTMLElement | null

/**
 * The bar and the floating navbar together, because the hand-off has two
 * ends. In the app the floating navbar only mounts while collapsed; here it
 * is always mounted, so one render can be read at both widths.
 */
function mountShell(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <ServiceOverviewHeader />
        <FloatingSidebarNavbar onExpand={() => {}} />
      </TooltipProvider>
    </QueryClientProvider>,
  )
}

/** What `EditorShell` publishes, from a test's hands. */
function sidebar(next: { collapsed?: boolean; overlayInset?: number }) {
  act(() => {
    setSidebarCollapsedState({
      collapsed: next.collapsed ?? false,
      overlayInset: next.overlayInset ?? 0,
    })
  })
}

async function mountWithService() {
  supabase.client = fakeSupabase()
  supabase.calls = 0
  const client = new QueryClient({
    defaultOptions: { queries: QUERY_DEFAULTS },
  })
  mountShell(client)
  await screen.findByText(SERVICE_NAME)
  return client
}

afterEach(() => {
  cleanup()
  // The store is a module singleton — leaving it collapsed would hand the
  // next test a bar that renders nothing for a reason it never set.
  setSidebarCollapsedState({ collapsed: false, overlayInset: 0 })
})

describe('the service bar, collapsed', () => {
  it('renders nothing at all — one chrome lane at any width', async () => {
    await mountWithService()
    expect(bar()).not.toBeNull()

    sidebar({ collapsed: true })
    expect(bar()).toBeNull()
  })

  it('hands the service name to the floating navbar', async () => {
    await mountWithService()
    expect(floatingNavbar()?.textContent).not.toContain(SERVICE_NAME)

    sidebar({ collapsed: true })
    expect(floatingNavbar()?.textContent).toContain(SERVICE_NAME)
  })

  it('hands over the name and NOT the summary — the strip is one line', async () => {
    await mountWithService()
    sidebar({ collapsed: true })

    expect(floatingNavbar()?.textContent).toContain(SERVICE_NAME)
    expect(floatingNavbar()?.textContent).not.toContain(SERVICE_SUMMARY)
  })

  it('expanding restores the bar already filled, with no second skeleton', async () => {
    await mountWithService()
    const reads = supabase.calls

    sidebar({ collapsed: true })
    sidebar({ collapsed: false })

    // Synchronous: this is the first painted frame after expanding. The query
    // stayed subscribed across the collapse, so there is nothing to refetch
    // and nothing to skeleton.
    expect(bar()).not.toBeNull()
    expect(screen.getByText(SERVICE_NAME)).toBeDefined()
    expect(skeleton()).toBeNull()
    expect(supabase.calls).toBe(reads)
  })

  it('stops speaking for the floating navbar once it is expanded', async () => {
    await mountWithService()
    sidebar({ collapsed: true })
    sidebar({ collapsed: false })

    expect(floatingNavbar()?.textContent).not.toContain(SERVICE_NAME)
  })
})

describe('the service bar, while the aside overlays it', () => {
  it('sits flush left when the aside is in the flow', async () => {
    await mountWithService()
    expect(bar()?.style.marginLeft).toBe('')
  })

  it('starts where the overlaying aside ends', async () => {
    await mountWithService()
    sidebar({ overlayInset: 272 })

    expect(bar()?.style.marginLeft).toBe('272px')
  })

  it('follows the aside as the reader drags it wider', async () => {
    await mountWithService()
    sidebar({ overlayInset: 272 })
    sidebar({ overlayInset: 340 })

    expect(bar()?.style.marginLeft).toBe('340px')
  })

  it('gives the space back when the aside stops overlaying', async () => {
    await mountWithService()
    sidebar({ overlayInset: 272 })
    sidebar({ overlayInset: 0 })

    expect(bar()?.style.marginLeft).toBe('')
  })
})

describe('the floating navbar', () => {
  it('carries its expand toggle at the left end, ahead of everything', async () => {
    await mountWithService()
    sidebar({ collapsed: true })

    const toggle = screen.getByLabelText('Expand sidebar')
    for (const after of [
      screen.getByText('Uno Blueprint'),
      screen.getByText(SERVICE_NAME),
    ]) {
      // The sidebar returns at the left edge, so the control that summons it
      // belongs on that side rather than as far from it as the strip allows.
      expect(
        toggle.compareDocumentPosition(after) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    }
  })
})

/*
  The phase and scenario bar takes the same inset, and needs saying separately
  because it is a different file that happens to sit in the same column. The
  overlay does not know which of the three kinds a bar names; the exposure is
  the column, so every bar docked in it answers for the same pixels.

  This was nearly missed. The service bar was fixed first and reads as the
  whole job, because it is the one that owns a query and the one every other
  defect in #234 was about — but `SlideStickyHeader` hides itself only when the
  sidebar is COLLAPSED, and the overlay is the other width entirely: sidebar
  open, drawing over the canvas, this bar rendering underneath it.
*/
const PHASE: NavItem = { id: 'phase-1', index: 0, label: 'Application' }
const SCENARIO: NavItem = {
  id: 'scenario-1',
  index: 1,
  label: 'Discovery',
  parentId: 'phase-1',
  summary: 'Potential tutors discover PLUS.',
}

function mountSlideBar(slide: NavItem) {
  return render(
    <TooltipProvider>
      <PathSelectionProvider>
        <SlideStickyHeader
          slide={slide}
          slides={[PHASE, SCENARIO]}
          paths={[]}
          selectedPathIds={[]}
        />
      </PathSelectionProvider>
    </TooltipProvider>,
  )
}

describe('the phase and scenario bar, while the aside overlays it', () => {
  it('sits flush left when the aside is in the flow', () => {
    mountSlideBar(PHASE)
    expect(bar()?.style.marginLeft).toBe('')
  })

  it('starts where the overlaying aside ends', () => {
    mountSlideBar(PHASE)
    sidebar({ overlayInset: 272 })

    expect(bar()?.style.marginLeft).toBe('272px')
  })

  it('a scenario answers for the same pixels as a phase', () => {
    // Same file, same column, and the kind is the only thing that differs —
    // so the assertion is that the inset is not conditioned on it.
    mountSlideBar(SCENARIO)
    sidebar({ overlayInset: 272 })

    expect(bar()?.style.marginLeft).toBe('272px')
  })

  it('gives the space back when the aside stops overlaying', () => {
    mountSlideBar(PHASE)
    sidebar({ overlayInset: 272 })
    sidebar({ overlayInset: 0 })

    expect(bar()?.style.marginLeft).toBe('')
  })

  it('still renders nothing at all when the sidebar is collapsed', () => {
    // The inset must not resurrect a bar that collapse hides: an inset bar
    // drawn beside the floating navbar is the two-headers-at-once bug that
    // the hand-off exists to prevent.
    mountSlideBar(PHASE)
    sidebar({ collapsed: true, overlayInset: 272 })

    expect(bar()).toBeNull()
  })
})

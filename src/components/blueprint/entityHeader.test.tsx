// @vitest-environment jsdom
/**
 * The identity bar reserves its height, and shows which of four states it is
 * in (#237).
 *
 * The bug this file exists against: `ServiceOverviewHeader` returned `null`
 * while `useServiceSpec` was in flight, so the bar had NO height and the
 * canvas under it jumped when the data landed. The same `return null` also
 * collapsed four `QueryResult` states into one picture — a reader could not
 * tell "still loading" from "this deployment has no service" from "the query
 * failed."
 *
 * The seam is `EntityHeader`, rendered. Height is asserted through the box's
 * resolved geometry against the shared contract value, never by matching a
 * Tailwind class: a class name is not a height, and the whole claim is that
 * two states measure the same.
 *
 * One claim needs more than a render. "A remount with a warm cache never
 * re-skeletons" is a statement about a SECOND mount, so it is driven as
 * mount → unmount → remount through the real bar and the app's own query
 * defaults. It holds because of configuration that already exists —
 * `staleTime: Infinity`, `refetchOnWindowFocus: false`, and the hook
 * reporting `ready` whenever `query.data !== undefined` — so it is pinned
 * here rather than built.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { EntityHeader } from '@/components/blueprint/EntityHeader'
import { ServiceOverviewHeader } from '@/components/editor/ServiceOverviewHeader'
import { BLUEPRINT_MENUBAR_IDENTITY_HEIGHT } from '@/components/editor/menubarHeaderLayout'
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

afterEach(cleanup)

const block = () =>
  document.querySelector('[data-entity-header]') as HTMLElement | null
const skeleton = () =>
  document.querySelector('[data-entity-header-skeleton]') as HTMLElement | null
const summarySlot = () =>
  document.querySelector('[data-entity-header-summary]') as HTMLElement | null
/** The title slot is the affordance itself — `EntityTitleAffordance`'s root. */
const titleSlot = () =>
  document.querySelector('[data-entity-title]') as HTMLElement | null

/** The box's own height, read back the way a browser would resolve it. */
function measure(): string {
  const element = block()
  if (!element) throw new Error('the bar rendered nothing at all')
  return window.getComputedStyle(element).height
}

describe('EntityHeader height', () => {
  const cases: Array<[string, ReactNode]> = [
    ['loading', <EntityHeader key="l" kind="service" status="loading" />],
    [
      'ready, with a summary',
      <EntityHeader
        key="r1"
        kind="service"
        id="svc-1"
        label="Ecoeled"
        summary="Rooftop solar, end to end."
      />,
    ],
    [
      'ready, no summary',
      <EntityHeader key="r2" kind="service" id="svc-1" label="Ecoeled" />,
    ],
    ['ready, no service recorded', <EntityHeader key="r3" kind="service" />],
    [
      'error',
      <EntityHeader
        key="e"
        kind="service"
        status="error"
        message="Could not reach the database"
      />,
    ],
  ]

  it('is the same two-line box in every state', () => {
    for (const [name, element] of cases) {
      render(element)
      expect(measure(), name).toBe(BLUEPRINT_MENUBAR_IDENTITY_HEIGHT)
      cleanup()
    }
  })
})

describe('EntityHeader states', () => {
  it('loading paints a skeleton, and no title', () => {
    render(<EntityHeader kind="service" status="loading" />)
    expect(skeleton()).not.toBeNull()
    expect(titleSlot()).toBeNull()
  })

  it('the skeleton is not announced to a screen reader', () => {
    render(<EntityHeader kind="service" status="loading" />)
    expect(skeleton()?.getAttribute('aria-hidden')).toBe('true')
  })

  it('ready with a service shows the name and the summary', () => {
    render(
      <EntityHeader
        kind="service"
        id="svc-1"
        label="Ecoeled"
        summary="Rooftop solar, end to end."
      />,
    )
    expect(screen.getByText('Ecoeled')).toBeDefined()
    expect(summarySlot()?.textContent).toBe('Rooftop solar, end to end.')
    expect(skeleton()).toBeNull()
  })

  it('ready with no service leaves the bar present, not absent', () => {
    render(<EntityHeader kind="service" />)
    expect(block()).not.toBeNull()
    expect(titleSlot()).toBeNull()
    expect(summarySlot()).toBeNull()
    expect(skeleton()).toBeNull()
  })

  it('error leaves the bar present and reads as a failure, not as empty', () => {
    render(
      <EntityHeader
        kind="service"
        status="error"
        message="Could not reach the database"
      />,
    )
    expect(block()).not.toBeNull()
    expect(summarySlot()?.textContent).toBe('Could not reach the database')
  })

  it('the failure never reaches the title slot', () => {
    render(
      <EntityHeader
        kind="service"
        status="error"
        message="Could not reach the database"
      />,
    )
    // The title is an interactive affordance — it opens the entity panel.
    // Error text there offers a control that leads nowhere.
    expect(titleSlot()).toBeNull()
    expect(screen.queryByLabelText(/^View details:/)).toBeNull()
  })

  it('an error message wins the summary slot from a stale summary', () => {
    render(
      <EntityHeader
        kind="service"
        id="svc-1"
        label="Ecoeled"
        summary="Rooftop solar, end to end."
        status="error"
        message="Could not reach the database"
      />,
    )
    expect(summarySlot()?.textContent).toBe('Could not reach the database')
  })
})

/* ------------------------------------------- the bar, over a warm cache */

type Result = { data: unknown; error: { message: string } | null }

/**
 * Just enough PostgREST for `useServiceSpec`: one `services` row ending in
 * `maybeSingle()`, and a `phases` select awaited on the builder itself.
 */
function fakeSupabase() {
  const rows: Record<string, unknown[]> = {
    services: [
      {
        id: 'svc-1',
        name: 'Ecoeled',
        summary: 'Rooftop solar, end to end.',
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

function mountBar(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <ServiceOverviewHeader />
    </QueryClientProvider>,
  )
}

describe('the service bar over a warm cache', () => {
  it('remounts straight into content, with no second skeleton', async () => {
    supabase.client = fakeSupabase()
    supabase.calls = 0
    // The app's own read policy, not a restatement of it: the claim IS that
    // policy, so a client with different defaults would prove nothing.
    const client = new QueryClient({
      defaultOptions: { queries: QUERY_DEFAULTS },
    })

    const first = mountBar(client)
    expect(await screen.findByText('Ecoeled')).toBeDefined()
    const reads = supabase.calls
    first.unmount()

    mountBar(client)
    // Synchronous: this is the first painted frame of the second mount.
    expect(screen.getByText('Ecoeled')).toBeDefined()
    expect(skeleton()).toBeNull()
    expect(supabase.calls).toBe(reads)
  })
})

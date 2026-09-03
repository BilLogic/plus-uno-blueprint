import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { listStakeholders, searchBlueprint } from '@/lib/agent/tools/read'
import type { ServiceScope } from '@/lib/agent/tools/serviceScope'

/*
 * The read tools APPLYING a scope. `serviceScope.test.ts` pins how a scope is
 * resolved and how the join is walked; this pins that a scoped search returns
 * ONLY the active service's rows, that `all` returns everything, and that the
 * catalog read narrows by the implicit-membership join rather than a column
 * that no longer exists.
 */

type Rec = { table: string; select?: string }

function fakeClient(handlers: {
  from?: (rec: Rec) => { data: unknown; error: unknown }
  rpc?: () => { data: unknown; error: unknown }
}): SupabaseClient<Database> {
  function builder(table: string) {
    const rec: Rec = { table }
    const b = {
      select(sel: string) {
        rec.select = sel
        return b
      },
      eq() {
        return b
      },
      in() {
        return b
      },
      not() {
        return b
      },
      order() {
        return b
      },
      then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
        return Promise.resolve(
          handlers.from ? handlers.from(rec) : { data: [], error: null },
        ).then(onF, onR)
      },
    }
    return b
  }
  return {
    from: (t: string) => builder(t),
    rpc: () =>
      Promise.resolve(handlers.rpc ? handlers.rpc() : { data: [], error: null }),
  } as unknown as SupabaseClient<Database>
}

const SALES: ServiceScope = { kind: 'service', serviceId: 'svc-sales', serviceName: 'Sales Pipeline' }

const PORTAL_ROWS = [
  {
    kind: 'cell',
    id: 'c-sales',
    snippet: 'sales demo booked',
    description: null,
    lane: null,
    step: null,
    scenario: null,
    phase: 'Prospecting',
    path: null,
    matched_by: 'keyword',
    total_matched: 2,
  },
  {
    kind: 'cell',
    id: 'c-support',
    snippet: 'late call-off',
    description: null,
    lane: null,
    step: null,
    scenario: null,
    phase: 'In-session',
    path: null,
    matched_by: 'keyword',
    total_matched: 2,
  },
]

describe('searchBlueprint scope', () => {
  it('scoped to the active service returns only that service’s rows', async () => {
    const client = fakeClient({
      rpc: () => ({ data: PORTAL_ROWS, error: null }),
      // Sales owns only the "Prospecting" phase.
      from: (rec) =>
        rec.table === 'phases'
          ? { data: [{ name: 'Prospecting' }], error: null }
          : { data: [], error: null },
    })
    const out = await searchBlueprint(client, { query: 'demo', scope: SALES })
    expect(out).toContain('sales demo booked')
    expect(out).not.toContain('late call-off')
    // Header is honest within the scope: one row, of one.
    expect(out).toContain('of 1')
  })

  it('widened to all returns every service’s rows, unfiltered', async () => {
    const client = fakeClient({ rpc: () => ({ data: PORTAL_ROWS, error: null }) })
    const out = await searchBlueprint(client, { query: 'demo', scope: { kind: 'all' } })
    expect(out).toContain('sales demo booked')
    expect(out).toContain('late call-off')
  })

  it('defaults to all when no scope is passed (byte-for-byte the old read)', async () => {
    const client = fakeClient({ rpc: () => ({ data: PORTAL_ROWS, error: null }) })
    const out = await searchBlueprint(client, { query: 'demo' })
    expect(out).toContain('sales demo booked')
    expect(out).toContain('late call-off')
  })
})

describe('listStakeholders scope', () => {
  const CAST = [
    { id: 'stk-a', name: 'Student', kind: 'recipient', summary: null, aliases: [] },
    { id: 'stk-b', name: 'Tutor', kind: 'staff', summary: null, aliases: [] },
    { id: 'stk-c', name: 'Vendor', kind: 'partner', summary: null, aliases: [] },
  ]

  it('scoped to a service shows only the cast its journey references (the join)', async () => {
    const client = fakeClient({
      from: (rec) => {
        switch (rec.table) {
          case 'stakeholders':
            return { data: CAST, error: null }
          case 'phases':
            return { data: [{ id: 'ph1' }], error: null }
          case 'scenarios':
            return { data: [{ id: 'sc1' }], error: null }
          case 'paths':
            return { data: [{ id: 'pa1' }], error: null }
          case 'lanes':
            // Sales' lanes pick the student and the tutor, not the vendor.
            return {
              data: [{ stakeholder_id: 'stk-a' }, { stakeholder_id: 'stk-b' }],
              error: null,
            }
          default:
            return { data: [], error: null }
        }
      },
    })
    const out = await listStakeholders(client, SALES)
    expect(out).toContain('Student')
    expect(out).toContain('Tutor')
    expect(out).not.toContain('Vendor')
  })

  it('unscoped (all) shows the whole deployment catalog', async () => {
    const client = fakeClient({
      from: (rec) =>
        rec.table === 'stakeholders' ? { data: CAST, error: null } : { data: [], error: null },
    })
    const out = await listStakeholders(client, { kind: 'all' })
    expect(out).toContain('Student')
    expect(out).toContain('Tutor')
    expect(out).toContain('Vendor')
  })
})

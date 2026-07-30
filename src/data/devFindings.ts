import type { Finding } from '@/types/database'

// TODO(dev-only): remove after DB findings exist — sample findings so the
// findings panel renders in no-DB dev mode. Cell ids reference the Warm-Up
// happy path fallback (the same Regular Tutor cells as src/data/devSlices.ts);
// one cell id is deliberately bogus to exercise the tombstone treatment.

const DEV_TIMESTAMP = '2026-07-29T00:00:00+00:00'

/** Matches supabase/seed.sql — the single PLUS lifecycle. */
const DEV_LIFECYCLE_ID = 'a0000000-0000-4000-8000-000000000001'

/** Never resolves in any blueprint — drives the "n cells not on this view" row. */
export const DEV_FINDING_BOGUS_CELL_ID =
  'f0000000-0000-4000-8000-00000000dead'

export const DEV_FALLBACK_FINDINGS: Finding[] = [
  {
    id: 'f0000000-0000-4000-8000-000000000001',
    service_lifecycle_id: DEV_LIFECYCLE_ID,
    run_id: 'dev-run-0001',
    check_name: 'unowned-handoff',
    fingerprint: 'dev-fp-unowned-handoff-1',
    severity: 'critical',
    source: 'audit',
    status: 'open',
    note: 'No lane owns the handoff when the student never joins the breakout room — the greeting step has no fallback path.',
    cell_ids: [
      'a0000000-0000-4000-8000-000000040103',
      'a0000000-0000-4000-8000-000000040203',
    ],
    cell_keys: [],
    created_at: DEV_TIMESTAMP,
    updated_at: DEV_TIMESTAMP,
  },
  {
    id: 'f0000000-0000-4000-8000-000000000002',
    service_lifecycle_id: DEV_LIFECYCLE_ID,
    run_id: 'dev-run-0002',
    check_name: 'broken-link',
    fingerprint: 'dev-fp-broken-link-1',
    severity: 'warn',
    source: 'whatif',
    status: 'open',
    note: 'Removing screen share breaks the trigger into engagement tracking — one referenced cell no longer exists.',
    cell_ids: [
      'a0000000-0000-4000-8000-000000040303',
      DEV_FINDING_BOGUS_CELL_ID,
    ],
    cell_keys: [],
    created_at: DEV_TIMESTAMP,
    updated_at: DEV_TIMESTAMP,
  },
  {
    id: 'f0000000-0000-4000-8000-000000000003',
    service_lifecycle_id: DEV_LIFECYCLE_ID,
    run_id: 'dev-run-0003',
    check_name: 'orphaned-reference',
    fingerprint: 'dev-fp-orphaned-reference-1',
    severity: 'info',
    source: 'import-sweep',
    status: 'dismissed',
    note: 'Attendance tracking references a PLUS App view that the last import renamed; the stored key was recovered.',
    cell_ids: ['a0000000-0000-4000-8000-000000040503'],
    cell_keys: [],
    created_at: DEV_TIMESTAMP,
    updated_at: DEV_TIMESTAMP,
  },
]

import type { Slice, Slide } from '@/types/database'

// TODO(dev-only): remove after DB slices exist — sample slice so the slice
// focus and presentation views render in no-DB dev mode. Cell ids reference
// the Warm-Up happy path fallback (src/data/blueprintFallbacks.ts, Regular
// Tutor lane). Open with `?slice=<DEV_SLICE_ID>` or
// `?slice=<DEV_SLICE_ID>&mode=present`.

const DEV_SLICE_ID = 'd0000000-0000-4000-8000-000000000001'

const DEV_TIMESTAMP = '2026-07-29T00:00:00+00:00'

/** Matches supabase/seed.sql — the single PLUS service. */
const DEV_SERVICE_ID = 'a0000000-0000-4000-8000-000000000001'

export const DEV_FALLBACK_SLICES: Slice[] = [
  {
    id: DEV_SLICE_ID,
    service_id: DEV_SERVICE_ID,
    title: 'Warm-up walkthrough',
    summary:
      'How a regular tutor warms a student up, from entering the breakout room to tracking engagement.',
    actor: 'Regular Tutor',
    // Fallback data has no registry to point at — the link is what a real
    // row gets from the backfill, and null is the honest value here.
    stakeholder_id: null,
    kind: 'journey',
    authorship: 'manual',
    locale: 'en',
    position: 1,
    created_by: null,
    created_at: DEV_TIMESTAMP,
    updated_at: DEV_TIMESTAMP,
  },
]

export const DEV_FALLBACK_SLIDES: Record<string, Slide[]> = {
  [DEV_SLICE_ID]: [
    {
      id: 'd0000000-0000-4000-8000-000000000011',
      slice_id: DEV_SLICE_ID,
      position: 1,
      title: 'Meet the student',
      narrative:
        'The tutor enters the individual breakout room and greets the student to open the session.',
      cell_ids: [
        'a0000000-0000-4000-8000-000000040103',
        'a0000000-0000-4000-8000-000000040203',
      ],
      cell_keys: [],
      created_by: null,
      created_at: DEV_TIMESTAMP,
      updated_at: DEV_TIMESTAMP,
    },
    {
      id: 'd0000000-0000-4000-8000-000000000012',
      slice_id: DEV_SLICE_ID,
      position: 2,
      title: 'Get set up',
      narrative:
        'The student shares their screen and the tutor reminds them help is always available.',
      cell_ids: [
        'a0000000-0000-4000-8000-000000040303',
        'a0000000-0000-4000-8000-000000040403',
      ],
      cell_keys: [],
      created_by: null,
      created_at: DEV_TIMESTAMP,
      updated_at: DEV_TIMESTAMP,
    },
    {
      id: 'd0000000-0000-4000-8000-000000000013',
      slice_id: DEV_SLICE_ID,
      position: 3,
      title: 'Track the student',
      narrative:
        'The tutor marks the student present and records their engagement level in the PLUS App.',
      cell_ids: [
        'a0000000-0000-4000-8000-000000040503',
        'a0000000-0000-4000-8000-000000040603',
      ],
      cell_keys: [],
      created_by: null,
      created_at: DEV_TIMESTAMP,
      updated_at: DEV_TIMESTAMP,
    },
  ],
}

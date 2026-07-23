-- Reporting an Issue — restore Front Stage Actions (Reach out) → Request assistance.
-- This connector was introduced in 202507085600 and is present in the fallback,
-- but missing from the hosted database (skipped 078).

insert into public.cell_triggers (id, source_cell_id, target_cell_id)
values (
  'a0000000-0000-4000-8000-000000098078',
  'a0000000-0000-4000-8000-0000001d0104',
  'a0000000-0000-4000-8000-0000001d0304'
)
on conflict (id) do update set
  source_cell_id = excluded.source_cell_id,
  target_cell_id = excluded.target_cell_id;

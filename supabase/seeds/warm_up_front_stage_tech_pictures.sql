-- Warm-Up Happy and Alternate paths — Zoom/Pencil Front Stage Tech logos
-- (same assets as Goal Setting scenario)

update public.cells c
set frame = 'https://osybxeojvsqcwxkgnalm.supabase.co/storage/v1/object/public/cell-attachments/cells/a0000000-0000-4000-8000-000000040106/36ccc1f1-b3bb-3314-2647-5e481ccd1845.png'
from public.lanes l,
     public.paths p
where c.lane_id = l.id
  and c.path_id = p.id
  and l.name = 'Front Stage Tech'
  and (
    c.content = 'Zoom/Pencil'
    or c.content like 'Zoom/Pencil,%'
    or c.content like '%, Zoom/Pencil'
    or c.content like '%, Zoom/Pencil,%'
    or c.content like 'Zoom/Pencil' || E'\n%'
  )
  and p.scenario_id = 'a0000000-0000-4000-8000-000000000203';

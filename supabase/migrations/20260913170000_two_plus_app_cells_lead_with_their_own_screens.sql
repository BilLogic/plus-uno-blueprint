-- Two PLUS App cells lead with their own screens.
--
-- Authored 2026-09-13.
--
-- `20260913160000` let a frame win over a featured attachment that differed
-- from it. Two cells placed only on PLUS App carried the Zoom logo as their
-- frame, so they led with a logo of a touchpoint they are not on, while each
-- holds exactly one attachment: a screen of the PLUS App step it describes.
--
--   a0000000-0000-4000-8000-000000180206  Tutors join the session via Zoom.
--                                          (the session's join dialog)
--   a0000000-0000-4000-8000-000000180506  Lead tutors connect with regular
--                                          tutors about the students.
--                                          (the students list)
--
-- Each frame becomes that cell's own attachment. No slide cites either cell,
-- so no slide's pictures move.
--
-- It is a data migration and runs as the owner. Each cell must still hold the
-- Zoom logo as its frame, sit on no Zoom placement and hold exactly one
-- attachment; otherwise the file stops. A database without these cells (a
-- fresh replay) has nothing to change and passes.

do $plus_app_screens$
declare
  zoom_logo text;
  present int;
  eligible int;
  changed int;
begin
  select count(*) into present from public.cells c
   where c.id in ('a0000000-0000-4000-8000-000000180206',
                  'a0000000-0000-4000-8000-000000180506');
  if present = 0 then
    raise notice 'PLUS App screens: this database holds neither cell, so there is nothing to change';
    return;
  end if;

  select t.icon_url into zoom_logo from public.touchpoints t where t.name = 'Zoom';

  select count(*) into eligible from public.cells c
   where c.id in ('a0000000-0000-4000-8000-000000180206',
                  'a0000000-0000-4000-8000-000000180506')
     and c.frame is not distinct from zoom_logo
     and zoom_logo is not null
     and not exists (select 1 from public.cell_touchpoints ct
                       join public.touchpoints t on t.id = ct.touchpoint_id
                      where ct.cell_id = c.id and t.name = 'Zoom')
     and (select count(*) from public.resources r
           where r.cell_id = c.id and r.kind = 'attachment') = 1;
  if eligible <> 2 then
    raise exception 'PLUS App screens: expected both cells to lead with the Zoom logo, off Zoom, with one attachment each; % do', eligible;
  end if;

  update public.cells c
     set frame = r.url
    from public.resources r
   where r.cell_id = c.id
     and r.kind = 'attachment'
     and c.id in ('a0000000-0000-4000-8000-000000180206',
                  'a0000000-0000-4000-8000-000000180506');
  get diagnostics changed = row_count;
  if changed <> 2 then
    raise exception 'PLUS App screens: expected to reframe 2 cells, reframed %', changed;
  end if;

  raise notice 'PLUS App screens: reframed % cells with their own attachment', changed;
end
$plus_app_screens$;

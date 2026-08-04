-- Stage 3 of the tech-cell split: one touchpoint, one row.
--
-- Every multi-item cell in a tech-role lane splits: the ORIGINAL row keeps
-- the first item — so its id, cell_key, arrows, slice references, evidence
-- and storyboards stay attached to something real — and each further item
-- becomes a sibling row in the same slot at the next slot_position.
--
-- Sibling keys are the parent's key with an ordinal suffix ('-2', '-3'),
-- keeping the cells_cell_key_unique index satisfied and the key readable.
-- Recorded caveat, accepted in the plan: an arrow or slice that pointed at
-- the bundle now points at its first touchpoint.
do $$
declare
  rec record;
  items text[];
  i int;
begin
  for rec in
    select c.id, c.path_id, c.layer_id, c.step_id, c.content, c.cell_key
    from public.cells c
    join public.layers l on l.id = c.layer_id
    where l.layer_role in ('frontstage_tech','backstage_tech','support_systems')
      and c.content ~ '[\n,]'
  loop
    select array_agg(part) into items
    from (
      select trim(part) as part
      from regexp_split_to_table(rec.content, '\r?\n|,') as part
    ) parts
    where part <> '';

    if items is null or array_length(items, 1) < 2 then
      continue;
    end if;

    update public.cells set content = items[1] where id = rec.id;

    for i in 2 .. array_length(items, 1) loop
      insert into public.cells
        (path_id, layer_id, step_id, slot_position, content, origin, cell_key)
      values
        (rec.path_id, rec.layer_id, rec.step_id, i - 1, items[i], 'app',
         case when rec.cell_key is null then null
              else rec.cell_key || '-' || i::text end);
    end loop;
  end loop;
end $$;

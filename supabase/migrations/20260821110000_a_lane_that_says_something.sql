-- Support Actions was 92 cells and 57 of them were the same sentence.
--
-- "Dev Team builds the app and the Design Team creates the screens and flows
-- relevant to this step" sat under 49 steps across four scenarios — under
-- nearly every column of Goal Setting. It is true, and it is true of every
-- step in the blueprint, which is why repeating it per column carries no
-- information: a reader scanning the support row learns the same thing 57
-- times and nothing about any particular step.
--
-- One survives per scenario, on the happy path, at the earliest step, and it
-- says out loud that it stands for the whole scenario. Everything else in the
-- lane — child protection law, help@tutors.plus, the fill-in surfacing rules,
-- the researchers behind onboarding content — is genuinely step-specific and
-- is untouched.
--
-- One slice referenced four of the deleted cells, each as a single-cell item.
-- Three of those items would have been left with nothing to point at, so they
-- go too; the fourth keeps its cell, which is the survivor.
--
-- Also: eight cells escalated to `tutors@tutor.plus`. Every other address in
-- this blueprint and in the repo is on `tutors.plus` — help@tutors.plus,
-- app.tutors.plus, the marketing site. Confirmed with Bill as a typo.

begin;

create temp table keepers on commit drop as
with b as (
  select c.id, s.name scenario, pa.path_type, coalesce(ps.position, 999) pos, st.name step,
         row_number() over (partition by s.name order by (pa.path_type='happy') desc, coalesce(ps.position,999), st.name) rn
  from cells c
  join lanes l on l.id=c.lane_id
  join paths pa on pa.id=l.path_id
  join steps st on st.id=c.step_id
  join scenarios s on s.id=st.scenario_id
  left join path_steps ps on ps.step_id=st.id and ps.path_id=pa.id
  where l.name='Support Actions' and c.summary ilike 'Dev Team %uilds the app%'
)
select id, scenario, step from b where rn = 1;

create temp table doomed on commit drop as
select c.id from cells c join lanes l on l.id=c.lane_id
where l.name='Support Actions' and c.summary ilike 'Dev Team %uilds the app%'
  and c.id not in (select id from keepers);

delete from slice_items si
where si.cell_ids <@ (select coalesce(array_agg(id), '{}'::uuid[]) from doomed);

update slice_items si
set cell_ids = (select coalesce(array_agg(x), '{}'::uuid[]) from unnest(si.cell_ids) x where x not in (select id from doomed))
where si.cell_ids && (select coalesce(array_agg(id),'{}'::uuid[]) from doomed);

delete from cells where id in (select id from doomed);

update cells set
  summary = $q$The Dev Team builds these surfaces and the Design Team draws them, working from what the research team finds. They support this scenario throughout — this cell stands for the whole of it rather than repeating on every step.$q$
where id in (select id from keepers);

update cells set
  content = replace(content, 'tutors@tutor.plus', 'tutors@tutors.plus'),
  summary = replace(coalesce(summary,''), 'tutors@tutor.plus', 'tutors@tutors.plus')
where content like '%tutors@tutor.plus%' or summary like '%tutors@tutor.plus%';

do $$
declare n int;
begin
  select count(*) into n from cells c join lanes l on l.id=c.lane_id
   where l.name='Support Actions' and c.summary ilike 'Dev Team %uilds the app%';
  if n > 0 then raise exception '% boilerplate cells survived the collapse', n; end if;
  select count(*) into n from cells where content like '%tutor.plus%' and content not like '%tutors.plus%';
  if n > 0 then raise exception '% cells still point at the tutor.plus domain', n; end if;
  select count(*) into n from slice_items where cardinality(cell_ids) = 0;
  if n > 0 then raise exception '% slice items were left with no cells', n; end if;
  select count(*) into n from slice_items si
   where exists (select 1 from unnest(si.cell_ids) x where x not in (select id from cells));
  if n > 0 then raise exception '% slice items point at a deleted cell', n; end if;
end $$;

commit;

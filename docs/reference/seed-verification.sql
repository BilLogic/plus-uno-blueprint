-- Verify Service Blueprint seed (run against the database itself; `supabase
-- db reset` cannot rebuild this schema — see docs/adr/0009)

-- Service phases
select
  s.name as service,
  p.position,
  p.name as phase,
  loop_p.name as loops_to
from public.services s
join public.phases p on p.service_id = s.id
left join public.phases loop_p on loop_p.id = p.loops_to_phase_id
where s.id = 'a0000000-0000-4000-8000-000000000001'
order by p.position;

-- In-session scenarios
select
  p.name as phase,
  ss.position,
  ss.name as scenario
from public.phases p
join public.scenarios ss on ss.phase_id = p.id
where p.id = 'a0000000-0000-4000-8000-000000000104'
order by ss.position;

-- Warm-Up Happy Path blueprint
select
  ss.name as scenario,
  pa.name as path,
  pa.summary,
  pa.kind,
  (select count(*) from public.lanes l where l.path_id = pa.id) as lanes,
  (select count(*) from public.path_steps ps where ps.path_id = pa.id) as steps,
  (select count(*) from public.cells c where c.path_id = pa.id) as cells,
  (select count(*) from public.cell_dependencies ct
   join public.cells c on c.id = ct.source_cell_id
   where c.path_id = pa.id) as dependencies
from public.paths pa
join public.scenarios ss on ss.id = pa.scenario_id
where pa.id = 'a0000000-0000-4000-8000-000000000300';

select l.position, l.name as lane
from public.lanes l
where l.path_id = 'a0000000-0000-4000-8000-000000000300'
order by l.position;

select ps.position, s.name as step
from public.path_steps ps
join public.steps s on s.id = ps.step_id
where ps.path_id = 'a0000000-0000-4000-8000-000000000300'
order by ps.position;

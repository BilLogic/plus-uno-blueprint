-- Three sentences appear ONCE in Help Request — their own scenario — and SIX
-- times each in Goal Setting, one per step. They are real duties, and they are
-- stamped. A column means AT THIS MOMENT, so the same sentence on every column
-- claims it happens at every moment: untrue, and it crowds out what actually
-- differs step to step.
--
-- One kept per behaviour, at the earliest step it could happen, so a reader of
-- Goal Setting still sees that the teacher can interrupt. Five deleted each.

with ranked as (
  select c.id,
         row_number() over (
           partition by c.content, l.name order by ps.position, c.id
         ) as rank
  from cells c
  join lanes l on l.id = c.lane_id
  join paths p on p.id = l.path_id
  join scenarios sc on sc.id = p.scenario_id
  join path_steps ps on ps.path_id = p.id and ps.step_id = c.step_id
  where sc.name = 'Goal Setting'
    and c.content in (
      'Informs the classroom teacher about absent students.',
      'Responds to the classroom teacher''s "ask for help" request.',
      'Alerts the lead tutor about unassigned or mis-assigned students using the "ask for help" alert.'
    )
)
delete from cells where id in (select id from ranked where rank > 1);

do $$
declare n int;
begin
  select count(*) into n from cells c
  join lanes l on l.id = c.lane_id
  join paths p on p.id = l.path_id
  join scenarios sc on sc.id = p.scenario_id
  where sc.name = 'Goal Setting'
    and c.content in (
      'Informs the classroom teacher about absent students.',
      'Responds to the classroom teacher''s "ask for help" request.',
      'Alerts the lead tutor about unassigned or mis-assigned students using the "ask for help" alert.'
    );
  if n <> 3 then raise exception 'expected 3 kept, got %', n; end if;
end $$;

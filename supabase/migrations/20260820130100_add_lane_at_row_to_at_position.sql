-- add_lane(at_row) → add_lane(at_position), matching add_step(at_position).
--
-- `at_row` named the rendering, like the row_position column it fed. Both
-- functions now say the same thing: "insert at this index".
--
-- A parameter rename needs a drop and recreate. The ACL is handled the way the
-- layers→lanes rename got WRONG: a recreate starts from Postgres's DEFAULT
-- grant of EXECUTE to PUBLIC, so the repair must REVOKE what the original had
-- revoked, not only grant what it had granted. add_lane is a SECURITY DEFINER
-- write and carried postgres / authenticated / service_role — no PUBLIC, no
-- anon.

do $do$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'add_lane';
  if d is null then raise exception 'add_lane not found'; end if;

  d := regexp_replace(d, '\mat_row\M',       'at_position', 'g');
  d := regexp_replace(d, '\mrow_position\M', 'position',    'g');

  drop function public.add_lane(scenario_id uuid, name text, lane_role text, at_row integer);
  execute d;
end
$do$;

revoke execute on function
  public.add_lane(scenario_id uuid, name text, lane_role text, at_position integer)
  from public, anon;
grant execute on function
  public.add_lane(scenario_id uuid, name text, lane_role text, at_position integer)
  to authenticated, service_role;

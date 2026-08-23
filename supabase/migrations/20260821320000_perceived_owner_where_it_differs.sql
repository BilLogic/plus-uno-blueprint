-- `perceived_owner` was empty on all 935 cells. It is NOT a board-wide fill:
-- the column exists to record the GAP between who is accountable and who the
-- person on the other side thinks is accountable, so a value equal to `owner`
-- says nothing and a value everywhere would bury the handful that matter.

update public.cells
set owner = 'Tutor Supervisors', perceived_owner = 'PLUS staff', updated_at = now()
where content in (
  'Reaches out to PLUS staff with any concerns.',
  'PLUS staff request assistance if needed.'
);

update public.cells
set owner = 'CPO', perceived_owner = 'Tutor Supervisors', updated_at = now()
where content = 'Runs the Act 153 checks and confirms the result to PLUS.';

do $$
declare n int; same int;
begin
  select count(*) into n from cells where perceived_owner is not null;
  if n < 3 then raise exception 'expected at least 3 perceived_owner rows, got %', n; end if;

  select count(*) into same from cells
  where perceived_owner is not null and perceived_owner = owner;
  if same > 0 then raise exception '% cells claim a gap that is not one', same; end if;
end $$;

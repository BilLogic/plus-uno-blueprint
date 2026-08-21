-- `sets_off` → `leads_to`, in the database as well as the UI.
--
-- The panel headings were changed to "Follows" / "Leads to" first, on the
-- reading that a label is where wording belongs. That left the stored key
-- saying one thing and every human surface saying another, which is the exact
-- drift this vocabulary work has been removing all week. So the key follows.
--
-- Third rename of this enum, and the last: `trigger` → `sets_off` fixed a
-- word that named the wrong half of the relationship, and this fixes one that
-- reads as an alarm going off rather than as one moment handing to the next.
-- `enables` is untouched — it was already the plain word for what it means.
--
-- ORDER MATTERS. The CHECK is dropped before the rows move and re-added
-- after: updating rows to a value the constraint does not yet allow fails,
-- which is how the view_type migration failed on its first run.
--
-- CROSS-REPO: `set_cell_dependency`'s `kind` argument and `search_blueprint`'s
-- edge payload both carry this value to uno-bot. The bot's vendored contract
-- and its `BlueprintEdge` type ship in the same window.

alter table public.cell_dependencies
  drop constraint cell_dependencies_kind_check;

alter table public.cell_dependencies
  alter column kind set default 'leads_to';

update public.cell_dependencies set kind = 'leads_to' where kind = 'sets_off';

alter table public.cell_dependencies
  add constraint cell_dependencies_kind_check
  check (kind in ('leads_to', 'enables'));

-- The plpgsql trap, for the third time: a value used inside a function body is
-- text the rename cannot reach.
--
-- And a NEW trap, hit on the first two attempts at this migration: the
-- previous renames asserted "the definition changed" by comparing LENGTH
-- before and after. `sets_off` and `leads_to` are both eight characters, so
-- the length is identical and the assert fired on a replace that had worked
-- perfectly. Substring presence is the honest check — the fragment must be
-- there before, and gone after.
do $do$
declare d text; q text := chr(39);
begin
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'set_cell_dependency';
  if d is null then raise exception 'set_cell_dependency not found'; end if;
  if strpos(d, 'sets_off') = 0 then
    raise exception 'set_cell_dependency: no sets_off fragment to replace';
  end if;
  d := replace(d, q || 'sets_off' || q, q || 'leads_to' || q);
  if strpos(d, 'sets_off') <> 0 then
    raise exception 'set_cell_dependency: sets_off survived the replace';
  end if;
  execute d;

  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_blueprint';
  if d is null then raise exception 'search_blueprint not found'; end if;
  if strpos(d, 'sets_off') = 0 then
    raise exception 'search_blueprint: no sets_off fragment to replace';
  end if;
  d := replace(d, q || 'sets_off' || q, q || 'leads_to' || q);
  if strpos(d, 'sets_off') <> 0 then
    raise exception 'search_blueprint: sets_off survived the replace';
  end if;
  execute d;
end
$do$;

do $assert$
declare stragglers int;
begin
  select count(*) into stragglers
  from public.cell_dependencies where kind not in ('leads_to', 'enables');
  if stragglers > 0 then
    raise exception '% dependency rows are on an unknown kind', stragglers;
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and pg_get_functiondef(p.oid) like '%sets_off%'
  ) then
    raise exception 'a function still names sets_off';
  end if;
end
$assert$;

-- paths.description → paths.summary.
--
-- Same word and same reason as cells.description: the field answers "when does
-- this route apply", `note` is the author's aside, and plan 006 draws that
-- line. 37 of 38 rows carry one, so this is populated content, not a dormant
-- column.
--
-- THE TRAP: `alter table ... rename column` does NOT touch plpgsql function
-- bodies. They are stored as text and resolved at execution, so a renamed
-- column leaves every function naming it deployable and broken on the next
-- call. Three functions reference paths' description across five fragments,
-- listed one by one below — `description` is also a column on cells, phases,
-- service_scenarios and slices inside these same bodies, so a blanket replace
-- would corrupt all of them.
--
-- search_blueprint's RETURNS TABLE keeps its `description` OUTPUT column. That
-- is a wire format shared with uno-bot (blueprintContract.searchBlueprintColumns)
-- and is a separate decision from the table's column name.
--
-- Acceptance, run after: zero functions still name a paths description.
--   select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname in ('public','semantic_search') and p.prokind='f'
--     and pg_get_functiondef(p.oid) ~ '(p|src_path)\.description';

alter table public.paths rename column description to summary;

do $do$
declare d text; before_len int;
begin
  -- duplicate_path -----------------------------------------------------------
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'duplicate_path';
  if d is null then raise exception 'duplicate_path not found'; end if;
  before_len := length(d);
  d := replace(d, '(service_scenario_id, name, path_type, description, note, origin)',
                  '(service_scenario_id, name, path_type, summary, note, origin)');
  d := replace(d, 'p.description, p.note, ''app''', 'p.summary, p.note, ''app''');
  if length(d) = before_len then raise exception 'duplicate_path: no paths.description fragment matched'; end if;
  execute d;

  -- duplicate_scenario -------------------------------------------------------
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'duplicate_scenario';
  if d is null then raise exception 'duplicate_scenario not found'; end if;
  before_len := length(d);
  d := replace(d, 'select p.id, p.name, p.path_type, p.description, p.note',
                  'select p.id, p.name, p.path_type, p.summary, p.note');
  d := replace(d, '(service_scenario_id, name, path_type, description, note, origin)',
                  '(service_scenario_id, name, path_type, summary, note, origin)');
  d := replace(d, 'src_path.description, src_path.note, ''app'')',
                  'src_path.summary, src_path.note, ''app'')');
  if length(d) = before_len then raise exception 'duplicate_scenario: no paths.description fragment matched'; end if;
  execute d;

  -- search_blueprint ---------------------------------------------------------
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_blueprint';
  if d is null then raise exception 'search_blueprint not found'; end if;
  before_len := length(d);
  d := replace(d, 'select ''path'', p.id, p.name, p.description, p.updated_at,',
                  'select ''path'', p.id, p.name, p.summary, p.updated_at,');
  if length(d) = before_len then raise exception 'search_blueprint: paths.description fragment did not match'; end if;
  execute d;
end
$do$;

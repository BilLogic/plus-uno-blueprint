-- cell_triggers → cell_dependencies.
--
-- WHY NOT cell_links, which an earlier draft of plan 002 proposed: it would
-- collide with `cells.links`, a jsonb array of URLs on a single cell, and with
-- the CellLink TypeScript type that describes one of those URLs. Three
-- meanings, one word. The draft cited the agent tools create_cell_link /
-- list_cell_links as evidence for the name — backwards. Those two tools were
-- the drift; everything else already said "dependency":
--
--   public.set_cell_dependency · public.clear_cell_dependency     RPCs
--   'set_cell_dependency' | 'clear_cell_dependency'               ledger kinds
--   "Connected two cells" · "Removed a connection"                ledger labels
--   { value: 'dependencies', label: 'Dependencies' }              cell panel tab
--
-- WHAT DOES NOT CHANGE: the `kind` column keeps ('trigger','needs'). "trigger"
-- there is not the container — it is one of two KINDS of dependency: temporal
-- ("sets off") versus functional ("must exist first"). Renaming it would give
-- kind in ('dependency','needs'), which is incoherent: `needs` is a dependency
-- too. A genus cannot also be one of its own species.
--
-- Renaming a table does NOT rename its constraints, indexes, policies or
-- triggers. All 15 are renamed explicitly below. The two FK constraint names
-- are the load-bearing ones: they appear as STRINGS inside uno-bot's PostgREST
-- embed hints, where nothing type-checks them on either side.
--
-- ⚠️ DEPLOY COUPLING: uno-bot reads /rest/v1/cell_triggers directly. This
-- migration and the bot's deploy ship in ONE window, or the bot's edge read
-- 404s and degrades silently to "no dependencies" for cells that have them.
--
-- Acceptance, run after:
--   select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname in ('public','semantic_search') and p.prokind='f'
--     and pg_get_functiondef(p.oid) ~ '\mcell_triggers\M';   -- 0 rows

alter table public.cell_triggers rename to cell_dependencies;

-- constraints
alter table public.cell_dependencies rename constraint cell_triggers_pkey                       to cell_dependencies_pkey;
alter table public.cell_dependencies rename constraint cell_triggers_kind_check                 to cell_dependencies_kind_check;
alter table public.cell_dependencies rename constraint cell_triggers_no_self_reference          to cell_dependencies_no_self_reference;
alter table public.cell_dependencies rename constraint cell_triggers_source_cell_id_fkey        to cell_dependencies_source_cell_id_fkey;
alter table public.cell_dependencies rename constraint cell_triggers_target_cell_id_fkey        to cell_dependencies_target_cell_id_fkey;
alter table public.cell_dependencies rename constraint cell_triggers_source_target_kind_unique  to cell_dependencies_source_target_kind_unique;

-- indexes not already renamed by their constraint
alter index public.cell_triggers_source_cell_id_idx rename to cell_dependencies_source_cell_id_idx;
alter index public.cell_triggers_target_cell_id_idx rename to cell_dependencies_target_cell_id_idx;

-- policies
alter policy cell_triggers_select               on public.cell_dependencies rename to cell_dependencies_select;
alter policy cell_triggers_insert_service_only  on public.cell_dependencies rename to cell_dependencies_insert_service_only;
alter policy cell_triggers_update_service_only  on public.cell_dependencies rename to cell_dependencies_update_service_only;
alter policy cell_triggers_delete_service_only  on public.cell_dependencies rename to cell_dependencies_delete_service_only;

-- the updated_at trigger (an actual Postgres trigger, unrelated to the `kind`)
alter trigger set_cell_triggers_updated_at on public.cell_dependencies rename to set_cell_dependencies_updated_at;

-- Function bodies do not follow a table rename — they are text, resolved at
-- execution. Unlike `description`, `cell_triggers` is an unambiguous
-- identifier, so a word-boundary sweep is safe. The count is asserted, so a
-- miss aborts rather than shipping a landmine that fails weeks later.
do $do$
declare r record; d text; n int := 0;
begin
  for r in
    select p.oid, p.proname
    from pg_proc p join pg_namespace nsp on nsp.oid = p.pronamespace
    where nsp.nspname in ('public','semantic_search') and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~ '\mcell_triggers\M'
  loop
    d := pg_get_functiondef(r.oid);
    d := regexp_replace(d, '\mcell_triggers\M', 'cell_dependencies', 'g');
    execute d;
    n := n + 1;
  end loop;
  if n <> 8 then
    raise exception 'expected 8 function bodies naming cell_triggers, rewrote %', n;
  end if;
end
$do$;

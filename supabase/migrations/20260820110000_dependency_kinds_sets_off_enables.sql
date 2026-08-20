-- The two dependency kinds get the words the product uses, pointing the same way.
--
--   trigger  →  sets_off
--   needs    →  enables
--
-- WHY THE PRODUCT WORDS: the Dependencies tab has always grouped these as
-- "Sets off" / "Set off by", while the column stored `trigger`. Product word
-- and stored value disagreed — the same class of gap that made `links`
-- ambiguous. Now the stored value IS the label, minus the underscore.
--
-- WHY NOT `depends_on` (the first attempt): the problem was never the word, it
-- was DIRECTION. `sets_off` and `depends_on` put the source cell at opposite
-- ends of the relationship —
--
--     A sets_off   B   →  A comes first, A causes B
--     A depends_on B   →  B comes first, B is required by A
--
-- — so an edge's direction could not be read without first checking its kind.
-- `requires` would have had the identical defect. `enables` puts both kinds
-- source-first and upstream-first:
--
--     "Creates breakout rooms"  --sets off--> "Reminds tutors to go through rooms"
--     "Roster has loaded"       --enables-->  "Greets the student"
--
-- Makes it HAPPEN versus makes it POSSIBLE. The panel groups become symmetric
-- too: Sets off / Set off by, Enables / Enabled by.
--
-- The words "temporal" and "functional" are retired from every doc. They named
-- the distinction without making it usable.
--
-- 478 rows were 'trigger'; 'needs' had never been written, so the second kind
-- cost nothing to rename twice.

alter table public.cell_dependencies drop constraint cell_dependencies_kind_check;
alter table public.cell_dependencies alter column kind drop default;

update public.cell_dependencies
set kind = case kind
             when 'trigger' then 'sets_off'
             when 'needs'   then 'enables'
             else kind
           end
where kind in ('trigger', 'needs');

alter table public.cell_dependencies alter column kind set default 'sets_off';
alter table public.cell_dependencies add constraint cell_dependencies_kind_check
  check (kind in ('sets_off', 'enables'));

-- Function bodies do not follow data or constraint changes.
do $do$
declare d text; before_len int;
begin
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'set_cell_dependency';
  if d is null then raise exception 'set_cell_dependency not found'; end if;
  before_len := length(d);
  d := replace(d, 'kind text DEFAULT ''trigger''::text', 'kind text DEFAULT ''sets_off''::text');
  d := replace(d,
    'if set_cell_dependency.kind not in (''trigger'', ''needs'') then',
    'if set_cell_dependency.kind not in (''sets_off'', ''enables'') then');
  if length(d) = before_len then raise exception 'set_cell_dependency: no kind literal matched'; end if;
  execute d;

  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_blueprint';
  if d is null then raise exception 'search_blueprint not found'; end if;
  before_len := length(d);
  d := replace(d, 'coalesce(t.kind,''trigger'')', 'coalesce(t.kind,''sets_off'')');
  if length(d) = before_len then raise exception 'search_blueprint: no kind literal matched'; end if;
  execute d;
end
$do$;

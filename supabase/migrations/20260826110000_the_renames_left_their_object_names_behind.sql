-- What every rename in this repo left behind: the object names.
--
-- `alter table … rename` moves the table and the column. It moves nothing
-- else. The index keeps the name it was created with, and so do the
-- constraint, the policy, the trigger and the comment. 20260820120000 said
-- so in its own header — "Renaming a table moves none of its constraints,
-- indexes, policies or triggers" — and renamed all thirteen of its own by
-- hand. THE TRAP, again: the four renames that did not do that left
-- twenty-two identifiers behind, verified against production on 2026-08-26
-- and enumerated on #142.
--
-- Nothing here changes behaviour. No table, column, view, sequence or type
-- still says any of these words; only the names of dependent objects do.
-- PostgREST resolves embedded reads by CONSTRAINT name, which is the one way
-- a rename like this could bite, so `check:contract:live` runs over it rather
-- than around it — `src/lib/blueprintContract.ts` declares two constraint
-- names and both are already correct.
--
-- Comments: #142 counted three stale ones. A comment sweep finds six.
-- Two more carry a retired word inside a longer sentence — `cells` still
-- reads "Content at layer × step intersection", and `lanes.lane_role` still
-- points a reader at `layers.name`. They are the same defect and they are
-- corrected here, or the assertion at the foot of this file could not pass.
--
-- The sixth is `paths.path_type`, and finding it needed the database. Its
-- LIVE comment ends "Maturity stays in the name — (Planned) …, (Prototype)
-- …". That sentence appears in NO file under supabase/migrations: this
-- repo's `20260821220000_three_kinds_of_route.sql` sets the same comment
-- without it. The applied row in `supabase_migrations.schema_migrations`
-- (version 20260821184939) does contain it. The file and the SQL that
-- actually ran differ in CONTENT, not merely in version number, which makes
-- this the sharpest evidence #148 has: a replay of the migration files is a
-- replay of a schema nobody deployed.
--
-- It is also the only one of the six that is worse than stale wording.
-- `maturity` was retired by `20260821240000_status_not_maturity.sql`, which
-- moved it to `paths.status` on the `entity_status` domain — so the sentence
-- instructs an author to encode, in a name, the thing a queryable column
-- already carries. Deleting it would leave the question unanswered where an
-- author looks, so it is replaced by a sentence naming the column.
--
-- Three comments are deliberate and are NOT swept. `services` and
-- `business_model` each record the rename that produced them: a historical
-- note that names the old table is the opposite of stale vocabulary — it is
-- what stops the next reader re-deriving the rename from scratch. `evidence`
-- is the permanent exemption itself, saying "proposition questions" about the
-- three validation questions, which really are propositions; the rename moved
-- the container, not the concept. All three are excluded by name in the sweep
-- rather than dodged by a cleverer pattern, so the exemptions are countable.
--
-- Acceptance is the assertion block below, which re-reads pg_constraint,
-- pg_indexes, pg_policies, pg_trigger and pg_description after the fact. It
-- was proved RED before it was proved green: run its `retired` pattern against
-- production BEFORE the DDL and it names all twenty-two objects, eight of them
-- in the index sweep because the two primary-key indexes appear there too,
-- plus the six comments.
--
--   select conname from pg_constraint c join pg_namespace n
--     on n.oid = c.connamespace
--   where n.nspname = 'public'
--     and conname ~* 'lifecycle|layer|proposition|service_scenario'
--                    || '|cell_trigger|maturity|sets_off';
--
-- A guard first observed green has never been observed at all.

-- ---------------------------------------------------------------------------
-- Constraints (7). `business_model_service_id_fkey` carried two dead names at
-- once: the table was `propositions` and the column was `service_lifecycle_id`.
-- ---------------------------------------------------------------------------
alter table public.services       rename constraint service_lifecycles_pkey to services_pkey;
alter table public.business_model rename constraint propositions_pkey       to business_model_pkey;

alter table public.phases         rename constraint phases_service_lifecycle_id_fkey        to phases_service_id_fkey;
alter table public.findings       rename constraint findings_service_lifecycle_id_fkey      to findings_service_id_fkey;
alter table public.slices         rename constraint slices_service_lifecycle_id_fkey        to slices_service_id_fkey;
alter table public.evidence       rename constraint evidence_service_lifecycle_id_fkey      to evidence_service_id_fkey;
alter table public.business_model rename constraint propositions_service_lifecycle_id_fkey  to business_model_service_id_fkey;

-- ---------------------------------------------------------------------------
-- Indexes (6). The two that back the primary keys above moved with their
-- constraints and are not repeated here. `phases_lifecycle_order_idx` keeps
-- "order": `order_position` became `position`, but the index covers
-- (service_id, position) and "order" is what it is for.
-- ---------------------------------------------------------------------------
alter index public.phases_service_lifecycle_id_idx   rename to phases_service_id_idx;
alter index public.phases_lifecycle_order_idx        rename to phases_service_order_idx;
alter index public.slices_service_lifecycle_id_idx   rename to slices_service_id_idx;
alter index public.findings_service_lifecycle_id_idx rename to findings_service_id_idx;
alter index public.evidence_service_lifecycle_id_idx rename to evidence_service_id_idx;
alter index public.cells_layer_id_idx                rename to cells_lane_id_idx;

-- ---------------------------------------------------------------------------
-- Policies (7).
-- ---------------------------------------------------------------------------
alter policy service_lifecycles_select on public.services rename to services_select;

alter policy propositions_select_auth         on public.business_model rename to business_model_select_auth;
alter policy propositions_insert_auth         on public.business_model rename to business_model_insert_auth;
alter policy propositions_insert_service_only on public.business_model rename to business_model_insert_service_only;
alter policy propositions_update_auth         on public.business_model rename to business_model_update_auth;
alter policy propositions_update_service_only on public.business_model rename to business_model_update_service_only;
alter policy propositions_delete_service_only on public.business_model rename to business_model_delete_service_only;

-- ---------------------------------------------------------------------------
-- Triggers (2).
-- ---------------------------------------------------------------------------
alter trigger set_service_lifecycles_updated_at on public.services       rename to set_services_updated_at;
alter trigger set_propositions_updated_at       on public.business_model rename to set_business_model_updated_at;

-- ---------------------------------------------------------------------------
-- Comments. `cells.cell_key` is the statement of record for the key format:
-- it was documented in three places, in three different wrong shapes, so it
-- is written once here and the other two point at this column.
--
-- Five segments. A phase is not one of them — the key runs service, then
-- straight to the scenario.
-- ---------------------------------------------------------------------------
comment on table public.phases is
  'Ordered phase of the service, in time order.';

comment on table public.cells is
  'Content at lane × step intersection, within one path.';

comment on column public.lanes.lane_role is
  'Semantic role key that drives rendering (pill cells, visual rows, divider-line anchoring); the display name stays in lanes.name and is free-form in any language. Canonical values: customer_actions, frontstage_actions, backstage_actions, frontstage_tech, backstage_tech, support_systems, visual, step_visual. The vocabulary is extensible — org-defined custom roles are allowed and render as generic swimlanes. Null = generic swimlane (e.g. actor lanes).';

comment on column public.slices.slice_type is
  'How the cut was made: journey (experience closure for an actor) | step (one column) | lane (one lane across the whole service) | cell (single-cell spec) | custom.';

-- Invisible to a file-based replay; see the header and #148. The three-route
-- sentence is kept verbatim from `20260821220000`. What replaces the maturity
-- sentence is not a deletion: the question it answered — where does "how far
-- along is this route" live — now gets the true answer.
comment on column public.paths.path_type is
  'How this route relates to the scenario''s main one: happy (it IS the main route), variant (equally normal, chosen by condition), exception (a rule or a failure diverts it). How far along the route is does not belong in its NAME: paths.status carries that, on the entity_status domain — proposed, planned, built, live, at_risk, deprecated.';

comment on column public.cells.cell_key is
  'THE STATEMENT OF RECORD for the cell-key format. Five slugified segments, service/scenario/path/lane/step — e.g. plus-application/before-students-join/happy-path/back-stage-actions/open-session. A phase is NOT a segment. Written by the import pipeline for origin=import, minted by upsert_cell for origin=app. Survives re-import; slice_items.cell_keys matches against it.';

-- ---------------------------------------------------------------------------
-- The re-sweep. Every catalogue this migration touched, read back by name.
--
-- PLAIN SUBSTRINGS, deliberately. The first draft of this block anchored every
-- alternative with \m…\M, and `_` is a word constituent in a Postgres regular
-- expression: there is no word boundary in `phases_service_lifecycle_id_fkey`
-- except at its two ends. Run against production before the DDL above, that
-- version matched zero of the twenty-two objects it was written to catch. It
-- could not have failed, which means going green would have told nobody
-- anything — the same shape of bug as 20260820140000's `if n <> 7`, and the
-- exact failure this ticket exists to fix.
--
-- `service_scenario` keeps its prefix on purpose. Bare `scenario` is a live
-- word: it would match `paths_scenario_id_fkey`, which is correct today.
-- Every other token here is retired outright — no current identifier in this
-- database contains `lifecycle`, `layer`, `proposition`, `cell_trigger`,
-- `maturity` or `sets_off` as a substring.
-- ---------------------------------------------------------------------------
do $do$
declare
  retired constant text :=
    'lifecycle|layer|proposition|service_scenario|cell_trigger|maturity|sets_off'
    || '|row_position|column_position|slot_position|order_position';
  offenders text;
begin
  select string_agg(format('%s on %s', c.conname, c.conrelid::regclass), ', ' order by c.conname)
  into offenders
  from pg_constraint c
  join pg_namespace n on n.oid = c.connamespace
  where n.nspname = 'public' and c.conname ~* retired;
  if offenders is not null then
    raise exception 'retired vocabulary survives in constraints: %', offenders;
  end if;

  -- Includes the indexes backing the two primary keys above; they follow their
  -- constraints, so this is eight names before the DDL and none after.
  select string_agg(indexname, ', ' order by indexname) into offenders
  from pg_indexes
  where schemaname = 'public' and indexname ~* retired;
  if offenders is not null then
    raise exception 'retired vocabulary survives in indexes: %', offenders;
  end if;

  select string_agg(format('%s on %s', policyname, tablename), ', ' order by policyname)
  into offenders
  from pg_policies
  where schemaname = 'public' and policyname ~* retired;
  if offenders is not null then
    raise exception 'retired vocabulary survives in policies: %', offenders;
  end if;

  select string_agg(format('%s on %s', t.tgname, t.tgrelid::regclass), ', ' order by t.tgname)
  into offenders
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal and t.tgname ~* retired;
  if offenders is not null then
    raise exception 'retired vocabulary survives in triggers: %', offenders;
  end if;

  -- Comments, minus three tables named here rather than hidden in a pattern.
  -- `services` and `business_model` each record the rename that produced them;
  -- a historical note that names the old table is the opposite of stale.
  -- `evidence` is THE permanent exemption: its comment says "proposition
  -- questions", which is the surviving concept — the three validation
  -- questions really are propositions — and not the retired table.
  select string_agg(
           format('%s%s', c.relname, coalesce('.' || a.attname, ' (table)')),
           ', ' order by c.relname)
  into offenders
  from pg_description d
  join pg_class c on c.oid = d.objoid
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attribute a on a.attrelid = c.oid and a.attnum = d.objsubid
  where d.classoid = 'pg_class'::regclass
    and n.nspname = 'public'
    and d.description ~* retired
    and not (d.objsubid = 0
             and d.objoid in ('public.services'::regclass,
                              'public.business_model'::regclass,
                              'public.evidence'::regclass));
  if offenders is not null then
    raise exception 'retired vocabulary survives in comments: %', offenders;
  end if;

  -- The rest of pg_description, for OUR schemas only: functions, the status
  -- domain, the schema notes. Restricted by namespace on purpose — the same
  -- catalogue carries every built-in comment Postgres ships, and a substring
  -- sweep over those would fail on words somebody else chose.
  select string_agg(label, ', ' order by label) into offenders
  from (
    select p.proname as label
    from pg_description d
    join pg_proc p on p.oid = d.objoid
    join pg_namespace n on n.oid = p.pronamespace
    where d.classoid = 'pg_proc'::regclass
      and n.nspname in ('public', 'semantic_search', 'archive')
      and d.description ~* retired
    union all
    select t.typname
    from pg_description d
    join pg_type t on t.oid = d.objoid
    join pg_namespace n on n.oid = t.typnamespace
    where d.classoid = 'pg_type'::regclass
      and n.nspname in ('public', 'semantic_search', 'archive')
      and d.description ~* retired
    union all
    select 'schema ' || n.nspname
    from pg_description d
    join pg_namespace n on n.oid = d.objoid
    where d.classoid = 'pg_namespace'::regclass
      and n.nspname in ('public', 'semantic_search', 'archive')
      and d.description ~* retired
  ) swept(label);
  if offenders is not null then
    raise exception 'retired vocabulary survives in non-table comments: %', offenders;
  end if;
end
$do$;

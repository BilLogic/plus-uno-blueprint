-- The Service panel writes its examples column, and nothing else does.
--
-- #312 (parent #302) gives the Service panel an "Examples" section: six
-- free-text inputs, one per core kind, authored together and persisted to
-- `services.entity_examples` by `updateServiceEntityExamples`
-- (serviceSpecMutations.ts). That mutation is a DIRECT table update, not a
-- SECURITY DEFINER RPC — so it writes under the caller's own grants, and the
-- column needs a place on the panel-writes surface or the save is refused.
--
-- ── Why a NEW file, and not a line in the sweep ────────────────────────────
--
-- `20260830290000_a_panel_writes_its_own_columns.sql` revoked every table-level
-- UPDATE and re-granted, column by column, exactly what a panel writes. That
-- file is frozen: it already ran on production, and `rls-posture.test.mjs`
-- reads its VALUES list as text to hold `PANEL_COLUMNS` to it. `entity_examples`
-- did not exist when it ran — the column arrived in `20260902210000` — so the
-- grant is a genuinely new row rather than a rename of an existing one, and it
-- lands additively here. The sweep's posture is untouched: this adds one
-- content column to one table and revokes nothing.
--
-- ── Not a key, so not a reparent ───────────────────────────────────────────
--
-- `entity_examples` is a jsonb content column — no primary or foreign key rides
-- in it — so granting UPDATE on it moves no row anywhere. It is the same kind
-- of grant `services.summary` already holds: the panel's own words about the
-- service, written in place.
--
-- ── Replaying against a partial or empty schema ────────────────────────────
--
-- The grant is joined against `information_schema.columns`, exactly as the
-- sweep's section 2 is, so a replay in which `services.entity_examples` is
-- absent skips it rather than raising — the shape the rolled-back rehearsals
-- and the empty-database replay both need. The proof is a CONDITIONAL
-- invariant for the same reason: where the column exists, `authenticated` must
-- be able to UPDATE it; where it does not, there is nothing to prove.

-- ── Grant the one column ───────────────────────────────────────────────────

do $$
declare
  r record;
begin
  for r in
    select p.table_name,
           string_agg(quote_ident(p.column_name), ', ' order by p.column_name) as columns
      from (values
        -- serviceSpecMutations.ts — updateServiceEntityExamples
        ('services', 'entity_examples')
      ) as p(table_name, column_name)
      join information_schema.columns c
        on c.table_schema = 'public'
       and c.table_name = p.table_name
       and c.column_name = p.column_name
      join pg_class rel on rel.relname = p.table_name and rel.relkind in ('r', 'p')
      join pg_namespace ns on ns.oid = rel.relnamespace and ns.nspname = 'public'
     group by p.table_name
  loop
    execute format(
      'grant update (%s) on public.%I to authenticated',
      r.columns, r.table_name
    );
  end loop;
end
$$;

-- ── Prove it ───────────────────────────────────────────────────────────────
--
-- An invariant, not a census: where the column is present the grant must have
-- taken, and a schema that lacks the column reads this the same way an applied
-- one does — by having nothing to fail on.

do $proof$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'services'
       and column_name = 'entity_examples'
  ) and not has_column_privilege(
    'authenticated', 'public.services', 'entity_examples', 'UPDATE'
  ) then
    raise exception
      'proof: authenticated cannot UPDATE public.services.entity_examples; the grant did not take';
  end if;
end
$proof$;

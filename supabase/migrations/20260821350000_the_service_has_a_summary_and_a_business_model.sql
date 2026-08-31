-- Plan 002 phase 3, unpinned with the service tier.
--
-- `propositions` means the opposite scope to the one word it shares with
-- `cells.value_props`: a value proposition is what ONE cell offers ONE
-- audience; this table is how the whole service is funded and paid for. Two
-- readings of one word, one level apart, is the kind of collision that gets
-- answered wrongly rather than noticed. The table is empty, so it costs
-- nothing.

alter table public.propositions rename to business_model;

comment on table public.business_model is
  'How the service is funded, priced and delivered. One row per service. Renamed from `propositions` on 2026-08-21 — that word already meant a cell''s value proposition, which is a different thing at a different level.';

-- `services.description` was the last `description` on the board: scenarios,
-- phases, steps, cells and paths all say `summary`. Plan 002 phase 2 renamed
-- the others and missed this one, because the table was then called
-- `service_lifecycles` and nothing read it.

alter table public.services rename column description to summary;

comment on column public.services.summary is
  'What this service is, in the words a newcomer needs. The one field above the business model in the service panel.';

insert into public.business_model (service_id)
select s.id from public.services s
where not exists (select 1 from public.business_model b where b.service_id = s.id);

do $$
declare n int;
begin
  select count(*) into n from information_schema.tables
  where table_schema = 'public' and table_name = 'propositions';
  if n > 0 then raise exception 'propositions survived'; end if;

  select count(*) into n from information_schema.columns
  where table_schema = 'public' and table_name = 'services' and column_name = 'description';
  if n > 0 then raise exception 'services.description survived'; end if;

  -- AMENDED 2026-08-31. A census — `expected 1 business model row` — stood
  -- here, counting production's single service on the day. On an empty
  -- database there are no services, the insert above adds nothing, and this
  -- raises; because a migration is one transaction the TWO RENAMES ABOVE ROLL
  -- BACK with it, which is why `20260821360000` reports `column "summary" of
  -- relation "services" does not exist` and `20260826110000` reports `relation
  -- "public.business_model" does not exist` on a replay. One census, three
  -- files.
  --
  -- The rule is `20260821340000`'s: amend an applied migration only where
  -- leaving it is actively harmful, and an assertion that disables the only
  -- instrument this repository has for #148 is that case. Both renames ran in
  -- production long ago; this changes only whether anything can check.
  --
  -- What replaces it is the invariant it was reaching for: the insert left no
  -- service without a business model. Vacuously true on an empty database, and
  -- on production exactly as strong, where the one service had to receive one.
  select count(*) into n from services s
  where not exists (select 1 from business_model b where b.service_id = s.id);
  if n > 0 then raise exception '% services have no business model row', n; end if;

  select count(*) into n from information_schema.columns
  where table_schema = 'public' and column_name = 'description'
    and table_name in ('services','phases','scenarios','steps','cells','paths','lanes');
  if n > 0 then raise exception '% blueprint tables still say description', n; end if;
end $$;

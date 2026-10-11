-- A finding says what fixing it is worth, and what fixing it costs.
--
-- Authored 2026-10-11.
--
-- The template gave every audit finding two more ratings beside severity in
-- `21000303000000_a_finding_says_what_fixing_it_is_worth.sql`, and the code
-- that reads and writes them arrives here through the version pin: the
-- auditor rates each finding, `create_finding` refuses one without both
-- ratings, and `list_findings` groups the ledger Do first, Plan, Quick wins
-- and Later. The columns do not arrive with the pin, because this deployment
-- is a separate Postgres with its own series. So the same change is made
-- again here, against this database.
--
-- Each rating is `low | medium | high`:
--
--   impact   how much fixing it matters to the service
--   effort   how much work the fix takes
--
-- Both are nullable. The findings already in the ledger were recorded before
-- the ratings existed, and inventing one for them would put a judgement in
-- the ledger that no auditor made; they read as unrated and sort last until
-- an audit re-run rates them.
--
-- `authenticated` holds insert on the whole table, so it can write the new
-- columns on a new finding already. Its update grant is column-narrowed to
-- what an audit re-run rewrites, and a re-run whose only change is a rating
-- must move that rating rather than raise a twin, so the two new columns
-- join it.

alter table public.audit_findings
  add column impact text
    constraint audit_findings_impact_check check (impact in ('low', 'medium', 'high')),
  add column effort text
    constraint audit_findings_effort_check check (effort in ('low', 'medium', 'high'));

comment on column public.audit_findings.impact is
  'How much fixing this finding matters to the service: low, medium or high. '
  'Null on a finding recorded before the rating existed, which reads as unrated.';

comment on column public.audit_findings.effort is
  'How much work the fix takes: low, medium or high. Null on a finding '
  'recorded before the rating existed, which reads as unrated.';

grant update (impact, effort) on public.audit_findings to authenticated;

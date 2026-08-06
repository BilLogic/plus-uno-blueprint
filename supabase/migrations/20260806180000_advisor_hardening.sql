-- Advisor hardening, per the access-model plan
-- (docs/plans/2026-08-06-001-plan-access-model-three-personas.md).
-- Already applied to the hosted project as `advisor_hardening_2026_08_06`
-- and `revoke_flag_founding_from_public`; committed here so a rebuilt
-- environment (local stack, branch DB) does not silently regress the
-- hardening. Every statement is idempotent.

-- 1. evidence_counts: evidence rows are deliberately public (anon SELECT
--    policy, decision F3 2026-08-06), so the view's owner-rights execution
--    guarded nothing. Run it as the querying user.
alter view public.evidence_counts set (security_invoker = true);

-- 2. search_blueprint was the one function without a pinned search_path.
alter function public.search_blueprint(q text)
  set search_path = public, pg_catalog, pg_temp;

-- 3. flag_founding_service_accounts is an operator routine; it has no
--    business on the public REST surface. The grant that exposed it was
--    the PUBLIC default (a per-role revoke alone is a no-op).
revoke execute on function public.flag_founding_service_accounts() from public;
revoke execute on function public.flag_founding_service_accounts()
  from anon, authenticated;
grant execute on function public.flag_founding_service_accounts()
  to service_role;

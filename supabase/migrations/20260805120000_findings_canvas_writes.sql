-- Canvas write parity for sb:audit / sb:whatif: the in-app agent (dev auth
-- user) records and triages findings directly, same as the IDE flow's
-- service-key writes. anon keeps read-only — the deployed app is unchanged.
-- Delete stays revoked everywhere: supersede/triage are status flips, and
-- findings_open_fingerprint_idx remains the dedupe backstop.

create policy "findings_insert_auth" on public.findings
  for insert to authenticated with check (true);

grant insert, update on public.findings to authenticated;

comment on table public.findings is
  'Audit / whatif / import-sweep outputs. Written by skills (IDE service key or canvas authenticated agent); humans triage by status.';

-- Evidence is display content, and the deployed app is a read-only viewer:
-- every other content table (cells, slices) already grants anon SELECT.
-- Evidence being authenticated-only was an omission, and it surfaced as
-- "permission denied for table evidence" in the panel's Evidence tab for
-- every visitor. Writes stay authenticated-only, unchanged.
grant select on public.evidence to anon;
create policy evidence_select_anon on public.evidence
  for select to anon using (true);

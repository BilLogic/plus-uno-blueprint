-- The paths comment lets a link cross paths.
--
-- Authored 2026-11-01.
--
-- `20260902200000` commented `paths` with "Nothing connects across paths".
-- Since `20261031160000` that is false: a link may join cells on any path or
-- scenario of one service. `schema_comments()` hands the comment to agents as
-- what the table means, so the sentence is replaced with the rule the two
-- link writers enforce. The rest of the comment is unchanged.

comment on table public.paths is
  'One route through a scenario: happy, variant or exception (kind), and how far along it is (status). A link may join cells on any path or scenario of the same service; a path is a detour, not a stage.';

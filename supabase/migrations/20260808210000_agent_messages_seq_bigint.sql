-- agent_messages.seq: integer → bigint.
--
-- The app writes seq as a per-boot epoch base (Date.now()*1000 + index) so
-- two tabs on one session land in disjoint ranges instead of upserting over
-- each other's rows at 0..n. Those values exceed int4; ordering semantics
-- are unchanged (order by seq), and existing small legacy seqs keep sorting
-- first. Pure type widening: no data rewrite beyond the cast, RLS and
-- grants untouched.

alter table public.agent_messages
  alter column seq type bigint;

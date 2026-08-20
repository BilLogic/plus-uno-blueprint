-- blueprint_hybrid_search served as the fused retriever's name for one day
-- (2026-08-19) while the legacy search_blueprint still held the good name.
-- The portal now answers as public.search_blueprint and uno-bot r71 calls it
-- there (verified: retrieval evals 26/26 against r71 before this drop), so
-- the transitional name goes. One function, one name, every consumer.
drop function if exists public.blueprint_hybrid_search(text, extensions.vector, int, text, int);

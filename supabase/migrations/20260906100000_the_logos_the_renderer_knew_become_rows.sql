-- The logos the renderer knew become rows.
--
-- `20260905100000` added `touchpoints.icon_url` and deliberately seeded
-- nothing: "the URLs are this deployment's own asset paths, which is a data
-- decision rather than a schema one", and it named the read side as the slice
-- that would arrive later. This is that slice's data half (#325 S5).
--
-- The read side retires `TECH_ITEM_DETAIL_PICTURES` from
-- `src/lib/blueprintTechPictures.ts` — a table of nine tool NAMES matched
-- against nine asset paths, inside the renderer, where no author could see it,
-- set it or find out why their cell drew differently from the one beside it.
-- The converged resolver reads `touchpoints.icon_url` through the placement
-- instead, which is the same fact stored where a person can edit it.
--
-- ── Why the seed is not optional ─────────────────────────────────────────
--
-- Production was measured before the table was deleted, and the answer is the
-- reason this file exists:
--
--   select count(*), count(icon_url) from touchpoints;   -- 93, 0
--
-- Ninety-three registry rows, and NOT ONE carries an icon. Meanwhile 126 of
-- the 359 placements name a touchpoint the retired table covered. Deleting the
-- table without this backfill would blank a logo that is on screen today for
-- roughly a third of every placement in the deployment — a silent render
-- regression dressed as a refactor.
--
-- ── Six names, not nine ──────────────────────────────────────────────────
--
-- The retired table had nine keys. Only six of them are things this registry
-- actually calls something:
--
--   Zoom, Email, Notion, Slack, Workday, Figma          -- 126 placements
--   Google Form Application, Shift Swap Google Form,
--   Google Quizzes                                      -- 0 rows, 0 placements
--
-- The registry spells the last three `Google Form` and `Google Quiz`, so those
-- three keys have never matched anything and never drew a glyph. They are not
-- seeded here: giving them an icon would ADD a picture where none has ever
-- shown, which is a content decision for whoever owns the board, made in the
-- panel, not smuggled in under a refactor. The rule this file follows is
-- narrow on purpose — keep exactly what production draws today.
--
-- ── Idempotent, and it never overwrites an author ────────────────────────
--
-- `where icon_url is null` on every statement. A re-run changes nothing, and
-- an icon somebody has since authored through the panel is never replaced by
-- the value the old renderer would have guessed.
--
-- ── Replaying against an empty database ──────────────────────────────────
--
-- Data only. On an empty database every update matches zero rows and the file
-- is a no-op, so it replays clean and does not join
-- `docs/reference/migration-replay-baseline.json`.
--
-- The proof is an INVARIANT, never a census (ADR 0009): no touchpoint bearing
-- one of these six names is left without an icon. That is vacuously true of an
-- empty replay's zero rows, and on the populated target it is the evidence
-- that the backfill reached every row the retired table used to answer for.
-- It counts nothing, so it cannot go stale when a name is added or retired.

update public.touchpoints as t
   set icon_url = seed.icon_url,
       updated_at = now()
  from (values
    ('Zoom',    '/touchpoint-logos/zoom-logo.png'),
    ('Email',   '/touchpoint-logos/email-logo.png'),
    ('Notion',  '/touchpoint-logos/notion-logo.png'),
    ('Slack',   '/touchpoint-logos/slack-logo.png'),
    ('Workday', '/touchpoint-logos/workday-logo.png'),
    ('Figma',   '/touchpoint-logos/figma-logo.png')
  ) as seed(name, icon_url)
 where t.name = seed.name
   and t.icon_url is null;

do $proof$
declare
  v_unseeded text[];
begin
  select coalesce(array_agg(t.name order by t.name), '{}')
    into v_unseeded
    from public.touchpoints t
   where t.name in ('Zoom', 'Email', 'Notion', 'Slack', 'Workday', 'Figma')
     and coalesce(btrim(t.icon_url), '') = '';

  if array_length(v_unseeded, 1) is not null then
    raise exception
      'proof: % still carries no icon, so retiring the renderer''s table would blank a logo that is drawn today',
      array_to_string(v_unseeded, ', ');
  end if;
end
$proof$;

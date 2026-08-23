-- Every cell on the board now carries a summary, and no summary carries a
-- citation.
--
-- Five agents wrote this content in place, one phase or scenario each, so the
-- statements are not reproduced here — there are ~790 of them and their text
-- IS the deliverable, not a transformation of something else. What this file
-- records is the shape of the result and the assertions that hold it:
--
--   788 cells summarised, 0 empty outside the storyboard lanes (was 338 empty)
--   485 distinct summaries across those 788 — the repetition is deliberate,
--       one sentence per MOMENT applied across the path variants of a scenario
--   0 summaries carrying a servlet name, a .jsp path, a card or PR number, a
--       sweep citation, a Metabase reference or a Figma node id (was 46)
--   344 cells carrying links, up from 307 — that is where the citations went
--
-- The content itself lives in the database and is exported by
-- `scripts/authored_fields.mjs`, whose field list was widened in this same
-- window to include `content`, `summary`, `links` and `maturity` precisely
-- because none of this would otherwise survive a `supabase:reset`.
--
-- Two corrections were made during the pass and both are worth remembering:
--
--   * A summary must never be propagated by content alone. Doing it keyed on
--     `(content, lane_role)` put "The Fill-In tab." on 44 Goal Setting cells.
--     See spec-house-style.md, "A pill's summary belongs to its STEP".
--   * Postgres `~*` does not support `\b`. It means backspace, not a word
--     boundary, and a regex using it silently under-matches.

begin;

do $$
declare n int; bad text;
begin
  select count(*) into n from cells c join lanes l on l.id=c.lane_id
   where coalesce(c.summary,'') = '' and l.lane_role is distinct from 'visual';
  if n > 0 then raise exception '% cells outside the storyboard say nothing', n; end if;

  select count(*) into n from cells
   where summary ~ '(Servlet|\.jsp|\.js:|Card [0-9]|PR #[0-9]|sweep [0-9]|Metabase|Figma [0-9])';
  if n > 0 then
    select string_agg(left(summary, 60), ' | ') into bad from cells
     where summary ~ '(Servlet|\.jsp|\.js:|Card [0-9]|PR #[0-9]|sweep [0-9]|Metabase|Figma [0-9])';
    raise exception 'provenance is in % summaries, not links: %', n, bad;
  end if;

  -- A summary that repeats its own cell reads as filled and says nothing.
  select count(*) into n from cells
   where trim(coalesce(content,'')) <> ''
     and lower(trim(coalesce(summary,''))) = lower(trim(content));
  if n > 0 then raise exception '% summaries just restate their cell', n; end if;

  -- Unbuilt cells keep their maturity marker after the card number moved out.
  select count(*) into n from cells where maturity = 'in_progress' and summary not like '%PLANNED%';
  if n > 0 then raise exception '% in-progress cells lost their marker', n; end if;
  select count(*) into n from cells where maturity = 'explored' and summary not like '%PROTOTYPE%';
  if n > 0 then raise exception '% explored cells lost their marker', n; end if;
end $$;

commit;

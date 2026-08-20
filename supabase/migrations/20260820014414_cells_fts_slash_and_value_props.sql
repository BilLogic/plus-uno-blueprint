-- search_tsv v2: fix the slash-token recall defect, and index value_props.
--
-- Postgres's parser classifies "Zoom/Pencil" as a FILE token (ts_debug: 'file',
-- "File or path name") and indexes it as the single lexeme 'zoom/pencil' — so
-- searching "Zoom" reached 29 cells while 113 mention it, and "Pencil" reached
-- 1 of 87. Hyphens are already handled correctly (compound + parts), so only
-- '/' needs help: append a slash-stripped copy of the prose when a slash is
-- present. Appending (never replacing) means every lexeme the old column
-- produced still exists — measured zero cells lost, fee/feedback false
-- positives still zero, and distinct lexemes DROP (compounds collapse into
-- existing tokens).
--
-- value_props joins the indexed text: it was in the vector chunk but not the
-- FTS, an asymmetry with no upside. 11 cells today; harmless and correct.
--
-- A generated column's expression cannot be altered in place: drop + re-add
-- (the GIN index goes down with the column). 955 rows; the rewrite is trivial.
alter table public.cells drop column if exists search_tsv;

alter table public.cells
  add column search_tsv tsvector
  generated always as (
    to_tsvector(
      'english',
      coalesce(content, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(function, '') || ' ' ||
      coalesce(form, '') || ' ' ||
      coalesce(owner, '') || ' ' ||
      coalesce(perceived_owner, '') || ' ' ||
      coalesce(value_props::text, '') ||
      case when (coalesce(content,'') || coalesce(description,'')) like '%/%'
           then ' ' || translate(coalesce(content,'') || ' ' || coalesce(description,''), '/', ' ')
           else '' end
    )
  ) stored;

create index cells_search_tsv_idx on public.cells using gin (search_tsv);

comment on column public.cells.search_tsv is
  'Generated FTS vector over the cell''s own prose + spec columns, with a slash-stripped copy appended so "Zoom/Pencil"-style compounds match their parts (the parser treats a/b as a filename and indexes it whole). Consumed by public.search_blueprint.';

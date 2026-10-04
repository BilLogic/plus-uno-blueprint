-- The icon comment names no ticket and no retired name.
--
-- Authored 2026-10-04.
--
-- `20260905100000` commented `touchpoints.icon_url` with the column's meaning,
-- then a ticket reference and the template's migration under the project's
-- retired short name. `schema_comments()` hands that text to agents as what
-- the column means, so the references travel with it, and neither says
-- anything an agent can act on. The template re-issued its own comment on
-- this column for the same reason.
--
-- So the comment is issued again with the meaning alone, and asserted to have
-- landed. The meaning is unchanged; only the two references go. On a
-- database that already carries this text the statement changes nothing; on
-- an empty replay it is the second write of the column's comment.
--
-- The text is stated once, in the block below, so the write and its proof
-- cannot disagree. It is a comment on a plain column, so it runs anywhere the
-- column exists.

do $icon_comment$
declare
  v_comment constant text :=
    'A stable URL for the touchpoint''s stock icon or logo — the mark a '
    'well-known tool shows in the detail panel. A property of the thing the '
    'deployment owns, authored once per name, never per placement. Blueprint '
    'data rather than app configuration: null draws nothing, and the renderer '
    'reads this row instead of matching a tool name against a table baked into '
    'code. Matches the template''s column of the same name so a re-map '
    'round-trips.';
  v_attnum smallint;
begin
  execute format('comment on column public.touchpoints.icon_url is %L', v_comment);

  select attnum into v_attnum
    from pg_attribute
   where attrelid = 'public.touchpoints'::regclass
     and attname = 'icon_url'
     and not attisdropped;

  if col_description('public.touchpoints'::regclass, v_attnum) is distinct from v_comment then
    raise exception 'proof: touchpoints.icon_url does not carry the current comment';
  end if;
end
$icon_comment$;

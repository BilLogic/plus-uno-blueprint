-- A slice write is all-or-nothing: a failed replace no longer empties the slice.
--
-- Authored 2026-10-12.
--
-- The template made both slice writes one call and one transaction in
-- `21000304000000_a_slice_write_is_all_or_nothing.sql`, and the code that
-- calls them arrives here through the version pin: the editor's Save and the
-- agent's slice tools post to `replace_slides` and `create_slice` rather than
-- reading, deleting and inserting over separate PostgREST requests. The
-- functions do not arrive with the pin, because this deployment is a separate
-- Postgres with its own series. So the same change is made again here,
-- against this database.
--
--   replace_slides(p_slice_id, p_slides)   swaps a slice's slides, and their
--                                          `slide_images`, whole
--   create_slice(…, p_slides)              writes a slice and its slides
--
-- The bodies are the template's. Every table and column they touch stands
-- here as it does there — `slices`, `slides` and `slide_images`, with the
-- image rows cascading on their slide — and both are SECURITY DEFINER behind
-- this database's `is_service_account()`, so the guard in each body is the
-- whole of who may author. A refusal anywhere raises, and nothing the call
-- wrote survives it. `replace_slides` returns the slides it deleted, as they
-- stood under the lock, which is what `restore_slides` writes back.
--
-- Two function definitions; no rows are read or moved.

-- ── The replace ────────────────────────────────────────────────────────────

create or replace function public.replace_slides(
  p_slice_id uuid,
  p_slides   jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $function$
declare
  v_previous jsonb;
  v_slide    jsonb;
  v_ordinal  bigint;
  v_cell     text;
  v_slide_id uuid;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint' using errcode = '42501';
  end if;

  if p_slides is null or jsonb_typeof(p_slides) <> 'array' then
    raise exception 'A slice''s slides are written as a list of slides — nothing was written.';
  end if;

  -- Locked, so the capture below is the state the delete removes and no other
  -- write can slip a slide in between the two.
  perform 1 from public.slices where id = p_slice_id for update;
  if not found then
    raise exception 'That slice no longer exists — nothing was written.';
  end if;

  -- Before the delete, or there is nothing left to capture. Each row whole,
  -- with its image set, in the order `position` already encodes.
  select coalesce(jsonb_agg(
           to_jsonb(s) || jsonb_build_object(
             'slide_images',
             coalesce((select jsonb_agg(to_jsonb(i) order by i.position)
                         from public.slide_images i
                        where i.slide_id = s.id), '[]'::jsonb))
           order by s.position), '[]'::jsonb)
    into v_previous
    from public.slides s
   where s.slice_id = p_slice_id;

  -- `slide_images` cascade with their slide.
  delete from public.slides where slice_id = p_slice_id;

  for v_slide, v_ordinal in
    select value, ordinality from jsonb_array_elements(p_slides) with ordinality
  loop
    if jsonb_typeof(v_slide) <> 'object' then
      raise exception 'Slide % is not a slide — nothing was written.', v_ordinal;
    end if;

    -- Said in a sentence rather than left to the uuid cast, whose message
    -- names a type and no slide. A cell id is a soft reference with no
    -- foreign key, so its shape is the one thing the database can hold it to.
    for v_cell in
      select jsonb_array_elements_text(coalesce(v_slide -> 'cell_ids', '[]'::jsonb))
    loop
      if v_cell !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Slide % names a cell that is not an id (%) — nothing was written.',
          v_ordinal, v_cell;
      end if;
    end loop;

    insert into public.slides (
      id, slice_id, position, cell_ids, cell_keys, title, caption, shows_all_images
    )
    values (
      coalesce((v_slide ->> 'id')::uuid, gen_random_uuid()),
      p_slice_id,
      v_ordinal - 1,
      array(select jsonb_array_elements_text(coalesce(v_slide -> 'cell_ids', '[]'::jsonb)))::uuid[],
      -- A slide sent without keys records its cell ids as them, which is what
      -- a human-authored slide has always stored there.
      array(select jsonb_array_elements_text(
        coalesce(v_slide -> 'cell_keys', v_slide -> 'cell_ids', '[]'::jsonb))),
      nullif(btrim(coalesce(v_slide ->> 'title', '')), ''),
      nullif(btrim(coalesce(v_slide ->> 'caption', '')), ''),
      coalesce((v_slide ->> 'shows_all_images')::boolean, true)
    )
    returning id into v_slide_id;

    insert into public.slide_images (slide_id, position, cell_id, image_url)
    select v_slide_id,
           (member ->> 'position')::int,
           (member ->> 'cell_id')::uuid,
           member ->> 'image_url'
      from jsonb_array_elements(coalesce(v_slide -> 'images', '[]'::jsonb)) as member;
  end loop;

  return jsonb_build_object(
    'slice_id', p_slice_id,
    'slide_count', jsonb_array_length(p_slides),
    'previous', v_previous
  );
end
$function$;

comment on function public.replace_slides(uuid, jsonb) is
  'Replace a slice''s slides, and their slide_images, whole and in one transaction. '
  'Each element of p_slides is one slide in order: cell_ids, cell_keys, title, '
  'caption, shows_all_images, images, and optionally the id it keeps. A refusal '
  'anywhere leaves the prior slides as they were. Returns previous: the deleted '
  'slides with their image sets as they stood, which restore_slides writes back.';

-- ── The create ─────────────────────────────────────────────────────────────

create or replace function public.create_slice(
  p_service_id uuid,
  p_title      text,
  p_summary    text,
  p_kind       text,
  p_actor      text,
  p_slides     jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $function$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_slice public.slices;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint' using errcode = '42501';
  end if;

  if v_title = '' then
    raise exception 'A slice needs a title — nothing was written.';
  end if;

  -- `human`: this slice was authored here, so the slice skill never
  -- regenerates over it. Blank prose is stored as null, the house rule.
  insert into public.slices (service_id, title, summary, kind, actor, authorship)
  values (
    p_service_id,
    v_title,
    nullif(btrim(coalesce(p_summary, '')), ''),
    p_kind,
    nullif(btrim(coalesce(p_actor, '')), ''),
    'human'
  )
  returning * into v_slice;

  -- Inside this transaction: a refusal there takes the slice row with it.
  perform public.replace_slides(v_slice.id, coalesce(p_slides, '[]'::jsonb));

  select * into v_slice from public.slices where id = v_slice.id;
  return to_jsonb(v_slice);
end
$function$;

comment on function public.create_slice(uuid, text, text, text, text, jsonb) is
  'Create a human-authored slice and its slides in one transaction. p_slides is '
  'the list replace_slides takes. A refusal anywhere leaves no slice row behind. '
  'Returns the slice row.';

-- Who may call them.
--
-- The posture every authoring function here takes: closed to
-- `public` and `anon`, open to `authenticated`, with the guard in the body
-- deciding which authenticated caller may actually author.
revoke execute on function public.replace_slides(uuid, jsonb) from public, anon;
grant execute on function public.replace_slides(uuid, jsonb) to authenticated;
revoke execute on function public.create_slice(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.create_slice(uuid, text, text, text, text, jsonb) to authenticated;

do $proof$
begin
  if has_function_privilege('anon', 'public.replace_slides(uuid, jsonb)', 'execute') then
    raise exception 'proof: anon can call replace_slides';
  end if;
  if has_function_privilege('anon',
       'public.create_slice(uuid, text, text, text, text, jsonb)', 'execute') then
    raise exception 'proof: anon can call create_slice';
  end if;
end
$proof$;

-- ── Prove the functions' posture ──────────────────────────────────────────
--
-- SECURITY DEFINER, because the guard in each body is what decides who may
-- author; and present with the arguments the client posts, since PostgREST
-- resolves a call by its keys.

do $proof$
declare
  v_signature text;
  v_definer   boolean;
begin
  foreach v_signature in array array[
    'public.replace_slides(uuid, jsonb)',
    'public.create_slice(uuid, text, text, text, text, jsonb)'
  ] loop
    select p.prosecdef into v_definer
      from pg_proc p
     where p.oid = to_regprocedure(v_signature);

    if v_definer is null then
      raise exception 'proof: % was not created', v_signature;
    end if;
    if not v_definer then
      raise exception
        'proof: % must be SECURITY DEFINER — the guard in its body is what decides who may author',
        v_signature;
    end if;
  end loop;
end
$proof$;

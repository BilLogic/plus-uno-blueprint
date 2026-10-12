-- Undoing a slice replace is all-or-nothing: a failed undo no longer empties the slice.
--
-- Authored 2026-10-12.
--
-- The template made the undo of a slice replace one transaction in
-- `21000305000000_undoing_a_slice_replace_is_all_or_nothing.sql`: the session
-- ledger's revert, arriving here through the version pin, posts the
-- `previous` a `replace_slides` call returned to `restore_slides` rather than
-- deleting and re-inserting over separate PostgREST requests. The function
-- does not arrive with the pin, so it is made again here, against this
-- database.
--
--   restore_slides(p_slice_id, p_rows)   puts a slice's captured slides, and
--                                        their `slide_images`, back whole
--
-- The body is the template's. It writes each captured slide back column for
-- column — id, position and stamps included — under the slice the call
-- names, and returns `dropped`: the ids of the slides it removed that the
-- capture does not put back, whose upload folders the client sweeps after the
-- commit. SECURITY DEFINER behind `is_service_account()`, as the replace is.
--
-- One function definition; no rows are read or moved.

create or replace function public.restore_slides(
  p_slice_id uuid,
  p_rows     jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $function$
declare
  v_row     jsonb;
  v_ordinal bigint;
  v_dropped jsonb;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint' using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'A slice''s slides are written back as a list of slides — nothing was written.';
  end if;

  -- Locked, as the replace locks it, so nothing slips a slide in between the
  -- read of what is there and the delete of it.
  perform 1 from public.slices where id = p_slice_id for update;
  if not found then
    raise exception 'That slice no longer exists — nothing was written.';
  end if;

  select coalesce(jsonb_agg(s.id order by s.position), '[]'::jsonb)
    into v_dropped
    from public.slides s
   where s.slice_id = p_slice_id
     and s.id::text not in (
       select r ->> 'id' from jsonb_array_elements(p_rows) r
        where jsonb_typeof(r) = 'object' and r ->> 'id' is not null);

  -- `slide_images` cascade with their slide.
  delete from public.slides where slice_id = p_slice_id;

  for v_row, v_ordinal in
    select value, ordinality from jsonb_array_elements(p_rows) with ordinality
  loop
    if jsonb_typeof(v_row) <> 'object' or coalesce(v_row ->> 'id', '') = '' then
      raise exception 'Captured slide % has no id — nothing was written.', v_ordinal;
    end if;

    -- Named columns, as `replace_slides` writes them: a positional `.*`
    -- would put a value in whichever column a later migration added in its
    -- place.
    insert into public.slides (
      id, slice_id, position, cell_ids, cell_keys, title, caption,
      shows_all_images, created_at, created_by, updated_at
    )
    select r.id, p_slice_id, r.position, r.cell_ids, r.cell_keys, r.title, r.caption,
           r.shows_all_images, r.created_at, r.created_by, r.updated_at
      from jsonb_populate_record(null::public.slides, v_row - 'slide_images') as r;

    insert into public.slide_images (id, slide_id, position, cell_id, image_url)
    select coalesce((member ->> 'id')::uuid, gen_random_uuid()),
           (v_row ->> 'id')::uuid,
           (member ->> 'position')::int,
           (member ->> 'cell_id')::uuid,
           member ->> 'image_url'
      from jsonb_array_elements(coalesce(v_row -> 'slide_images', '[]'::jsonb)) as member;
  end loop;

  return jsonb_build_object(
    'slice_id', p_slice_id,
    'slide_count', jsonb_array_length(p_rows),
    'dropped', v_dropped
  );
end
$function$;

comment on function public.restore_slides(uuid, jsonb) is
  'Write a slice''s captured slides, and their slide_images, back whole and in '
  'one transaction: p_rows is the previous a replace_slides call returned. A '
  'refusal anywhere leaves the slice as it stood. Returns dropped: the ids of '
  'the slides it removed that the capture does not restore.';

-- Who may call it.
--
-- The posture of `replace_slides` and `create_slice`: closed to `public` and
-- `anon`, open to `authenticated`, with the guard in the body deciding which
-- authenticated caller may actually author.
revoke execute on function public.restore_slides(uuid, jsonb) from public, anon;
grant execute on function public.restore_slides(uuid, jsonb) to authenticated;

do $proof$
begin
  if has_function_privilege('anon', 'public.restore_slides(uuid, jsonb)', 'execute') then
    raise exception 'proof: anon can call restore_slides';
  end if;
end
$proof$;

-- ── Prove the function's posture ──────────────────────────────────────────

do $proof$
declare
  v_definer boolean;
begin
  select p.prosecdef into v_definer
    from pg_proc p
   where p.oid = to_regprocedure('public.restore_slides(uuid, jsonb)');

  if v_definer is null then
    raise exception 'proof: public.restore_slides(uuid, jsonb) was not created';
  end if;
  if not v_definer then
    raise exception
      'proof: public.restore_slides(uuid, jsonb) must be SECURITY DEFINER — the guard in its body is what decides who may author';
  end if;
end
$proof$;

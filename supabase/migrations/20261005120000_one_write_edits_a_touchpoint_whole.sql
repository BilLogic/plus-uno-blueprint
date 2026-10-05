-- One write edits a touchpoint whole: its name, kind, summary, link and icon.
--
-- Authored 2026-10-05.
--
-- The template added `update_touchpoint` in
-- `21000301000000_one_write_edits_a_touchpoint_whole.sql`, and the dialog that
-- calls it arrives here through the version pin: Edit touchpoint saves the
-- registry entry's five fields with one RPC, and uploads an icon into
-- `cell-attachments` under `touchpoints/<touchpoint id>/`. The schema does not
-- arrive with the pin, because this deployment is a separate Postgres with its
-- own series. So the same change is made again here, against this database.
--
-- Until now nothing here wrote four of the five fields. `rename_touchpoint`
-- (`20260830220000`) moves the name and the word in every bearing cell;
-- `kind`, `summary`, `url` and `icon_url` had no writer, so the stock logos
-- this deployment seeds could not be changed or removed by an author. Saving
-- the five as a rename followed by a row update would be two requests, which
-- PostgREST gives two transactions, and an undo would have to guess which
-- half landed. One call, one transaction, one ledger entry, one undo.
--
-- ── What differs from the template's file, and why ───────────────────────
--
-- The function body is the template's. Two things around it are this
-- database's own.
--
-- `rename_touchpoint` here is SECURITY INVOKER with no guard of its own: it
-- leans on the column grant on `touchpoints.name` and on the service-only
-- update policies. The template's copy is SECURITY DEFINER behind
-- `is_service_account()`. This function is SECURITY DEFINER behind the same
-- guard as every other authoring function here, and it calls the rename from
-- inside its own body, so the rename runs with this function's rights and the
-- guard below is the whole of who may reach it. A caller who fails the guard
-- reaches neither the rename nor the row. The rename is called, not copied:
-- its whole-item match and its post-condition are proven where they live, and
-- a second copy would drift from the first the first time either was fixed.
-- Its body is left as it stands.
--
-- The storage policies are rewritten from this database's own text. The two
-- key-checking policies `20260902150000` created are, on the day of writing,
-- exactly that file's: the bucket, the `is_service_account()` guard, and an
-- id-only key under `cells/`. They are issued again with one change, the
-- prefix `(cells|touchpoints)`, so an icon can be stored under the
-- touchpoint's id. The guard and the key's shape are unchanged, the select and
-- delete policies check no key and are left alone, and the bucket's size and
-- type limits are not touched. A key names the touchpoint's id, never its
-- name, so a rename moves no URL.
--
-- ── Why `icon_url` gets no column grant ──────────────────────────────────
--
-- `authenticated` holds UPDATE on `touchpoints.name` and `updated_at` and on
-- nothing else in the table. Granting `icon_url` too would open a second,
-- direct write surface beside this function, which every posture check would
-- then have to account for. The function is the writer, and it never consults
-- a column grant.
--
-- ── Blank is null ────────────────────────────────────────────────────────
--
-- Every argument is the field's NEXT value, and an empty one means empty: the
-- client posts `''` for a cleared icon, and it is stored as null, the rule
-- every registry write follows. The kind's vocabulary is the table's CHECK and
-- is not restated here, so it cannot drift from it. The columns this
-- deployment added to the registry (`tone`, `aliases`, `stakeholder_id`,
-- `origin`) are neither read nor written.
--
-- ── Replaying against an empty database ──────────────────────────────────
--
-- A function definition and two policy rewrites; no rows are read or moved.
-- The proofs are invariants about the function's posture and the policies'
-- text, which an empty replay satisfies exactly as production does.

-- ── The write ────────────────────────────────────────────────────────────

create or replace function public.update_touchpoint(
  p_touchpoint_id uuid,
  p_name          text,
  p_kind          text,
  p_summary       text,
  p_url           text,
  p_icon_url      text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $function$
declare
  v_name     text := btrim(coalesce(p_name, ''));
  v_kind     text := btrim(coalesce(p_kind, ''));
  v_summary  text := nullif(btrim(coalesce(p_summary, '')), '');
  v_url      text := nullif(btrim(coalesce(p_url, '')), '');
  v_icon_url text := nullif(btrim(coalesce(p_icon_url, '')), '');
  v_previous public.touchpoints;
  v_renamed  jsonb;
  v_written  int;
begin
  if not public.is_service_account() then
    raise exception 'This account cannot edit the blueprint' using errcode = '42501';
  end if;

  -- Refused here as well as inside the rename, because an unchanged name never
  -- reaches the rename, and an empty one must never reach the row.
  if v_name = '' then
    raise exception 'a touchpoint needs a name — an empty one is a blank pill';
  end if;

  if v_kind = '' then
    raise exception 'a touchpoint is one of its kinds — a blank one is none of them';
  end if;

  -- Locked, and read whole: this is the row the inverse will put back.
  select * into v_previous
    from public.touchpoints
   where id = p_touchpoint_id
     for update;

  if v_previous.id is null then
    raise exception 'touchpoint % does not exist', p_touchpoint_id;
  end if;

  -- A save that matches the row as it stands is not an edit. Nothing is
  -- written, `updated_at` is not stamped, and the reply says so, so the caller
  -- records no ledger entry: an undo of nothing is a row that does nothing.
  if (v_previous.name, v_previous.kind, v_previous.summary, v_previous.url, v_previous.icon_url)
     is not distinct from (v_name, v_kind, v_summary, v_url, v_icon_url) then
    return jsonb_build_object(
      'touchpoint_id', p_touchpoint_id,
      'name', v_name,
      'previous_name', v_previous.name,
      'cell_ids', '[]'::jsonb,
      'changed', false,
      'previous', jsonb_build_object(
        'name', v_previous.name,
        'kind', v_previous.kind,
        'summary', v_previous.summary,
        'url', v_previous.url,
        'icon_url', v_previous.icon_url
      )
    );
  end if;

  -- The name first, through the one function that knows how to move it. If it
  -- raises, nothing below runs and nothing above has been written.
  if v_previous.name <> v_name then
    v_renamed := public.rename_touchpoint(p_touchpoint_id, v_name);
  end if;

  update public.touchpoints
     set kind       = v_kind,
         summary    = v_summary,
         url        = v_url,
         icon_url   = v_icon_url,
         updated_at = now()
   where id = p_touchpoint_id;

  -- A zero-row write is a failure, not a no-op: the caller is about to record
  -- an inverse for an edit that never happened.
  get diagnostics v_written = row_count;
  if v_written <> 1 then
    raise exception 'editing touchpoint % wrote % rows', p_touchpoint_id, v_written;
  end if;

  return jsonb_build_object(
    'touchpoint_id', p_touchpoint_id,
    'name', v_name,
    'previous_name', v_previous.name,
    'cell_ids', coalesce(v_renamed -> 'cell_ids', '[]'::jsonb),
    'changed', true,
    -- The argument list that undoes this call, as the row stood under the
    -- lock, never as the caller remembered it.
    'previous', jsonb_build_object(
      'name', v_previous.name,
      'kind', v_previous.kind,
      'summary', v_previous.summary,
      'url', v_previous.url,
      'icon_url', v_previous.icon_url
    )
  );
end
$function$;

comment on function public.update_touchpoint(uuid, text, text, text, text, text) is
  'Edit a touchpoint''s registry entry whole — name, kind, summary, url and '
  'icon_url — in one transaction. A changed name goes through rename_touchpoint, '
  'so every bearing cell''s content moves with it. Blank prose is stored as null. '
  'A save matching the row writes nothing and returns changed = false. '
  'Returns the previous values, which are the arguments that undo the call.';

-- The same posture as every other authoring function here: closed to `public`
-- and `anon`, open to `authenticated`, with the guard in the body deciding
-- which authenticated caller may author.
revoke execute on function public.update_touchpoint(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.update_touchpoint(uuid, text, text, text, text, text) to authenticated;

-- ── Where an uploaded icon may be put ────────────────────────────────────
--
-- The two write policies that check a key, issued again with one more prefix.

drop policy if exists "cell_attachments_insert" on storage.objects;
drop policy if exists "cell_attachments_update" on storage.objects;

create policy "cell_attachments_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cell-attachments'
    and public.is_service_account()
    and name ~ '^(cells|touchpoints)/[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{1,8}$'
  );

create policy "cell_attachments_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'cell-attachments' and public.is_service_account())
  with check (
    bucket_id = 'cell-attachments'
    and public.is_service_account()
    and name ~ '^(cells|touchpoints)/[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{1,8}$'
  );

-- ── Proof ────────────────────────────────────────────────────────────────
--
-- The policies: all four still exist, both key policies admit both prefixes
-- behind the guard, and no write policy on the bucket names anon or public.
-- The function: SECURITY DEFINER, because the guard in its body is what
-- decides who may author; present with the six arguments the client posts,
-- since PostgREST resolves a call by its keys; and closed to anon.

do $proof$
declare
  v_count   int;
  v_definer boolean;
begin
  select count(*) into v_count
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('cell_attachments_select', 'cell_attachments_insert',
                        'cell_attachments_update', 'cell_attachments_delete');
  if v_count <> 4 then
    raise exception 'proof: expected four cell_attachments policies on storage.objects, found %', v_count;
  end if;

  select count(*) into v_count
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('cell_attachments_insert', 'cell_attachments_update')
     and coalesce(with_check, '') like '%(cells|touchpoints)/%'
     and coalesce(with_check, '') like '%is_service_account()%'
     and coalesce(with_check, '') like '%cell-attachments%';
  if v_count <> 2 then
    raise exception
      'proof: expected both cell_attachments key policies to admit cells/ and touchpoints/ behind the service guard, found %', v_count;
  end if;

  select count(*) into v_count
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname in ('cell_attachments_insert', 'cell_attachments_update', 'cell_attachments_delete')
     and ('anon' = any(roles) or 'public' = any(roles)
          or coalesce(qual, '') || coalesce(with_check, '') not like '%is_service_account()%');
  if v_count <> 0 then
    raise exception 'proof: % cell_attachments write policies are open to anon or unguarded', v_count;
  end if;

  select p.prosecdef into v_definer
    from pg_proc p
   where p.oid = to_regprocedure('public.update_touchpoint(uuid, text, text, text, text, text)');
  if v_definer is null then
    raise exception 'proof: update_touchpoint(uuid, text, text, text, text, text) was not created';
  end if;
  if not v_definer then
    raise exception
      'proof: update_touchpoint must be SECURITY DEFINER — the guard in its body is what decides who may author';
  end if;

  if has_function_privilege('anon',
       'public.update_touchpoint(uuid, text, text, text, text, text)', 'execute') then
    raise exception 'proof: anon can call update_touchpoint';
  end if;
end
$proof$;

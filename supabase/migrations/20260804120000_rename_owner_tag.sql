-- Rename an owner tag everywhere it appears, atomically.
--
-- The client used to run two independent UPDATEs (owner, then
-- perceived_owner); a failure between them split the vocabulary in half —
-- the exact drift the tag dropdown exists to prevent. One function, one
-- transaction. Returns the ids of every cell touched so the session log can
-- record an id-precise revert instead of a name-based bulk update that
-- would also rewrite cells legitimately carrying the new name.

create or replace function public.rename_owner_tag(
  from_name text,
  to_name text
)
returns uuid[]
language plpgsql security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  affected uuid[];
begin
  if coalesce(trim(from_name), '') = '' or coalesce(trim(to_name), '') = '' then
    raise exception 'Both the current and the new tag name are required.';
  end if;
  if trim(from_name) = trim(to_name) then
    raise exception 'The new name is the same as the current one.';
  end if;

  select coalesce(array_agg(id), '{}') into affected
  from public.cells
  where owner = from_name or perceived_owner = from_name;

  update public.cells set owner = trim(to_name) where owner = from_name;
  update public.cells
     set perceived_owner = trim(to_name)
   where perceived_owner = from_name;

  return affected;
end;
$$;

grant execute on function public.rename_owner_tag(text, text) to authenticated;

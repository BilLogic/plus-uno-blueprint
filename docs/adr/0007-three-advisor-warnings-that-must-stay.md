---
status: accepted
audience: developers
summary: Three standing advisor warnings are deliberate and one of them has since been reversed on purpose — the record exists so a future hardening pass does not "fix" a decision or re-apply a reversal.
---

# Three advisor warnings that must stay

Supabase's advisor lints this project and reports findings that look like
defects and are not. They were accepted in migration `20260730090000`, and the
record lived in a queue entry — which is the wrong home for something whose
whole job is to survive until someone is tempted to fix it.

Below is each one as it stands today, not as it stood when it was written. One
of the three has been reversed since, for a reason as good as the one that
accepted it, and a record that did not say so would be worse than no record.

## 1. `evidence_counts` ran with owner rights — reversed 2026-08-06

The view was created owner-rights so an anonymous reader could see per-cell
evidence *counts* without evidence RLS letting them see evidence *content*. The
advisor flags owner-rights views at ERROR level, and the finding was accepted.

`20260806180000_advisor_hardening.sql` then set `security_invoker = true` on it.
That is not a regression: decision F3 on 2026-08-06 made evidence rows
deliberately public through their own anon SELECT policy, so the view's
owner-rights execution was guarding a door that no longer had a wall. Running it
as the querying user costs nothing once the underlying rows are readable anyway.

**If evidence is ever made private again, this reverses back** — and the anonymous
assumption lens breaks first. That is the coupling worth remembering.

## 2. The public bucket's `storage.objects` SELECT policy stays

`slice_illustrations_select` grants `authenticated` SELECT on the
`slice-illustrations` bucket. It reads like an over-grant on a bucket that is
already public. It is required for **upsert overwrites**: re-uploading a frame
needs to read the existing object, and without the policy the write fails rather
than the read.

Note the surrounding `do $$ ... $$` block and its comment — these policies fail
on hosted Supabase when the migration role does not own `storage.objects`, so
they apply where possible and degrade visibly otherwise, with writes going
through the service key. A missing policy here is an environment fact, not
necessarily a lost decision.

## 3. A findings reopen collision is a `23505`, and it must reach the user

Reopening a resolved finding whose twin is already open collides on the partial
unique index. `23505` is the designed outcome, not a crash.

What the original note asked for — "the frontend should toast, not treat this as
a crash" — now exists. `src/lib/authoringErrors.ts` translates `duplicate key
value` into a sentence a person can act on, and `reportWriteFailure` puts it on
screen through the notice surface added for #99. The console still receives the
whole error; that surface replaced the console as the *user's* channel, not as
the developer's.

## What this record already caught

Writing it down surfaced two identifiers that name nothing:

- `authoringErrors.ts` matched on `layers_path_row_unique` to produce "Two lanes
  ended up in the same position." No constraint has ever had that name — the
  object is `layers_path_row_idx`, renamed to `lanes_path_row_idx` in
  `20260820120000`, and it is a **plain index, not a unique one**. The branch
  could never fire. It is removed rather than renamed, because renaming it would
  imply a uniqueness rule the schema does not have.
- `20260821270000`'s comment justifies its statement ordering with "`unique
  (path_id, position)` is not deferred". No such constraint exists on
  `public.lanes`. The ordering is harmless either way; the reasoning is wrong.

Whether lane position *should* be unique per path is a real question and is
filed separately. It is not settled here, because adding a uniqueness rule to
live data is a schema decision with its own migration and its own risk.

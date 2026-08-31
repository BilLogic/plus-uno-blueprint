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
already public. It was required for **upsert overwrites**: re-uploading an image needed to
read the existing object, and without the policy the write failed rather than
the read.

**Nothing writes to that bucket as of 2026-08-30 (#179).** A slide's picture is
now the strip of the cells it references, so the per-slide image column and the
field that wrote it are gone. The bucket and its policies stay because objects
uploaded under the older `frame-<n>.png` naming may still be in it and
deleting storage is a destructive act that rename did not need. If the bucket is
ever emptied deliberately, these policies go with it.

Note the surrounding `do $$ ... $$` block and its comment — these policies fail
on hosted Supabase when the migration role does not own `storage.objects`, so
they apply where possible and degrade visibly otherwise, with writes going
through the service key. A missing policy here is an environment fact, not
necessarily a lost decision.

## 3. A findings reopen collision is a `23505`, and it must reach the user

Reopening a resolved finding whose twin is already open collides on the partial
unique index. `23505` is the designed outcome, not a crash.

The original note asked for two things, and only one of them is true. **Not a
crash: yes.** `src/lib/findingMutations.ts` raises through `toAuthoringError`,
`src/lib/authoringErrors.ts` translates `duplicate key value` into a sentence a
person can act on, and the agent tool returns it as a failed outcome in the
transcript. **A toast: no.** `reportWriteFailure` — the notice surface added for
#99 — has four call sites (cell delete, session undo, slice rename, step add)
and none of them is in the findings path, because nothing in the UI writes a
finding. Findings are written by the agent, and the agent's channel is its
transcript.

That is arguably the right place for it: the user is watching the run that
raised the collision. But an earlier version of this ADR claimed the notice
surface carried it, which was simply false, and the claim survived review twice.
**If a non-agent path ever writes a finding, it must report through
`reportWriteFailure`** — that is the condition under which this paragraph
becomes wrong again.

## What this record already caught

Writing it down surfaced two identifiers that name nothing:

- `authoringErrors.ts` matched on `layers_path_row_unique` to produce "Two lanes
  ended up in the same position." No constraint has ever had that name — the
  object on those two columns was `lanes_path_row_idx`, a **plain index, not a
  unique one**, so the branch could never fire. It was removed rather than
  renamed, because renaming it would have implied a uniqueness rule the schema
  did not have.
- `20260821270000`'s comment justifies its statement ordering with "`unique
  (path_id, position)` is not deferred". No such constraint existed on
  `public.lanes` when that was written. The ordering is harmless either way;
  the reasoning was wrong.

Both are settled by `20260828130000`, which added
`lanes_path_position_unique` — `unique (path_id, position) deferrable initially
deferred` — over live data carrying no collision, and dropped the now-duplicate
`lanes_path_row_idx`. The deferral is load-bearing rather than decorative:
`reorder_lanes` renumbers with one UPDATE per lane inside a single transaction,
so any swap collides transiently, and `add_lane` opens a slot with one
self-colliding UPDATE. The lane message is back in `authoringErrors.ts`, on the
name the schema now carries.

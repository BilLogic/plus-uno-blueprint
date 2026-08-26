---
audience: developers
summary: This app is one deployment of the agentic-service-blueprinting template — how upstream changes arrive, which paths never take them, and which PLUS couplings are still hardcoded here.
---

# The template relationship

This repo is **an instance**. `agentic-service-blueprinting` is **the template**
it is a deployment of, and the package other organizations install. Application
code is shared; this instance's data, migrations, identity and agent persona are
not.

Nothing about the arrangement is symmetric. Upstream is where generic code is
authored; here is where a real Supabase, its migrations and one organization's
blueprint content live. Read every rule below as an answer to "which side owns
this file".

## How upstream changes arrive

By `git merge`, since [#105](https://github.com/BilLogic/plus-uno-blueprint/pull/105)
grafted the template's history onto ours. Before the graft the two repos had
distinct root commits and `git merge-base` returned nothing, so every transfer
was a manual file copy — which is how the vendored rulebook drifted eighteen
files and then inverted.

The graft used `-s ours`: it records the parentage and imports no content. It
buys exactly two things — merges become possible at all, and the divergence
stops growing. It does **not** make the first content merge small.

The `template` remote is a **local path** to a sibling checkout, so what you
fetch is that checkout's local branches. Its `main` is whatever the last person
to work there left behind, and a stale one is indistinguishable from an
up-to-date one until you look:

```sh
git fetch template 'refs/remotes/origin/main:refs/remotes/template/upstream-main'
git log -1 --format='%h %ad' --date=short template/upstream-main
```

Measure and merge against `template/upstream-main`, never against
`template/main`. The graft itself hit this trap — its commit message records
grafting against the sibling's remote-tracking ref precisely because the local
branch sat stale — and so did the first divergence inventory. If
`git merge-base --is-ancestor template/<ref> HEAD` succeeds, that ref is behind
you and measuring against it reports no divergence at all.

## The paths upstream may never change

`scripts/template-quarantine.json` declares ten patterns this instance owns: its
migrations and seeds, its Supabase config, `src/data/`, `src/config.ts`, the
generated `src/types/database.ts`, the canvas agent's `role.md`, and both
one-off data repair shims. `npm run check:template-quarantine` inspects every
merge commit in a range whose merged-in side descends from the template's root,
and fails the merge that took the package's version of one.

It is a check and not a `merge=ours` driver on purpose. The driver is *declared*
in the committed `.gitattributes` and *defined* in `.git/config`, which is not
committed, so a fresh clone keeps the declaration and silently loses the
protection. That is the same shape as the deleted `sync-agent-skill.mjs`, whose
`--check` exited 0 when it could not see its source. A guard that passes when
blind is not a guard.

The manifest also records what is deliberately **not** quarantined, and why —
`src/styles/colors.css` diverges block-level rather than file-level, so a
path-level guard would reject wanted structural changes along with the palette.

## "Template scrub" was never built, and will not be

[`docs/ideation/generalization-audit.md`](../ideation/generalization-audit.md)
(2026-07-16) closed with a remediation step named **template scrub**: delete
this repo's PLUS-specific code — the arrow-routing special cases, the display
flags, `src/data/`, the product screenshots, the hosted-push script, the legacy
`services` table — and parameterize the rest, producing a generic template out
of this tree.

No such script was ever written, and none should be. The plan assumed the
template would be *extracted from here*. It was not:
`agentic-service-blueprinting` became its own repo and did the scrubbing
upstream, by hand, over time. Measured today the delete class is already gone on
that side — the repair shims do not exist there, and `blueprintArrowGeometry.ts`
is 2,107 lines upstream against 3,155 here. **The direction reversed.**
Scrubbing PLUS out of this tree would now mean building a second, competing
template out of the instance.

So the process is struck rather than implemented, and its promises land as
follows:

| What template scrub promised | Where it landed |
|---|---|
| A generic tree with the delete class removed | The `agentic-service-blueprinting` repo itself. Already scrubbed; that is what the package ships. |
| PLUS-specific files fenced off from the generic surface | `scripts/template-quarantine.json` and `npm run check:template-quarantine`, enforced per merge in CI. The named process now has a command that can fail. |
| A record of every PLUS coupling | The audit, kept as history with `status: superseded`. Its remediation plan is dead; the inventory below replaces its findings. |

### What is still coupled, and unguarded

Re-derived from the audit's findings against `origin/main`, because more than
half of them had already been closed by other work and copying the list forward
would have re-asserted fixes as defects. Still true:

| Coupling | Measured |
|---|---|
| `src/lib/blueprintArrowGeometry.ts` | 3,155 lines, 20 distinct hardcoded cell UUIDs, 58 Regular-Tutor references. Inert for foreign content — an ID match fails and routing falls through to the default — but the largest PLUS coupling in the tree. |
| `src/lib/blueprintDisplayFlags.ts` | 53 lines of per-scenario rollout flags, keyed to one PLUS scenario UUID. |
| `src/lib/techPillColors.ts` and the tech description/picture tables | PLUS-branded tech vocabulary: `PLUS App`, `Zoom`, `Zoom Recording`. |
| `src/config.ts` | `ORG_NAME = 'PLUS'`. Quarantined — owned here by design, not a defect. |
| `package.json` | `"name": "plus-service-hub"`. |
| `public/blueprint-images/` | 18 PLUS product screenshots. |
| `scripts/apply_pending_goal_setting_migrations.mjs` | A hardcoded Supabase project ref. |

Nothing in this repo guards that list — no check fails when it grows. Shrinking
it is generalization work done upstream, not a scrub done here. Do not cite "the
template scrub" as the thing that will handle it.

### Audit findings already closed

Recorded so the next reader does not re-open them:

- **Fallback-wins merge** — `resolveBlueprint.ts` is DB-wins now: the database
  value stands when non-empty and fallbacks only fill empty fields.
- **Hardcoded lifecycle and phase IDs** — `useLifecyclePhases.ts` no longer
  exists, and no `DEFAULT_LIFECYCLE_ID` survives anywhere in `src/`.
- **Magic lane names in `blueprintLayout.ts`** — replaced by lane roles.
- **Loop detection by English label** — `src/types/slides.ts` is gone.
- **`sideBySideCompareLayout.ts` coupled to a Regular-Tutor shim** — the
  predicate is the generic `layerHasInLaneLoopCorridor` now.
- **The `PLUS` wordmark in `EditorChrome.tsx`** — removed.
- **The legacy `public.services` table** — dropped in
  `20260821340000_retire_lifecycle.sql`.

## How far apart the trees are

Run it; do not quote it from memory:

```sh
git fetch template 'refs/remotes/origin/main:refs/remotes/template/upstream-main'
npm run template:divergence          # add -- --files to list the differing paths
```

`scripts/measure-template-divergence.mjs` is **reporting, not a guard** —
divergence is expected to be non-zero and to move, so there is no threshold to
fail on and it is not wired into CI. It refuses exactly one thing: reporting a
comfortable number it cannot stand behind. An unresolvable ref exits 1, and so
does a ref already merged into HEAD, because that is what a stale sibling
checkout looks like from here.

Scope is `src/`, `docs/`, `scripts/`, `hooks/` and the root files. `supabase/`
is excluded — it is quarantined wholesale, and comparing this instance's
migrations against the package's dummy backend measures nothing.

### 2026-08-26, against upstream `695c730`

| Area | Same path, identical | Same path, differ | Instance only | Template only |
|---|---|---|---|---|
| `src/components` | 88 | 76 | 26 | 10 |
| `src/lib` | 46 | 89 | 53 | 23 |
| `src/hooks` | 4 | 16 | 10 | 4 |
| `src/styles` | 5 | 12 | 0 | 1 |
| `src/contexts` | 8 | 7 | 3 | 2 |
| `src/types` | 0 | 5 | 0 | 0 |
| `src/data` | 0 | 1 | 47 | 2 |
| `src` (other) | 5 | 4 | 0 | 1 |
| `docs` | 0 | 0 | 145 | 28 |
| `scripts` | 0 | 4 | 25 | 37 |
| `hooks` | 0 | 0 | 0 | 4 |
| root files | 5 | 11 | 1 | 4 |
| **Total** | **161** | **225** | **310** | **116** |

386 shared paths, **41.7% byte-identical**.

This supersedes §1–§3 of the divergence inventory in
[#74](https://github.com/BilLogic/plus-uno-blueprint/issues/74), which were
measured against a checkout 134 commits behind `origin/main` and were never
re-measured when §4 was corrected.

**Shared history — closed.** #74 found distinct root commits and an empty
`git merge-base`. Both roots are now reachable from `main`, the template's root
`6fe51a9` is an ancestor of ours, and the merge base with upstream is `0fd6ca0`.
"Every transfer is a manual file copy" is no longer true. What replaced it is
the stale-ref trap above: `template/main` is an *ancestor of our HEAD*, so the
naive measurement now reports almost no divergence rather than none of the
history.

**File counts — corrected in every row.** 403 shared paths at 71% identical is
now 386 at 41.7%. The tree moved, not the yardstick: [#109](https://github.com/BilLogic/plus-uno-blueprint/pull/109)
restructured the documentation tree, and #107, #108 and #110 rewrote the canvas
input layer, the read/write lifecycle and the write boundary. The `docs` row is
the sharpest change — **no doc path is shared with upstream at all** now, where
#74 found four. Two rows are confirmed unchanged: 47 instance-only files under
`src/data/`, and all four of `hooks/` still template-only and still not taken.

#74's "14 test files the blueprint has no equivalent of" is 16 under `src/` and
11 under `scripts/tests/` — but read that as a path count, not a coverage gap:
`findingFingerprint.test.ts` is template-only by path while this repo tests the
same module in `scripts/tests/findingFingerprint.test.mjs`. Its "+300 harness
transcripts" are gitignored and are dropped here rather than counted; an
untracked file cannot be compared by path.

**Instance-specific classification — corrected, and no longer a judgement.**
#74 estimated "~60 instance-specific" of 116 differing files, by eye. The line
is drawn mechanically now, by `scripts/template-quarantine.json`: within this
scope it claims **4 of the 225 differing shared paths** — `src/config.ts`,
`src/types/database.ts`, `src/data/blueprintFallbacks.ts` and
`src/lib/agent/role.md` — plus 49 instance-only files. The ~60 was high because
it conflated file-level with block-level ownership: `semantic.css`,
`themes/light.css`, `sessions.ts` and the copy in `BlueprintCellDetailPanel.tsx`
carry instance-specific *blocks* inside otherwise shared files, which a
path-level guard deliberately does not claim. #74's "these should not be
reconciled" verdict stands for the quarantined set, and is enforced now rather
than advised.

**Direction of drift — reversed again, and no longer measurable by ancestry.**
#74 said the package was ahead on 105 of 116; the #80 correction said the
opposite. Neither can be settled by git: the graft is `-s ours`, so no content
lineage crosses between the repos and "ahead" has no ancestry meaning. What is
measurable: **155 of the 225 differing shared paths were changed upstream since
the merge base**, so most of the difference is upstream work this instance has
never taken. The other 70 differ because of what this instance did alone.

The named extremes all still differ, and by more than before —
`blueprintArrowGeometry.ts` +1511/−463, `blueprintFallbacks.ts` +944/−97,
`blueprintLayout.ts` +309/−271, `BlueprintCellDetailPanel.tsx` +230/−283,
`types/database.ts` +187/−448.

**What this costs the code sweep.** #74's verdict — "71% of the shared surface
is already byte-identical, sweep it as one pass with a hard fence" — rested on
a number that is now 41.7%. The fence exists and is better than #74 imagined,
because it is a check rather than a list in a comment. The one pass does not:
225 differing shared paths, 155 of them carrying upstream changes, is not a
sweep-sized job. Plan it against this table, not against #74's.

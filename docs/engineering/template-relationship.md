---
audience: developers
summary: This repository is a deployment of the agentic-service-blueprinting template and imports it at a pinned tag — where the application actually lives, what `@/` and `~/` resolve to, what a version bump involves, what to do when the template changes something you depend on, and what the retired merge-era machinery was for.
---

# The template relationship

The application is not in this repository. It is
[agentic-service-blueprinting](https://github.com/BilLogic/agentic-service-blueprinting),
installed as a dependency and pinned by release tag, and what lives here is one
deployment of it: a database, a blueprint's worth of content, a brand, an
environment, and the handful of modules that tell the template which of those to
use.

Nothing about the arrangement is symmetric. Upstream is where the generic thing
is authored and released; here is where a real Supabase, its migrations and one
organization's content live. Read every rule below as an answer to "which side
owns this".

The decision itself is recorded upstream — [ADR 0019](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0019-the-deployment-is-a-deployment-of-the-template.md)
(a deployment, not a fork) and [ADR 0020](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0020-the-deployment-imports-the-template.md)
(imported, never vendored). `docs/adr/0012` and `0013` here are pointers at
those, kept so a citation of the local number still lands. This document is the
working account: how the arrangement behaves day to day.

## How the application arrives

Through `package.json`:

```json
"agentic-service-blueprinting": "github:BilLogic/agentic-service-blueprinting#v1.43.1"
```

A tag, never a branch, so a deployment always knows exactly which code it is
running; the lockfile pins the commit that tag resolved to. `npm ci` unpacks it
to `node_modules/agentic-service-blueprinting`, and that directory is the
application — every component, hook, context, style, agent tool and skill.

Two aliases divide the tree, and the division is the whole seam:

| Prefix | Resolves to | Holds |
|---|---|---|
| `@/…` | `node_modules/agentic-service-blueprinting/src` | the application |
| `~/…` | `deployment/` | this deployment's own modules |

`deployment/` is small on purpose: the `DeploymentConfig` the template's app is
mounted with, the bootstrap that registers this deployment's reference
documents, the cover content, the brand dials, this deployment's own
`types/database.ts`, the canvas agent's adapter, and the cross-repo contract
with uno-bot. Everything else a reader might look for is either upstream or in
`supabase/`.

`@/…` is declared with **two** roots — `./src` first, then the package — in
`vite.config.ts` and `tsconfig.json` alike. This repository has no `src`, so the
second always wins here. The pair is written as a pair because the template's
own copies of those files say the same thing and are held identical to these;
see below.

## What a version bump involves

1. Read what changed. The template's releases and its `CHANGELOG` are the
   source; a tag-to-tag compare on that repository is the diff.
2. Edit the tag in `package.json`, then `npm install` so the lockfile moves with
   it, then `npm ci` so the install matches the lockfile. A pin that has moved
   and an install that has not is its own failure with its own message — four
   scripts here refuse rather than compare against the wrong tree, because that
   condition once read as a drift regression twice in one day.
3. Run the gates. In roughly the order they will tell you something:
   - `npm run typecheck` — a module you import through `@/…` changed shape.
   - `npm test`, `npm run lint`, `npm run build`.
   - `npm run check:reconciled` — a shared file this repository also holds moved
     upstream and has not moved here.
   - `npm run check:write-surface` — the released rulebook and this deployment's
     tool registry disagree about what the agent may call.
   - `npm run check:harness` — a component the composition docs claim is not in
     the release any more.
   - `npm run check:contract:live` — the application's read surface against the
     database it actually has.

The bump is the only way application code changes here. There is no second copy
to edit, which is the point.

## When the template changes something you depend on

There is no local edit available, and that is the arrangement working rather
than failing. Four shapes, and each has one honest remedy:

- **A shared file moved upstream.** `check:reconciled` fails at the bump. Take
  the template's bytes. If they are wrong for a deployment, the fix is the
  template's to make — the enrolment is what carries the question there.
- **A module you import changed signature.** `tsc` fails. Adapt the deployment's
  own code, or hold the pin until upstream is ready.
- **Something you need is not offered.** Add the seam upstream, release, bump.
  Not a patch here: a deployment that starts editing the application has become
  a fork again, and this repository has already been that once.
- **Nothing fails and behaviour changed.** Hold the pin, file upstream, and say
  which release you are held at and why. Holding a pin is a normal state, not a
  debt.

The one rule under all four: **upstream first, never sideways.** A change that
lands only here cannot be released to anyone, and the next bump reverts it.

## The fifteen files that are still two copies

Some files exist in both repositories because both need them on disk: the build
cannot import its own configuration from a dependency it has not resolved yet,
and a script is not the application. `scripts/reconciled-files.mjs` names them,
and `npm run check:reconciled` fails the build when any one stops being
byte-identical to the pinned template's copy. Three groups:

- **The build's own configuration** — `vite.config.ts`, `tsconfig.json`,
  `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`,
  `components.json`. These carry the seam described above: where `@/…` and `~/…`
  resolve, what `tsc` compiles, what vitest collects. The same bytes serve a
  repository that holds an application and one that does not, by what is on
  disk rather than by what either file says — so a local edit here is how the
  seam would quietly stop being a seam.
- **Shared scripts and their tests** — `scripts/` is not the application, so it
  never moved into the package; where both repositories run the same check they
  run two copies of it.
- **Two data files** — the step placeholder SVG, whose *name* is written into
  fourteen applied migrations, and `docs/agents/triage-labels.md`, where a role
  the template respells is a label this deployment's agents would go on applying
  under the old one.

A file on that list **cites no repo-local identity**: no issue or pull-request
number, no ADR number, no migration filename, no `docs/` path. Each is an
address in one repository and means something else in the other — `#243` names
two unrelated things and `#305` does not exist upstream at all. Name the
decision instead of numbering it. `check:reconciled` enforces this alongside the
byte comparison.

To find the next file that could join: `npm run template:enrollable`. It reads
the installed package — the same copy the gate compares against — and lists
shared files whose code already matches and whose comments do not, separating
the ones a citation rules out at any wording from the ones that are genuinely a
wording apart.

## What the retired machinery was for

Three mechanisms were removed once the import landed. A reader finding their
deletion in the history should not conclude any of them was a false start.

**The drift gate did the opposite of retiring.** It is
`check:reconciled` above, and it is why the import was safe to do at all. Before
the flip it was the proof of identity behind a 500-file deletion: each enrolment
was a file somebody had demonstrated byte-identical to the template, one by one,
until 522 were on the list and deleting them in favour of the package was a
mechanical step rather than a leap. 507 of those files then left this
repository, and for them drift is no longer prevented — it is impossible, one
copy. The list did not shrink because enrolments were withdrawn; it shrank
because their subject was gone, which is what the enrolments were working
toward. The fifteen that remain are the ones the flip could not dissolve, and
the gate stayed with them.

**The template-quarantine guard** (`scripts/template-quarantine.json`, and the
check that read it) inspected merge commits. Until the flip, upstream code arrived by
`git merge` — this repository and the template were grafted into one history in
2026-07 precisely so that merges were possible at all — and a merge could
quietly take the package's version of this deployment's migrations, seeds,
Supabase settings or `deployment/` tree. That is a data-shaped regression, not a
conflict anyone would notice in review, so it was worth a check.

It was a check rather than a `.gitattributes` `merge=ours` driver for a reason
worth keeping after the guard itself is gone: the driver is *declared* in the
committed `.gitattributes` and *defined* in `.git/config`, which is not
committed, so a fresh clone keeps the declaration and silently loses the
protection. **A guard that passes when it cannot see is not a guard.** That rule
is still enforced here, in `scripts/app-source.mjs`, which refuses an empty walk
rather than reporting a green pass over nothing.

What replaces it is structure rather than a check. The application is in
`node_modules/`, which git does not track; no upstream change can write to
`supabase/` or `deployment/` by any route, because there is no route. So if you
are looking for the list of paths upstream may never change: it is every path in
this repository, and nothing enforces it because nothing can violate it.

**The divergence measure** (`measure-template-divergence.mjs`) reported how far
this repository's copy of the application had drifted, area by area, so that the
number could be re-derived in one command instead of hand-measured and going
stale invisibly — which is exactly what happened to the inventory it replaced.
It compared git trees against a `template` remote that was a local path to a
sibling checkout. The copy it measured is gone, and the remote was something no
fresh clone and no CI run ever had. Its one surviving mode is
`template:enrollable`, described above, which reads the installed package
instead.

### "Template scrub" was never built, and will not be

A generalization audit of this repository (2026-07-16) closed with a remediation
step named **template scrub**: delete this repository's PLUS-specific code and
parameterize the rest, producing a generic template out of this tree.

No such script was ever written and none should be. The plan assumed the
template would be extracted *from here*. It was not — `agentic-service-blueprinting`
became its own repository and did the generalizing upstream, by hand, over time,
and this repository is now a consumer of the result. The audit's largest named
coupling is the proof: `blueprintArrowGeometry.ts` carried 20 hardcoded PLUS
cell UUIDs and 58 references to one PLUS scenario when the audit measured it,
and the copy this deployment runs today carries **none of either**. The
direction reversed, and then the fork closed.

Cite the audit as history. Do not cite "the template scrub" as the thing that
will handle a coupling.

## What is genuinely this deployment's

Not a defect list any more — this is the layer, and it is supposed to be
specific:

| | |
|---|---|
| `supabase/` | 884 migrations, the seeds and the project settings for one real database. The package ships a dummy backend. |
| `deployment/` | The `DeploymentConfig`, the bootstrap, the cover content, the brand dials, `types/database.ts`, the canvas adapter, the uno-bot contract. |
| `docs/`, `scripts/` | This repository's own writing and its own checks, including several that reach into the package to hold the docs to the release. |
| `public/touchpoint-logos/` | Stock logos for well-known tools. |
| `package.json` | `"name": "plus-service-hub"`. |
| `scripts/apply_pending_goal_setting_migrations.mjs` | A hardcoded Supabase project ref — this deployment's, by design. |

One thing this list does **not** have a guard for: the application coming back.
`APP_SOURCE_ROOTS` in `scripts/app-source.mjs` prefers a local `src` over the
package, so a `src/` reappearing here would silently become what every check
reads. Nothing fails on that today, and nothing needs to yet — it would take
several hundred files in one commit — but it is the shape to watch for, and the
reason the two-root pair is spelled the same way in `vite.config.ts`, both
tsconfigs and `app-source.mjs`, with the template's own suite holding all four
equal rather than trusting them.

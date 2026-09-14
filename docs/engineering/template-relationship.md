---
audience: developers
summary: This repository is a deployment of the agentic-service-blueprinting template and imports it at a pinned tag — where the application actually lives, what `@/` and `~/` resolve to, what a version bump involves, what to do when the template changes something you depend on, the offline board a no-database build draws and the command that re-exports it, and what the retired merge-era machinery was for.
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
"agentic-service-blueprinting": "github:BilLogic/agentic-service-blueprinting#v1.44.12"
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

A third spelling sits beside those two: the **package name**. `@/…` is an
alias this repository declares, so it resolves only here — a module the
template's own generator writes for a deployment, or one that names a type
the package index exports, says `agentic-service-blueprinting` instead,
which resolves on both sides. `deployment/data/sampleNav.ts` and
`deployment/data/sampleBlueprints.ts` are that case.

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

## The files that are still two copies

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

Matching bytes is not on its own a reason to enrol. `public/favicon.svg` is
byte-identical to the template's copy and stays off the list, because branding
is the next thing this deployment has cause to diverge on and enrolling the icon
would route that change through the template. Six paths that used to sit beside
it are enrolled now — each cited a `docs/` path, and the template took the
address out of both copies rather than either of us keeping a dead pointer.
`scripts/reconciled-files.mjs` argues the one that stays off, and that is the
place to read before proposing it again.

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
toward. The ones that remain are the ones the flip could
not dissolve, and the gate stayed with them.

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

## The offline board is two fields

A build made with `VITE_SUPABASE_URL` empty still has to draw something, and
what it draws is `DeploymentConfig.sample` — two fields, both REPLACED rather
than merged:

| Field | This deployment's | What it is |
|---|---|---|
| `sample.nav` | `deployment/data/sampleNav.ts` | the phases and scenarios, hand-authored |
| `sample.blueprints` | `deployment/data/sampleBlueprints.ts` | the lanes, steps, cells, edges, placements and resources behind them — **generated** |

Because the kit replaces rather than merges, supplying only the nav is worse
than supplying neither: this deployment's rows land over the template's content
registry, which is keyed by the template's scenario ids and answers none of
ours, and every scenario opens an empty canvas. That was this repository's state
until the board was exported, and it is why `npm run check:render-walk` used to
announce a skip instead of opening a browser.

The kit generates both halves from a Service Blueprint IR. **This deployment has
no IR** — its board arrived as an import made elsewhere ([ADR
0009](../adr/0009-the-migration-series-is-a-narrative.md)) and its cell prose
lives in the live database and in no file here — so the content half is exported
from the database instead:

```sh
npm run export:sample-board    # rewrite deployment/data/sampleBlueprints.ts
npm run check:sample-board     # …or just ask whether it is still current
```

It reads through **the public read surface and nothing else**: `VITE_SUPABASE_URL`
and `VITE_SUPABASE_ANON_KEY`, the same two public values the deployed bundle
already carries, so CI needs no new secret and a row RLS hides from anon is a
row the file does not carry. Never edit the file by hand — its header says so,
and the next export would silently take the edit back.

`check:sample-board` is deliberately not a gate. The database moves whenever
somebody authors a cell, and a required check that goes red because a colleague
edited a board is a check people learn to ignore. The honest instrument is this
freshness note, refreshed when the board is re-exported:

> **Last exported 2026-09-14**: 17 scenarios, 33 paths, 269 lanes, 188 steps,
> 933 cells, 428 dependencies, 322 touchpoint placements, 600 resources — every
> scenario the nav names, none of them empty.

Three things the note deliberately does **not** claim, because nothing checked
them:

- **Not "nothing was withheld".** The exporter can see one absence and only one:
  a scenario that came back with no path at all, which it names in a warning. A
  policy that hides *some* cells, placements or resources inside a path hides
  them from every shape of the question equally, so a board RLS has trimmed
  looks exactly like a smaller board. What is checked is truncation — the cells
  of every scenario are counted a second time as rows of their own and the run
  refuses on a disagreement — because a row cap applies inside a 200 with no
  error to notice.
- **Not "only no-database builds pay for it".** `deployment/deployment.ts`
  imports the registry statically, so the file ships in **every** build. It is
  ~1.4 MB on disk and moves the main chunk from 2,137 kB to 3,107 kB raw and
  638 kB to 776 kB gzipped — about +140 kB gzipped on every page load, including
  production builds with a database, where nothing ever reads it. That is dead
  weight and it is the shape of the seam rather than an oversight: `sample` is a
  synchronous config field. A lazy loader would have to be offered upstream.
- **Not "the board is self-contained".** Its *text* is. Its *pictures* are not:
  432 cells carry a `frame` and 127 placements carry an icon, and every one of
  those URLs points at this project's public Supabase storage bucket. A build
  with no database still fetches its images over the network, and
  `check:render-walk` drives Chromium over all of them. No new asset class is
  mounted, though — these are the same images a database build shows, so the
  decoded-memory budget in
  [codebase-guide § Performance constraints](codebase-guide.md#performance-constraints)
  is unchanged: at most 36 frames on one path and 194 across one scenario's
  paths side by side, well under the 141-image case that set the 300px cap.

`npm run check:render-walk` is what proves it: it builds with the Supabase
variables empty, previews the result and drives Chromium over every phase,
scenario, path and layout, failing on a console error. `scripts/render-walk.mjs`
keeps a precondition in front of it — if the two halves ever stop sharing an id,
the walk says so through the `unverified` register rather than failing as though
the application were broken.

## What is genuinely this deployment's

"Coupled" no longer means what it meant when this repository held its own copy
of the application. Since the import and the scripts' convergence there is no
`src/` here at all: the application is read out of
`node_modules/agentic-service-blueprinting`, this deployment's own modules live
under `deployment/`, and the only place the two trees can still drift is the
files both have to keep on disk. That drift is measured, never listed:

```sh
npm run check:reconciled      # every shared file against the pinned template's bytes
npm run check:shared-scripts  # every script the release publishes, held here and enrolled
```

Run them; do not quote them. What the last run showed, 2026-09-14 against
`v1.44.12`: 25 reconciled files byte-identical, 15 published scripts all held
here and enrolled, one repo-local import enrolled nowhere, nothing drifted.

What is left that is genuinely this deployment's is identity and data, not
application code. Each line says what guards it, or says that nothing does and
why that is the intent:

| What | Guard |
|---|---|
| `deployment/` — the `DeploymentConfig`, the bootstrap, the cover content, the brand dials, `types/database.ts`, the canvas adapter, the uno-bot contract | `deployment/deployment.test.ts`, which asserts the wordmark is `PLUS`: the template's `ORG_NAME` is the template's own name now, and would otherwise reach this deployment's chrome |
| `supabase/` — the migrations, the seeds and the settings of one real database, where the package ships a dummy backend | `check:migration-syntax`, `check:database-names`, and `check:contract:live` against the database it actually has |
| `package.json` — `"name": "plus-service-hub"`, and the pin | Unguarded on purpose. The name is what npm calls this deployment, and the pin is the whole subject of a bump rather than something to hold still |
| `index.html` — `<title>PLUS</title>` — and `public/favicon.svg` beside it | Unguarded on purpose, and deliberately unenrolled: branding is the one change that must not route through the template |
| `scripts/apply_pending_goal_setting_migrations.mjs` — a hardcoded Supabase project ref | Unguarded on purpose. It is this deployment's project; a script naming anyone else's would be the defect |
| `docs/`, `scripts/` | This repository's own writing and its own checks, including several that reach into the package to hold the docs to the release. Not the composition documents: the claim for a file is written where the file lives, so those are the package's and arrive with the application |
| `public/touchpoint-logos/` | Stock logos for well-known tools. Unguarded, and nothing about them is this deployment's but the choosing |
| `deployment/data/sampleBlueprints.ts` — the offline board's content, exported from the live database | `deployment/data/sampleBlueprints.test.ts`, which holds the registry to every scenario `sampleNav.ts` names, and `check:render-walk`, which opens all of it in a browser |

One thing this list does **not** have a guard for: the application coming back.
`APP_SOURCE_ROOTS` in `scripts/app-source.mjs` prefers a local `src` over the
package, so a `src/` reappearing here would silently become what every check
reads. Nothing fails on that today, and nothing needs to yet — it would take
several hundred files in one commit — but it is the shape to watch for, and the
reason the two-root pair is spelled the same way in `vite.config.ts`, both
tsconfigs and `app-source.mjs`, with the template's own suite holding all four
equal rather than trusting them.

---
status: accepted
audience: developers
summary: The docs tree drops from three lanes to two — reference and the queue — by retiring `docs/plans/`, `docs/ideation/` and `docs/brainstorms/` in full; open work lives in GitHub Issues, durable decisions become ADRs, and everything the 86 retired files held stays readable in git history. `docs/archive/` is deliberately not part of this.
---

# The history tier is retired; the queue is issues and durable decisions are ADRs

`docs/` used to hold three lanes: **reference** (living, always true),
**history** (`docs/plans/`, `docs/ideation/`, `docs/brainstorms/` — 86 files of
decision-era snapshots, never edited after the fact) and **the queue**
([GitHub Issues](https://github.com/BilLogic/plus-uno-blueprint/issues)). The
history lane is gone. Two lanes remain.

Three places now hold what the third lane used to:

1. **Open work is an issue.** The plan for a piece of work — the options
   weighed, what was rejected, the staging — is written in the issue it belongs
   to and in the commits that close it. An issue can be assigned, closed and
   linked across repositories; a markdown file in a folder can do none of those,
   which is why the queue moved out of the tree already
   ([ADR 0009](0009-the-migration-series-is-a-narrative.md)'s sibling argument,
   one lane over).
2. **A decision that outlives its ticket is an ADR.** That is what this folder
   is for, and [overview.md](overview.md) already states the test.
3. **Everything else is git history.** The 86 files are one `git log` away, at
   the commits where they were true, next to the code they were arguing about.

## Why, and what it costs

A snapshot lane is a lane that can only rot. Its contents are *by rule* never
edited, so the day after a plan executes it is a document that reads like
guidance and is not — which is why it needed frontmatter (`status`,
`distilled-into`) whose whole job was warning a reader off, a routing row in
the generated index pointing at that frontmatter, and a numbered item in the
always-loaded `AGENTS.md` tier that every session paid for before it decided
anything. Three pieces of machinery, all of them protecting readers from files
we had chosen to keep.

Worse, the lane leaked. Nine reference docs cited plans in their `sources:`
frontmatter, five comments in shipped code and applied migrations carried plan
addresses, and one **ADR** — the thing that is meant to outlive a plan — cited
one for evidence. Each of those is a pointer that a reader follows and finds
either nothing or a document flagged as no longer true. The citations are
removed rather than rewritten as prose: in every case the surrounding sentence
already carried the whole argument, and the address was the only part that
could go stale.

**The cost is real.** A plan carried the shape of a decision — the alternatives
considered, the staging, the risk notes — at more length than a commit message
and with less ceremony than an ADR. That middle register now has to be written
in an issue, where it is less discoverable from the tree, or promoted to an
ADR, which is a higher bar. Some reasoning that would have been written down
will not be.

**The alternative that was considered and rejected:** keep the folders and let
them go read-only — no new files, existing ones left in place. It is cheaper
and loses nothing. It was rejected because it keeps every piece of the
machinery above (the status frontmatter, the routing row, the always-loaded
item, the sweep exclusions in `scripts/swept-docs.mjs` and
`scripts/check-lane-role-values.mjs`) while removing the only thing that
justified paying for it — that the lane was still in use. A lane nobody writes
to that every session still reads about is the worst of both.

## Consequences

`AGENTS.md`, `README.md` and the generated `INDEX.md` say **two lanes**. The
index generator no longer routes anyone at a plan's `status`. The sweeps that
excluded the three trees as dated records now exclude only `docs/adr/` (plus,
in `check-lane-role-values.mjs`, the migrations, the changelog and the archive).

**`docs/archive/` is deliberately not part of this**, and is not a third lane
sneaking back. It holds one forensic JSON recording rows present in a database
backup and absent live, with the evidence that they were re-authored by the
importer rather than lost. That is not decision-era thinking on the way to a
spec; it is evidence about the database that cannot be regenerated, and it
states its own reason for being kept. The tier sentence in `AGENTS.md` never
named it.

**The plausible "fix" that would undo this:** someone starts a
`docs/plans/2027-…` file because an issue thread feels like the wrong shape for
a long design argument. If that happens repeatedly and the issue really is the
wrong container, the answer is to say so and reopen this record — not to grow
a fourth lane one file at a time.

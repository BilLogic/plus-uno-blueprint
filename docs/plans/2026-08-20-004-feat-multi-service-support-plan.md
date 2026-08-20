---
title: "More than one service — what it would actually take"
type: feat
status: not-scheduled
date: 2026-08-20
repos: uno-blueprint, plus-uno
brief: docs/plans/2026-08-20-001-spec-layer-brief.md
---

# Multi-service

> **Status: not scheduled, deliberately.** There is one service today. This
> plan exists so that the day a second one is real, nobody rediscovers the
> list — and so the piece most likely to be missed is written down while it is
> fresh.

---

## Where it stands

**The schema is already multi-service shaped.** Every root table carries
`service_lifecycle_id`: `phases`, `evidence`, `findings`, `slices`,
`propositions`. Nothing needs a new column to hold a second service.

**Two things are not ready.**

### 1. The app picks a service for you

`src/lib/lifecycle.ts:34` — the function is literally named
`resolveFirstLifecycleId`, documented as *"First lifecycle by `created_at`"*.
`src/lib/agent/tools/registry.ts:96` carries the comment *"One lifecycle per
deployment today; cached after the first ask."*

Some reads do scope — `useLifecyclePhases.ts:66`, `useSlices.ts:46`,
`registry.ts:675` — but to the lifecycle that was chosen for them. There is no
picker anywhere in the product.

### 2. There is no tenant isolation at all

Checked every relevant table's SELECT policy:

```
services · service_lifecycles · phases · service_scenarios
cells · slices · findings · evidence · propositions
        →  every one:  using (true)
```

Anyone who can read, reads everything. With one service that is correct
behaviour. With two it is a data leak between teams.

### 3. ⚠️ `search_blueprint` is not service-scoped — and it is the newest code

Its `scoped` CTE joins `cells → layers → paths → service_scenarios → phases`
and **never reaches `service_lifecycle_id`**. Its `structural` CTE does the
same. So with two services it would blend them silently: a Slack question
about Service A could be answered with Service B's cells, with no error and no
`matched_by` signal that anything was wrong.

This is the piece most likely to be forgotten, because it postdates every
other consideration on this list. It is written first here for that reason.

---

## What it takes

### Backend

- [ ] A membership table — `service_members(service_lifecycle_id, user_id, role)`
- [ ] Rewrite **every** SELECT policy from `using (true)` to a membership
      predicate. Not a subset: one missed table is the whole leak
- [ ] `filter_service` parameter on `public.search_blueprint`, applied to
      `scoped` **and** `structural` **and** the `total` count query — a filter
      that only reaches two of the three would under-report
- [ ] `deletion_impact` and the authoring RPCs inherit RLS, so they need no
      new parameter — but each needs a test proving it
- [ ] Replace `resolveFirstLifecycleId` with a real current-service resolver

### Front end

The overview is the interesting part. Today `ServiceOverviewView` renders the
phases of the one service directly. With two, the honest question is whether a
user is ever looking at **both at once**.

**Recommendation: no.** A service blueprint is a single continuous journey —
side-by-side services would fight for the same camera, the same lane rail, and
the same compare model, all of which assume one spine. Two services are two
workspaces, not two columns.

So:

```
┌─ sidebar ─────────────┐
│  ⌄ PLUS Tutoring      │  ← service switcher at the very top,
│  ─────────────────    │    above Service. One service is active.
│  Service              │
│  Phases               │
│    Application        │
│    Onboarding         │
│    …                  │
│  Slices               │
└───────────────────────┘
```

- [ ] Service switcher as the sidebar's first row — a `dropdown-menu.tsx`
      (the inventory's primitive for provider/model pickers, same shape)
- [ ] The **Service** row (from plan 003) sits under it, showing the *active*
      service's business model
- [ ] Switching services is a **navigation**, not a filter: clear the camera,
      the panel, and the compare selection. A stale cell panel from Service A
      floating over Service B is exactly the confusion this must avoid
- [ ] Empty state for a user with no membership

### Creating the second service — the step nobody has planned

Reading two services is the part that gets designed. **Making one is the part
that is missing entirely**, and it is where a team actually starts.

There is no "new service" path anywhere: no UI, no agent tool, no script. The
one service in the database arrived through the importer. So a second team's
first experience is a blank product with no way to begin.

- [ ] Decide what creating a service *means*. Three options, and they are not
      equivalent:
      **(a) empty** — a service with no phases, and a first-run flow that walks
      someone into `create_phase`;
      **(b) from a template** — copy a reference blueprint's structure with no
      content, which is what `services`' orphan `"Example API"` row looks like
      a half-built attempt at;
      **(c) import-only** — creating a service stays an operator task through
      the existing pipeline, and the product never offers it.
- [ ] Whichever it is, the **empty state is the product's first screen** for a
      new team. Today there is no empty state at any level — every view assumes
      content exists.
- [ ] `create_service` as an agent tool, or deliberately not. The canvas agent
      can already create phases, scenarios and paths; refusing it the root while
      granting it everything below is an odd line unless it is drawn on purpose.
- [ ] Membership: whoever creates a service is presumably its first member.
      That is the moment the membership table gets its first row, so the two
      cannot be designed apart.

**Recommendation: (a) empty, with a first-run flow.** A template hides the
model from the person who most needs to learn it, and import-only means the
product cannot onboard anyone without an operator.

### Agent

- [ ] The canvas agent inherits the active service from the app — it should
      **not** get a `service` parameter it could point elsewhere. The agent
      acts on what the human is looking at
- [ ] uno-bot is different: it has no "what am I looking at." It needs an
      explicit service, resolved from the Slack channel or workspace, and it
      must **refuse** rather than guess if that mapping is missing
- [ ] `list_blueprint` / `search_blueprint` tool descriptions say which service
      they cover, so the model never implies coverage it does not have

---

## Acceptance criteria

- [ ] No SELECT policy anywhere reads `using (true)`
- [ ] A user in Service A cannot read a single row of Service B — verified by
      querying as a real member of A, not by reading policy text
- [ ] `search_blueprint` with two services returns rows from exactly one
- [ ] Switching services clears camera, panel, and compare selection
- [ ] uno-bot refuses, with a message, when its channel maps to no service

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| A missed SELECT policy | **Critical** | Enumerate from `pg_policy`, not from memory; assert zero `using (true)` in a test |
| `search_blueprint` forgotten | **High** | Named first in this plan for that reason |
| Stale panel across a switch | Medium | Switching is navigation; clear all selection state |
| uno-bot guesses a service | High | Refuse-not-guess, the same posture as its absence handling |

## The honest recommendation

Do not build any of this speculatively — including the `filter_service`
parameter on its own. An unused filter is another thing that has to stay true
through every future change, and this session has already found two filters
that silently were not (`deletion_impact`'s lane branch, the harness's
`list_blueprint` case). Build the whole thing, once, when a second service is
real.

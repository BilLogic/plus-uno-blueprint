---
title: "One app, many services — the front end and what gates it"
type: feat
status: active
date: 2026-08-20
repos: uno-blueprint, plus-uno
brief: docs/plans/2026-08-20-001-spec-layer-brief.md
---

# Multi-service

> **Decided: one app, many services.** The earlier draft recommended one
> deployment per service. That is overruled — the schema already carries the
> service FK on every root table, so paying a whole deployment to avoid a
> dropdown is the wrong trade. The front-end work is scoped below and is
> genuinely small; **RLS is the part that is real work**, and it is what gates
> shipping to a second team, not the UI.

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

### Front end — the actual tweaks

Read every call site. **The hooks already take the parameter.** `useSlices` and
`useLifecyclePhases` both accept an optional `lifecycleId` and fall back to
"the first one" only when called with no argument — and **every call site calls
them with no argument.** So the work is supplying a value that already has a
socket, not threading a new one through.

**Ten places, three kinds.**

```
① the resolver              src/lib/lifecycle.ts:12-37
   findFirstLifecycleId caches ONE id module-level. Becomes
   findServiceIds() + an active-service resolver. The module-level
   cache must key by id or it will serve service A's id to service B
   after a switch — that cache is the single likeliest bug here.

② hooks called argless      6 sites, each gains one argument
   EditorContext.tsx:328            useLifecyclePhases()
   CreateBlueprintDialog.tsx:114    useLifecyclePhases()
   MobileShell.tsx:99               useSlices()
   TabStrip.tsx:188                 useSlices()
   SlicesSidebarSection.tsx:125     useSlices()
   CellInSlicesFooter.tsx:40        useSlices()

③ direct resolver calls     4 sites, each reads the active service instead
   SlideModeView.tsx:54-60          useEffect → setLifecycleId
   StructureRowMenu.tsx:315-322     useEffect → setLifecycleId
   CreateSliceSheet.tsx:126         findFirstLifecycleId at submit
   CellEvidenceTab.tsx:131          resolveFirstLifecycleId at insert
```

Two of those (`SlideModeView`, `StructureRowMenu`) hold a local `useState` +
`useEffect` purely to resolve the first id. **Both delete** — the context
supplies it synchronously.

#### The pieces to build

- [ ] **`ServiceContext`** — `{ activeServiceId, services[], setActiveService }`.
      Mounted above `EditorContext`, because `EditorContext:328` is a consumer.
- [ ] **Persist the choice** in the URL, not in local storage. A blueprint link
      pasted into Slack has to open the same service for the person who
      receives it. Local storage would open *their* last service and silently
      show the wrong blueprint under the right cell id.
- [ ] **The switcher** — `dropdown-menu.tsx` on the sidebar's service row.
      That row is already specified in [plan 003](2026-08-20-003-feat-entity-detail-panels-plan.md)
      as the trigger for the **service panel**, so the row now does two things
      and the split must be explicit: the **row** opens the panel, a **chevron**
      opens the switcher. Same pattern as the lane label and its `ⓘ`.
- [ ] **Hide it at one service.** A switcher offering one option is noise. The
      chevron appears only when `services.length > 1`.
- [ ] **Switching is a navigation, not a filter.** Clear the camera, the open
      panel, the compare selection, and the slice picker. A stale cell panel
      from Service A floating over Service B is the confusion to avoid — and
      the panel state is now five panels deep after plan 003, so this needs one
      reset function, not five call sites.
- [ ] **Empty state** for a user whose membership list is empty. *(Correction:
      an earlier draft said no view has an empty state at any level. Wrong —
      `CanvasEmptyState.tsx:42` has canvas / panel / phase variants. What is
      missing is the split between "nothing matched your filter" and "nothing
      exists yet"; see [plan 008](2026-08-20-008-feat-create-a-service-first-run-plan.md).)*

#### What is deliberately *not* front-end work

`search_blueprint`, `deletion_impact` and the authoring RPCs are all
server-side. Adding a switcher without `filter_service` on `search_blueprint`
(⚠️ section 3 above) produces the worst outcome available: a UI that claims to
be showing Service A while the agent answers from Service B. **The switcher
must not ship before the RPC filter.**

### Why not one deployment per service

Recorded because it was the earlier recommendation and was overruled:

| | One app per service | **One app, many services** |
|---|---|---|
| Isolation | total — separate database | RLS on nine tables |
| Front-end work | none | **10 call sites + a context + a switcher** |
| Backend work | none | membership table, policy rewrite, `filter_service` |
| Switching services | a different URL, a different login | in-app |
| Cross-service anything | impossible | possible later |
| Cost per new team | a Supabase project and a deploy | a row |

The deciding argument is the last row. Per-deployment isolation is real, but it
prices every new service at an operator task, and a product that cannot onboard
a team without an operator is not a product. RLS is a known, bounded piece of
work — nine tables, enumerable from `pg_policy` — and it buys the thing
deployments cannot: **one org seeing two of its own services in one place.**

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

## Order of work — and the one rule

RLS before UI. Always.

| # | Step | Why this order |
|---|---|---|
| 1 | `service_members` + rewrite every SELECT policy | one missed table is the whole leak; do it while there is still only one service and nothing can be exposed |
| 2 | `filter_service` on `search_blueprint` — `scoped`, `structural` **and** the total count | a filter reaching two of three under-reports silently |
| 3 | `ServiceContext` + the 10 call sites | mechanical once 1 and 2 exist |
| 4 | The switcher, hidden at one service | the visible half, and the smallest |
| 5 | Creating a service — now [plan 008](2026-08-20-008-feat-create-a-service-first-run-plan.md) | the first screen a second team ever sees |

**The rule: the switcher does not ship before step 2.** A UI that says
Service A while the agent answers from Service B is worse than no switcher —
it is a wrong answer wearing a correct label.

Steps 1 and 2 can land now against the single service and change nothing
observable. That is the argument for doing them first rather than waiting for a
second service to exist: they are verifiable while the blast radius is zero.

---
title: "Creating a service — the empty blueprint and the first ten minutes"
type: feat
status: active
date: 2026-08-20
repos: uno-blueprint
brief: docs/plans/2026-08-20-001-spec-layer-brief.md
related: docs/plans/2026-08-20-004-feat-multi-service-support-plan.md
---

# Create a service

**Decided: an empty service, plus a first-run flow that walks someone into
`create_phase`.** Not a template, not import-only. This plan is that design.

> **Why not a template.** A copied reference blueprint hides the model from the
> person who most needs to learn it, and the only evidence anyone tried is the
> orphan `services` row — `"Example API"`, slug `example-api`, description
> *"Placeholder service entry for local development"*. Template scaffolding
> that never became a feature.
>
> **Why not import-only.** A product that cannot onboard a team without an
> operator is not a product.

---

## Problem statement

There is **no "new service" path anywhere** — no UI, no agent tool, no script.
The one service in the database arrived through the importer. So a second
team's first experience is a blank product with no way to begin.

**And the blankness is worse than it sounds**, because every view assumes
content exists. `EditorContext.tsx:331`:

```ts
if (dbSlides.length === 0) return FALLBACK_NAV
```

Zero phases silently yields a hard-coded fallback navigation — the app shows a
plausible-looking shell for a blueprint that is not there.

### What already exists, and what does not

| | Status |
|---|---|
| `create_phase` RPC | ✅ `authoringRpc.ts:241` |
| `create_scenario` · `create_path` · `create_step` · `create_layer` RPCs | ✅ |
| `CreatePhaseDialog` | ✅ `src/components/editor/CreatePhaseDialog.tsx` |
| `CanvasEmptyState` (3 variants, takes `title` / `description`) | ✅ `CanvasEmptyState.tsx:42` |
| Agent tools: `create_phase`, `create_scenario`, `create_path`, `create_step`, `create_layer` | ✅ `specs.ts:425-602` |
| **`create_service`** — RPC, UI or tool | ❌ **nothing** |
| **A first-run state** — "nothing exists yet" | ❌ nothing |

> **Correction to [plan 004](2026-08-20-004-feat-multi-service-support-plan.md).**
> It says *"today no view has an empty state at any level."* Wrong —
> `CanvasEmptyState` exists with canvas / panel / phase variants. What is
> missing is the distinction between **"nothing matched your filter"** (built)
> and **"nothing exists yet"** (not built). Those need different copy and
> different actions, and conflating them is how a new team gets told to "pick
> one under Paths in the sidebar" on a blueprint with no paths.

---

## Proposed solution

### The shape: four steps, each one thing

The first-run flow is deliberately not a wizard with a progress bar. It is the
**empty state of each level, in turn**, each offering exactly the next thing.
The user can stop at any point and the blueprint is valid.

```
┌────────────────────────────────────────────────────┐
│                                                    │
│              Name your service                     │
│                                                    │
│   A service is one end-to-end journey — everything │
│   someone goes through, from before they arrive to │
│   after they leave.                                │
│                                                    │
│   Service name  [ PLUS Tutoring____________ ]      │
│                                                    │
│                          [ Create service ]        │
│                                                    │
└────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────┐
│  PLUS Tutoring                                     │
│                                                    │
│              Add the first phase                   │
│                                                    │
│   Phases are the stages of the journey — for       │
│   example Application, Onboarding, In-session.     │
│   You can rename and reorder them later.           │
│                                                    │
│   Phase name    [ Application_______________ ]     │
│                                                    │
│              [ Add phase ]   [ Ask the agent ]     │
│                                                    │
└────────────────────────────────────────────────────┘
                          │
                          ▼
     scenario  →  path  →  the canvas, with lanes
```

**Only a name is asked for at every step.** That rule is not invented here —
it is already the house position, written on the dialog this flow reuses:

> `CreatePhaseDialog.tsx:25-30` — *"Only a name is asked for. The description
> shows under the phase title and is worth having, but it is the kind of
> sentence that gets written properly on the second pass; demanding it up front
> is how placeholder text ends up in a blueprint."*

The business-model fields, the phase spec fields and everything else in
[plan 006](2026-08-20-006-design-data-model.md) are reached later through their
panels. **First run collects five words, not seventeen fields.**

### "Ask the agent" is the second button, not the first

The canvas agent can already create phases, scenarios and paths. On the
first-run screen it is offered as an alternative route, phrased as an
invitation rather than an upsell:

```
[ Add phase ]   [ Ask the agent to draft the phases ]
```

Picking it opens the agent panel pre-seeded with a message the user can edit
before sending — never auto-sent. A blueprint whose first six phases were
written by an agent the user never spoke to is the wrong first impression for
a tool whose whole discipline is *a cell with no evidence is an assumption*.

### `create_service` as an agent tool: **yes**

The agent can already create every level below the root. Refusing it the root
alone is an odd line unless drawn on purpose, and there is no purpose here —
`create_service` is no more destructive than `create_phase`, and the session
ledger reverts it like anything else.

| | |
|---|---|
| Tool | `create_service(name, summary?)` |
| Writes | one `services` row, one `service_members` row for the caller |
| Ledger | `create_service`, label *"Created service «name»"* |
| Revert | delete the service **only when it still has zero phases** — see below |
| Refuses | a service-account session with no user identity to make a member |

### Membership, which cannot be designed separately

Whoever creates a service is its first member. That is the moment
`service_members` (from plan 004) gets its first row, so **the two ship
together or the creator locks themselves out of what they just made.**

```sql
-- inside create_service, one transaction
insert into public.services (name, summary) values (…) returning id into new_id;
insert into public.service_members (service_id, user_id, role)
values (new_id, auth.uid(), 'owner');
```

`security definer` with a pinned `search_path`, matching every other authoring
RPC. **Both inserts or neither** — a service with no members is unreachable by
its own creator and invisible to everyone else, which is a row that can only be
cleaned up by an operator.

---

## Technical considerations

### Revert has a real boundary

Every authoring write in this app is revertible within its session
(`revertChange.ts`). `create_service` is the first write whose revert can
destroy other people's work: revert it an hour later, after phases and cells
exist, and the cascade takes them.

**Rule: reverting `create_service` is refused once the service has any child
row.** The ledger entry stays, marked non-revertible, with the reason shown.
This is the same shape as the deletion-impact guard, and it should reuse
`deletion_impact` rather than invent a second count.

### The `services` placeholder row must go first

[Plan 002](2026-08-20-002-refactor-database-vocabulary-plan.md) Phase 6 drops
the orphan `services` table and renames `service_lifecycles` into its place.
**This plan cannot start until that lands**, because `create_service` has to
write to the table that is actually the root — and today that is
`service_lifecycles`, while the table *named* `services` is a placeholder
nothing reads.

Its `slug` column is resolved as a question: it is `example-api`, alongside the
description *"Placeholder service entry for local development."* Template
scaffolding, not a designed URL scheme. **Nothing to preserve** — recorded so
plan 002 can drop the table without hesitating.

### The first-run state must not be reachable by accident

`dbSlides.length === 0` is also true while loading, and while a query has
failed. `EditorContext.tsx:362` already separates the first of those:

```ts
const slidesLoading = configured && loading && dbSlides.length === 0
```

- **loading** → skeleton (`deferred-skeleton.tsx`)
- **error** → an error state, not an invitation to create
- **loaded, genuinely zero** → first run
- **not configured** (no Supabase env) → the existing unconfigured path

Showing "Name your service" to someone whose network blipped is how a duplicate
service gets created.

---

## System-wide impact

**Interaction graph.** `create_service` → `services` insert → `service_members`
insert → `invalidateStructure()` → `useLifecyclePhases` refetch →
`EditorContext` rebuilds nav → the first-run state unmounts and the phase step
mounts. The nav rebuild is the step most likely to flash `FALLBACK_NAV`, since
zero phases is still true for the moment between the two.

**Error propagation.** A failed `service_members` insert must roll the service
back inside the RPC — PostgREST surfaces one error, the dialog shows it, and
`CreatePhaseDialog.tsx:57-62` is the precedent for how (message shown inline,
`busy` cleared in `finally`).

**State lifecycle.** The one orphan risk is a service with no member. The
transaction closes it. There is no partial state below that: a service with no
phases is a **valid** state, and is exactly what first run creates.

**API surface parity.** Three entry points must agree: the first-run UI, the
agent tool, and the RPC. The RPC is the only one that writes; the other two
call it. No second definition of "create a service."

**Integration scenarios unit tests will not catch:**

1. Create a service, then revert in the same session **before** adding a phase
   → the service is gone, the ledger entry is marked reverted.
2. Create a service, add a phase, then attempt revert → refused with a reason.
   The phase survives.
3. Create a service while RLS is on → the creator can immediately read it. This
   is the test that proves the membership row landed.
4. Two browser tabs both on first run, both submit → two services, both valid,
   both owned. Ugly but not corrupt; the switcher shows both.
5. A service-account session calls `create_service` → refused, because
   `auth.uid()` is null and the membership row cannot be written.

---

## Acceptance criteria

- [ ] `create_service` RPC writes the service **and** its owner membership row
      in one transaction, or neither
- [ ] It is `security definer` with a pinned `search_path`, like every other
      authoring RPC
- [ ] `create_service` exists as an agent tool with a ledger entry and a revert
      case
- [ ] Revert is refused once any child row exists, with the reason shown, using
      `deletion_impact` for the count
- [ ] First run distinguishes loading / error / genuinely-empty / unconfigured
- [ ] Every first-run step asks for a **name only**
- [ ] "Ask the agent" pre-seeds a message and never auto-sends it
- [ ] `FALLBACK_NAV` never renders during the create→refetch gap
- [ ] A new service is readable by its creator with RLS enabled

## Dependencies

| Depends on | Why |
|---|---|
| [002](2026-08-20-002-refactor-database-vocabulary-plan.md) Phase 6 | `create_service` must write to the real root table |
| [004](2026-08-20-004-feat-multi-service-support-plan.md) step 1 | `service_members` must exist before anything can own a service |

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Service created with no membership row | **Critical** — unreachable, operator-only cleanup | One transaction, both inserts |
| Revert destroys real work | **Critical** | Refuse once children exist |
| First run shown on a transient error | High | Four distinct states, not one `length === 0` |
| `FALLBACK_NAV` flashes as real navigation | Medium | Gate it on "loaded and genuinely empty" |
| Agent drafts phases the user never reviewed | Medium | Pre-seed, never auto-send |

## Sources

- `src/components/editor/CreatePhaseDialog.tsx:25-30` — the name-only rule, in
  the codebase's own words
- `src/lib/authoringRpc.ts:241-250` — `createPhase`, the RPC shape to match
- `src/contexts/EditorContext.tsx:331,362` — `FALLBACK_NAV` and the loading split
- `src/components/editor/CanvasEmptyState.tsx:5-48` — the existing empty-state
  primitive and its three variants
- `src/lib/agent/tools/specs.ts:425-602` — every `create_*` tool that exists
- The `services` placeholder row, read from the live database on 2026-08-20:
  `name: "Example API"`, `slug: "example-api"`,
  `description: "Placeholder service entry for local development"`

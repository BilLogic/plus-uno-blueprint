---
status: accepted
audience: developers
summary: When a deployment holds more than one service, the journey entities (phase, scenario, path, step, lane, cell, slice) are a hard per-service boundary while the catalog of nouns a journey references — touchpoints and stakeholders both — is one deployment-level pool where the name is the identity and a service's membership is implicit in what its journey references, so a tool or actor is recorded once and reused across services without a palette to author or keep in sync.
---

# A service owns its journey and shares the catalog

A deployment can hold more than one service (#303). That forces a domain question
the single-service model never had to answer: when there are two services, what is
each service's own, and what do they share? The answer is one rule —

**A service owns its journey; the catalog of nouns its journey references is the
deployment's.**

- The **journey** — phase, scenario, path, step, lane, cell, slice — is a **hard**
  boundary: mutually exclusive per service, never crossing. Two services' boards do
  not share a phase or a lane, and a slice stays within one service.
- The **catalog** — the nouns a journey points at — is **soft**: one deployment-level
  pool. It holds both **touchpoints** (the tools) and **stakeholders** (the actors).
  A cell references a shared touchpoint; a lane references a shared stakeholder; the
  references are per-service, the referents are the deployment's.

Two decisions give the catalog its shape: the **name is the identity** (one pool,
unique by name across the deployment), and a service's **membership is implicit**
(a service "has" a catalog entry exactly when its journey references it — there is no
palette to author).

## Why the catalog holds actors too, and not just tools

The tools are obviously shareable — the same Zoom touches several of an org's
services. The open question was the actors: a stakeholder attaches to a lane, and
lanes are journey (hard), so it was tempting to leave stakeholders per-service. Three
things settle it the other way.

First, **coherence**: a touchpoint row carries `stakeholder_id`. If touchpoints were
a deployment-level pool but stakeholders stayed per-service, a shared touchpoint's
`stakeholder_id` would have to point at *one* service's actor — which one? The split
is the incoherent option, not the safe one.

Second, **the model already reads this way**: a lane does not define its actor, it
**picks one from a shared cast** — the stakeholder registry is a pool of reference
data a lane selects from, exactly the shared-catalog shape. Making the pool
deployment-wide is what the picker already wants; today's per-service `stakeholders`
read is even done *unscoped*, which under a shared catalog stops being a bug and
becomes correct.

Third, **cost is symmetric**: `stakeholders` and `touchpoints` are structurally
twins — both a per-service registry with `unique (service_id, name)`, referenced by a
journey entity. Sharing an actor is the same reshape as sharing a tool, not a larger
one, so the choice is domain merit, not effort — and the same actor ("the student")
does recur across an org's services just as the same tool does.

So the catalog is the shared **nouns**: tools and actors, one pool.

## Why the name is the identity

A touchpoint is minted by name — a cell's text names a tool and the catalog gets a
row. In one pool, a **deployment-unique name** is how a second service reuses an
entry: it names the same tool the same way and references the row that already
exists. If two services run *different* tools, they carry *different* names — "Gmail"
and "Outlook", not two rows both called "Email". Distinct nouns take distinct names;
an identical name means the identical thing. Uniqueness therefore moves from
`(service_id, name)` to `(name)` across the deployment, for touchpoints and
stakeholders alike.

The rejected alternative was independent identity — each service keeps its own
"Email" and any sharing is declared explicitly. That defeats the reason the catalog
exists (record a tool once, reference it everywhere) and puts the burden of sharing
on an authoring step instead of on the name.

## Why membership is implicit

A service "has" a catalog entry exactly when its journey references it — a touchpoint
when one of its cells names it, a stakeholder when one of its lanes picks it. There is
**no `service_touchpoints` / `service_stakeholders` link table**, no authored palette.

- Touchpoints are **created inline** — minted from a cell's text by the sync RPC,
  with no "add a tool to this service" gesture anywhere. Implicit is the only model
  coherent with how a touchpoint is born; an explicit palette would bolt an authoring
  step onto an entity that has none.
- Stakeholders are **picked from the pool** by a lane, which is implicit by
  definition — a curated per-service cast list would be a second thing to keep in
  step with what the lanes actually use.
- Implicit is **divergence-free**. An explicit palette can drift from reality (an
  entry "in the palette" no journey uses, or the reverse) — the wart the current
  never-pruned registry already shows. Implicit makes a service's set exactly its
  usage.

The one thing implicit gives up is picker scoping: authoring a service shows the
whole deployment catalog rather than a curated subset. At the expected scale (the
common case is a single service; multi-service is a handful) that is fine, and
"this service's already-used entries first" is a read-side sort, not a table. And an
explicit palette stays a **clean additive step** for later — it can be added over the
shared catalog without reshaping it — so implicit now is the deferral, not a corner.

## Consequences

- `touchpoints` and `stakeholders` **drop their `service_id` owner**; uniqueness
  becomes `(name)` deployment-wide. The touchpoint sync RPC's `on conflict
  (service_id, name)` becomes `on conflict (name)`. These are the one genuine
  data-model change multi-service forces; the rest of #303 is navigation, routing,
  and read-scoping, not schema.
- `touchpoints.stakeholder_id` is coherent again — both ends are now deployment-level.
- The **registry becomes a deployment-level library**: a catalog can hold a tool or
  actor no current journey uses, which at deployment scope is a feature (a shelf of
  the org's tools), not the accidental accumulation it reads as per-service today.
- **`CONTEXT.md` reverses a glossary claim**: the touchpoint entry that says it
  "belongs to the service" becomes "belongs to the deployment"; the touchpoint and
  stakeholder rows in the field tables lose their service scoping. The implementing
  work updates the glossary in step (per [ADR 0009](0009-the-migration-series-is-a-narrative.md),
  the migration that drops `service_id` is where the reasoning is written).
- The **agent's per-service search scope** (a #303 requirement) derives a service's
  catalog from its journey's references, since membership is implicit — a join, not a
  membership lookup.
- This model is the canonical one, so it is the shape asb's touchpoint registry
  reconciles to under the convergence work (ADRs [0012](0012-uno-is-a-deployment-of-the-template.md)
  / [0013](0013-the-deployment-imports-the-template.md)); it is not a uno-only choice.

## Still open

- **An explicit per-service palette** is deferred by design — additive over the shared
  catalog if a large deployment ever finds the picker noisy, and recorded here only so
  that a future reader knows it was a deliberate deferral, not an oversight.
- **The name-collision authoring nicety** — guiding an author who names a new tool
  with a name the deployment already uses for a different one — is UX, not model, and
  needs no record until it is built.

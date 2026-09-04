---
status: accepted
audience: developers
summary: The template (asb) owns the whole agent — its loop, its tools, and its canvas doctrine — and a deployment configures it through the typed `DeploymentConfig` alone, never by shipping an agent or authoring its own doctrine; uno's canvas-adapter override is canvas-app doctrine misfiled in the deployment, and it is deleted at the flip rather than carried as config.
---

# The template owns the agent, and a deployment configures it

[ADR 0013](0013-the-deployment-imports-the-template.md) settled that asb exports a
mountable application — "root, routing, data layer, **agent**, auth wiring" — and that
uno mounts it through a typed `DeploymentConfig`. It did not settle what the deployment
may say to that agent. This is that record: the agent is the template's, whole, and a
deployment reaches it only through the config. Five choices, each downstream of the last.

1. **The agent is the template's, whole.** asb's `App` carries the one canonical agent —
   the loop, the tool registry, and the canvas doctrine (the adapter). A deployment ships
   no agent. asb already has this agent today (`src/lib/agent/`), so the convergence is a
   reconcile, not a new build.

2. **The doctrine is canonical, not deployment content.** uno's
   `src/lib/agent/canvas-adapter.md` override exists for one reason: the pre-flip package
   adapter was IDE-oriented and enumerated the wrong tool registry
   ([#115](https://github.com/BilLogic/plus-uno-blueprint/issues/115)). Its content —
   the surface mapping, the canvas audit/whatif runs, the session tiers, the app-only
   invariants, the etiquette — is **canvas-app doctrine true of every deployment**, not
   PLUS's. It reads as deployment-specific only because uno was the sole canvas app while
   the template still spoke to an IDE. At the flip the override **file is deleted**, and
   its doctrine is asb's canonical adapter.

3. **The tool surface is the generalized superset.** The tools a deployment's agent may
   call are asb-canonical capabilities. uno's larger set — stakeholders, evidence,
   sessions — are asb domain concepts ([CONTEXT.md](../../CONTEXT.md),
   [ADR 0014](0014-a-service-owns-its-journey-and-shares-the-catalog.md)), so asb carries
   them for **every** deployment. A deployment narrows what its agent can do through its
   session and role model — the live tool list is the truth — never by omitting tools from
   a hand-written roster that can drift from the code.

4. **The vocabulary is one canonical word.** `cell_dependencies.kind` is `leads_to` /
   `enables` in both databases, and the agent speaks that one vocabulary. Internal code
   names that still read *trigger* (`BlueprintCellTrigger`, `BlueprintTriggerArrows`, the
   adapter's `trigger-vs-needs` prose) are **unconverged naming**, inconsistent with the
   template's own enum, and are reconciled to the canonical word — not preserved as a
   per-deployment dialect.

5. **`DeploymentConfig` carries content and brand, never doctrine.** The typed config
   (ADR 0013 §4) carries the deployment's content (cover copy, workspace title) and a
   minimal brand block (name, logo, accent), plus — where a deployment's **data model**
   genuinely differs, such as per-slot cell stacking (`position`) — a declared dialect
   flag the canonical code reads. It does **not** carry agent instructions, prompt text,
   or vocabulary. There is deliberately **no free-text agent-doctrine slot**.

## Consequences

This closes #115's shape permanently. No deployment restates the tool roster or the
doctrine in prose that can drift from the code, because there is nowhere to write such
prose: a genuinely deployment-specific agent need is met by a **canonical capability** or
a **typed config field**, or it is not met — it is never met by a hand-authored override.

Two guards exist only to hold uno's override honest against the package —
`scripts/check-write-surface.mjs` (the served adapter against the tool rosters) and the
`#319` reconciled-files drift gate over the shared agent files. Both are retired at the
flip ([#333](https://github.com/BilLogic/plus-uno-blueprint/issues/333)), because the
thing they guard — a second, hand-maintained statement of what the code already says —
is gone once the deployment mounts the template's agent directly.

**What this gives up, chosen deliberately:** a deployment can no longer tell its own agent
something no other deployment says without that guidance becoming a canonical asb
capability or a typed config field first. A controlled "addendum" slot was weighed and
declined in favour of maximal convergence and zero drift surface — the direct expression
of [ADR 0012](0012-uno-is-a-deployment-of-the-template.md)'s "asb is canonical" for the
one surface, the agent prompt, where a deployment is most tempted to keep authoring.

---
status: accepted
audience: developers
summary: The template (asb) owns the agent's canonical baseline — its loop, its tools, and a default doctrine — and a deployment tunes it through the typed `DeploymentConfig` the same way it tunes the UI, never by editing template code; uno, being the prototype that defines the product, contributes its agent into the canonical default rather than carrying a per-deployment override, so uno's canvas-adapter override folds into the default and disappears at the flip.
---

# The template owns the agent, and a deployment configures it like the UI

[ADR 0013](0013-the-deployment-imports-the-template.md) settled that asb exports a
mountable application — "root, routing, data layer, **agent**, auth wiring" — and that
uno mounts it through a typed `DeploymentConfig`. It did not settle what a deployment may
say to that agent. This is that record. The agent is the template's, and a deployment
reaches it only through the config — but the agent is a **configurable** surface, the same
as the UI, because asb is meant to be published and run by deployments other than uno.
Five choices, each downstream of the last.

1. **The agent is the template's, whole.** asb's `App` owns the canonical agent — the
   loop, the tool registry, and a **default doctrine** (the canvas adapter). A deployment
   ships no agent code. asb already has this agent today (`src/lib/agent/`), so the
   convergence is a reconcile, not a new build.

2. **A deployment configures its agent the way it configures its UI.** The agent's
   doctrine and config — which tools are enabled, guidance a deployment adds, the display
   words for a concept — are a **first-class part of `DeploymentConfig`**, peer to brand
   and content. A published deployment *tunes* its agent through typed, reviewable config;
   it does not fork it and it does not edit template code
   ([ADR 0013](0013-the-deployment-imports-the-template.md)'s import-not-overlay stands).
   The agent is not a closed surface — it is a configured one.

3. **The canonical default is what the prototype defines.** uno is the **prototype** that
   defines the product, so its agent features — its tool surface, its canvas doctrine, its
   vocabulary — bake into asb as the **canonical default** every deployment starts from.
   uno's `src/lib/agent/canvas-adapter.md` override is therefore not a deployment's
   per-instance config: it is the prototype authoring the default, and it only *reads* as
   a deployment override because uno was the sole canvas app while the package still spoke
   to an IDE ([#115](https://github.com/BilLogic/plus-uno-blueprint/issues/115)). It folds
   into asb's canonical doctrine, and uno then runs on that default with **no agent-config
   delta of its own**. The override **file is deleted at the flip** because its content
   *became the default*, not because configuring an agent is forbidden.

4. **The tool surface is the generalized superset — available, and configurable.** The
   canonical tools are asb concepts: uno's larger set (stakeholders, evidence, sessions)
   are asb domain concepts ([CONTEXT.md](../../CONTEXT.md),
   [ADR 0014](0014-a-service-owns-its-journey-and-shares-the-catalog.md)), so asb carries
   them for every deployment. A deployment enables or narrows them through config and its
   session/role model — never by omitting tools from a hand-written roster that drifts from
   the code, which is the failure [#115](https://github.com/BilLogic/plus-uno-blueprint/issues/115)
   was.

5. **The data model is canonical; its words travel with the config.**
   `cell_dependencies.kind` is `leads_to` / `enables` in every deployment's database — one
   canonical model. What the agent and the UI *call* it — display copy, prompt phrasing —
   is deployment-configurable, the same as any UI label. asb's internal names that still
   read *trigger* (`BlueprintCellTrigger`, `BlueprintTriggerArrows`, the adapter's
   `trigger-vs-needs` prose) are **unconverged naming**, inconsistent with the template's
   own enum, and are reconciled to the canonical word — the default the config starts from,
   not a per-deployment dialect baked into code.

## Consequences

**For uno, now:** no override and no agent-config delta — it runs the canonical default it
authored as the prototype. The two guards that exist only to hold uno's prototype override
honest against the package — `scripts/check-write-surface.mjs` and the `#319`
reconciled-files drift gate over the shared agent files — retire at the flip
([#333](https://github.com/BilLogic/plus-uno-blueprint/issues/333)), because once uno's
doctrine *is* the canonical default there is nothing left to hold honest.

**For a published asb, later:** a deployment customizes its agent — its doctrine additions,
its enabled tools, its display words — through `DeploymentConfig`, typed and reviewed like
the rest of the config, exactly as it customizes brand and content. The configurable seam
is the config; the code stays the template's.

**The line this draws:** baking a feature into the canonical default (what uno, the
prototype, does) and configuring it per deployment (what a published deployment does) are
two different acts on the same surface. uno's agent arrives as canonical because uno is
defining the product; a later deployment's arrives as config because it is adopting one.
What neither does is edit the template's agent code in place.

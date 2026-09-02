---
status: accepted
audience: developers
summary: The deployment consumes the canonical template by importing it as a pinned-by-release-tag git dependency and mounting its whole app through a typed `DeploymentConfig` prop — never by vendoring or editing the code in place — so that drift is structurally impossible and an upgrade is a reviewable tag bump.
---

# The deployment imports the template, and never edits it

[ADR 0012](0012-uno-is-a-deployment-of-the-template.md) settled that
`agentic-service-blueprinting` (asb) is the canonical application code and uno is a
deployment over it, and deliberately left *how* the deployment consumes that code to
its own record. This is that record. Four choices, each downstream of the last:

1. **Import, not overlay.** The deployment takes asb as a **dependency it imports**,
   not code vendored (git subtree) or nested (git submodule) inside it.
2. **A git dependency, pinned by release tag.** The dependency is a git ref — the
   mechanism uno already runs for asb's IR schema and seed generator
   (`agentic-service-blueprinting#v0.5.0`), not a package published to a registry —
   pinned to a **release tag**, with a commit SHA as the escape hatch for an urgent
   hotfix between releases.
3. **The whole app, not a component library.** asb exports a **mountable
   application** — root, routing, data layer, agent, auth wiring — and uno is a
   razor-thin deployment, not an app shell that imports asb's components.
4. **Mounted through a `DeploymentConfig` prop.** uno's entry renders
   `<App config={deploymentConfig} />`; asb owns the typed `DeploymentConfig`. The
   config carries the deployment's **content** (cover copy, workspace title) and a
   **minimal brand block** (name, logo, accent). Secrets (the Supabase URL and anon
   key) stay in **env**; the blueprint rows and the per-kind examples stay in the
   **database**.

## Why import, and not subtree or submodule

The overlay shapes let uno hold asb's code and put PLUS on top of it. A **subtree**
vendors the code editable in place, so uno *can* change canonical files — which is
exactly the drift ADR 0012 exists to end, now guarded only by a check and a habit. A
**submodule** pins but nests a second checkout inside uno, with the familiar
contributor friction (detached HEAD, a forgotten init, an un-bumped ref) and no gain
over a dependency. **Importing** makes the guarantee structural instead of
disciplinary: uno cannot edit what it imports, so a change to shared code either
lands upstream in the canonical repo or it does not land at all. Drift stops being
something a check catches and becomes something the shape forbids.

A published npm package would give the same guarantee, but at the cost of a registry
and a release-publish step for no benefit uno needs: a **git dependency** is free, is
already how uno consumes asb's non-app code, and pins just as hard.

## Why the whole app, and not a component library

A component library — asb exports components and hooks, uno keeps its own `main`,
providers, routing, Supabase client and content module — leaves uno **owning the app
shell**. That shell (the editor shell, the provider tree, the shell/canvas clocks of
[ADR 0010](0010-the-canvas-and-the-shell-run-on-separate-clocks.md)) is precisely the
shared surface that drifted nine hundred lines in the first place. Keeping it in uno
keeps the drift surface live and the ADR 0012 guarantee half-real. Exporting the
**whole app** pushes that shell into the canonical repo and leaves uno holding only
config, env, and its own database — the only version in which "uno is a deployment"
is literally true and the re-drift surface is near zero.

## Why a config prop, and not an alias module

asb could read its per-deployment values from a well-known module path that uno
supplies through a Vite alias or a package export override. That hides the contract
in build configuration — implicit, and unchecked across the boundary. A **typed
`DeploymentConfig` passed to the mounted root** puts the contract where it belongs: a
single visible boundary asb declares and uno fills, type-checked at the mount point,
and trivially faked in a test. The one place the two repos meet should be the most
legible line in the system, not the most magic.

## Consequences

- **asb grows a public surface it did not have: a mountable `App` and a
  `DeploymentConfig` type.** Everything deployment-specific — content, the brand
  block — is parameterized behind that type; everything else is asb's to change
  without uno's involvement.

- **This is adopted at the *end* of convergence, not the start.** uno can only import
  the app once asb can render everything uno renders today — so the reconciliation of
  ADR 0012 (porting uno's entity-panel and definition system into canonical, folding
  asb's registry in, reconciling drift) must land first. The import is the last step
  that flips uno from a fork to a deployment, not the first.

- **Upgrades become a reviewable tag bump.** Moving uno to a new asb release is a PR
  that changes one ref; a red asb release cannot reach PLUS production until uno
  chooses to pull it. This is the deliberate cost of the pin from ADR 0012's sibling
  reasoning — zero-lag convergence is traded away for a gate on what reaches prod.

- **The split is fixed: secrets in env, rows in the database, copy and brand in the
  config.** A deployer stands up their own Supabase (the portable core plus recipe
  plus seed), sets two env values, and writes a small config module — and never
  touches code. The `entity_examples` git-dep seam (#313) is the same import extended
  from the seed generator to the app.

- **The brand block stays small on purpose** — name, logo, accent, not a theme
  engine. A richer theme can arrive later behind the same `DeploymentConfig` seam
  without changing this decision.

## Still open

Nothing that blocks #304. The brand block's exact fields and a richer theme are
deferred by design and need no record until they are built.

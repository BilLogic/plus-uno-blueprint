---
status: accepted
audience: developers
summary: The template `agentic-service-blueprinting` is the canonical application code, and uno becomes a deployment of it — the same code plus a data, environment, and content overlay carrying PLUS's branding and blueprint — rather than a fork maintained in parallel, because the generic thing must be the base and PLUS is already almost entirely data.
---

# uno is a deployment of the template, not a fork of it

Two repositories render the same service blueprint. `agentic-service-blueprinting`
(asb) is the publishable template a non-professional installs; `plus-uno-blueprint`
(uno) is the live PLUS instance. They began as one renderer and forked in both
directions: uno carries roughly the entity-panel and definition system asb lacks,
asb carries the registry and tech-pill components uno lacks, and shared files have
drifted by hundreds of lines — the cell detail panel alone by over nine hundred.
There is no automated sync and no drift check, so an improvement is authored once
and hand-ported to the other, scrubbed of PLUS names, one ticket at a time — slow,
and drift creeps in unseen until someone measures it (#304).

The decision: **asb is the canonical source of truth for application code, and uno
is a deployment overlay over it** — the same code plus data, environment, and the
content surface that carries PLUS's branding, cover copy, per-kind examples, and
blueprint data. Features are authored asb-first (generic) and flow to uno; **PLUS
lives entirely in data, never in code.** One edit, both current, and the template a
vibe coder installs is the same code PLUS runs.

## Why asb is canonical, and not uno or a shared third

Three shapes were on the table.

- **Keep forking, hand-port each change** (the status quo). Rejected: it is what
  produced a nine-hundred-line gap no one chose and no one saw until it was
  measured. Every frontend improvement pays the port tax twice, and the drift is
  invisible between measurements.

- **uno canonical, asb derived.** Rejected on the direction of specialization. asb
  is the generic template; uno is the *specialized* instance that adds PLUS. If the
  specialized instance were the base, PLUS's content would be baked into the root
  and the template would forever be "uno minus PLUS" — a subtraction that has to be
  redone on every change and can never be verified complete. The canonical repo must
  be the one with **no** deployment-specific content, so that shipping the template
  is shipping the base, not un-shipping PLUS.

- **asb canonical, uno a deployment overlay** (chosen). The template is the generic
  base; PLUS is data over it. This is cheap precisely because PLUS is already about
  99% data — after the canvas-affordances work (#301) removed the last code that
  named PLUS (two comments), the PLUS-specific surface is branding, the
  cover-content module, the workspace title, the per-kind examples (#302), and the
  blueprint rows. The backend is already replayable this way — the portable core plus
  the Supabase recipe plus a generated seed stand up on a fresh database — so this
  brings the frontend to a standard the backend already meets.

## Why "PLUS as data, never code"

The overlay is only sound if the boundary is enforceable. Branding, the
cover-content module, the workspace title, the per-kind examples, and the blueprint
data are all data or config; no PLUS reference ships in the canonical code. asb's
existing standalone check already enforces this in the template, and it extends to
the whole canonical set. A deployer's content then survives a code upgrade untouched,
because the upgrade never reaches it — the same property that lets the seed carry
PLUS's blueprint without a PLUS line in the schema.

## Consequences

- **Authoring inverts to asb-first.** Once converged, a feature is written generic in
  the canonical repo and flows to the deployment; uno is run locally against real
  PLUS data to feel a change against real content, but the change is authored in the
  template. This is the opposite of today, where uno leads and asb lags — and it is
  why the uno-first fixes (#301, #302) were sequenced to land *before* convergence:
  converge a stable uno, not one still being fixed.

- **Reconciliation is the bulk of the work, and it is a union, not a rewrite.** The
  divergence is drift we created plus a component-set union: port uno's entity-panel
  and definition system into the canonical code, fold asb's registry and tech
  components in, reconcile each drifted shared file to one implementation, and finish
  the vocabulary alignment so the same concept is not two words in two repos.

- **A drift check makes divergence loud.** A parity check fails when shared code
  diverges between the canonical repo and the deployment overlay, so drift is
  surfaced on every change rather than discovered by accident. Its backend companion
  is a "seed loads on a fresh core" check, so the documented vibe-coder setup path is
  guarded the same way.

- **The standalone check is now load-bearing for both repos**, not just asb — it is
  the mechanism that keeps PLUS out of the canonical code, so weakening it re-opens
  the fork.

## Still open — the sync mechanism is a separate decision

This ADR records *that* uno consumes the canonical code as an overlay. It does **not**
decide *how* the deployment consumes it — git subtree, git submodule, or a shared
published package — which is a genuine trade-off deserving its own ADR before the
reconciliation begins:

- **subtree** — the canonical code is vendored into the deployment; a plain checkout,
  no extra clone step, but upstream merges are a manual subtree pull.
- **submodule** — a pinned upstream ref, cleanest separation, but real contributor
  friction (detached HEAD, an extra init/clone, easy to forget to bump).
- **shared package** — versioned upgrades with ordinary dependency semantics, but it
  requires publishing the app as an installable shell and is the heaviest upfront.

Recorded lean, not decided: a shared package extends the model already in place —
uno pulls asb in as a git dependency today for the IR schema and seed generator
(the `entity_examples` round-trip in #313 rides exactly that seam) — and gives the
same versioned-upgrade story the backend template already has. But this is Bill's
call and gets its own ADR.

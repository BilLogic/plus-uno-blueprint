---
audience: developers
summary: What earns an ADR here, the numbering and template, and the current set.
---

# Decision records

An ADR here records a choice that is **surprising without context** or **hard to
reverse** — the two together, usually. Not every decision: most of what this
codebase does is ordinary and belongs in
[engineering/codebase-guide.md](../engineering/codebase-guide.md), which
describes rather than justifies.

The test is a future reader's question. If someone six months from now will look
at the code and think *"that is the wrong way round, I'll fix it"* — and be
wrong — the reasoning owes them a record. If they would simply nod, it does not.

## Shape

`NNNN-a-sentence-in-the-imperative-or-the-present.md`, numbered in the order
they were accepted, never renumbered. Frontmatter carries `status` and a
`summary` (which is what the generated index shows). The body states the
decision, then why, then a **Consequences** section that names what the decision
costs and — where there is one — the plausible "fix" that would undo it.

A superseded record keeps its number and its file, and says what replaced it. A
deleted ADR is a decision nobody can find the reasoning for.

## The set

Decisions about the template's code, and about how a deployment consumes the template, are recorded in the template. Fourteen of the records below are pointers to it: each keeps its number here so a citation still lands, and names the template's record by repository and number, because the two repositories number independently. Two, 0007 and 0009, are about this deployment alone and are recorded here in full. A new decision about this deployment alone is recorded here; anything else is recorded in the template.

| # | Decision |
|---|---|
| [0001](0001-one-token-model-as-the-single-test-seam.md) | One token model is the single seam for style enforcement — in the template as [0006](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0006-one-token-model-is-the-single-style-seam.md) |
| [0002](0002-typescript-owns-layout-numbers.md) | TypeScript owns every layout number; CSS receives them — in the template as [0013](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0013-typescript-owns-layout-numbers.md) |
| [0003](0003-vendored-primitives-stay-pristine.md) | The vendored `ui/` layer stays pristine — in the template as [0014](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0014-vendored-primitives-stay-pristine.md) |
| [0004](0004-the-board-is-always-fully-mounted.md) | The board is always fully mounted — in the template as [0015](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0015-the-board-is-always-fully-mounted.md) |
| [0005](0005-cross-surface-state-is-a-module-store.md) | Cross-surface state is a module store, not context — in the template as [0005](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0005-cross-surface-state-is-a-module-store.md) |
| [0006](0006-reads-never-refetch-on-their-own.md) | Reads never refetch on their own — in the template as [0016](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0016-reads-never-refetch-on-their-own.md) |
| [0007](0007-three-advisor-warnings-that-must-stay.md) | Three advisor warnings are deliberate and must stay |
| [0008](0008-large-component-splits-wait-for-an-end-to-end-round.md) | Large component splits wait for an end-to-end round — in the template as [0017](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0017-large-component-splits-wait-for-an-end-to-end-round.md) |
| [0009](0009-the-migration-series-is-a-narrative.md) | The migration series is a narrative; the board is imported data |
| [0010](0010-the-canvas-and-the-shell-run-on-separate-clocks.md) | The canvas and the shell run on separate clocks — in the template as [0007](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0007-the-canvas-and-the-shell-run-on-separate-clocks.md) |
| [0011](0011-featured-is-one-column-two-verbs.md) | Featured is one column, two verbs — in the template as [0018](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0018-featured-is-one-column-two-verbs.md) |
| [0012](0012-uno-is-a-deployment-of-the-template.md) | uno is a deployment of the template, not a fork of it — in the template as [0019](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0019-the-deployment-is-a-deployment-of-the-template.md) |
| [0013](0013-the-deployment-imports-the-template.md) | The deployment imports the template as a pinned git-dep and mounts it with a config — in the template as [0020](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0020-the-deployment-imports-the-template.md) |
| [0014](0014-a-service-owns-its-journey-and-shares-the-catalog.md) | A service owns its journey and shares the catalog (touchpoints + stakeholders, deployment-level) — in the template as [0003](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0003-a-service-owns-its-journey-and-shares-the-catalog.md) |
| [0015](0015-the-template-owns-the-agent.md) | The template owns the agent; a deployment configures it like the UI (uno, the prototype, bakes its agent into the canonical default) — in the template as [0021](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0021-the-template-owns-the-agent.md) |
| [0016](0016-the-history-tier-is-retired.md) | The history tier is retired; the queue is issues and durable decisions are ADRs — in the template as [0009](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0009-the-queue-is-issues-and-a-durable-decision-is-an-adr.md) |

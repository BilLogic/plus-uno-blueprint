---
status: moved
audience: developers
summary: Recorded in the template as ADR 0021. The template (asb) owns the agent's canonical baseline — its loop, its tools, and a default doctrine — and a deployment tunes it through the typed `DeploymentConfig` the same way it tunes the UI, never by editing template code; uno, being the prototype that defines the product, contributes its agent into the canonical default rather than carrying a per-deployment override, so uno's canvas-adapter override folds into the default and disappears at the flip.
---

# The template owns the agent, and a deployment configures it like the UI

This decision is recorded in the template, as [BilLogic/agentic-service-blueprinting ADR 0021](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0021-the-template-owns-the-agent.md). It is about code this deployment runs from the template, so the template is where it lives. Read it there for the decision, its reasons and its consequences.

This file keeps its number so that a citation of ADR 0015 in this repository still lands. The two repositories number their records independently: here, 0015 is this pointer; in the template, 0021 is the record.

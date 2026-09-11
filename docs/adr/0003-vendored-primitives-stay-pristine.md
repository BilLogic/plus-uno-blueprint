---
status: moved
audience: developers
summary: Recorded in the template as ADR 0014. The vendored ui/ layer keeps its upstream timings and idioms, because the shadcn CLI regenerates it.
---

# Vendored primitives stay pristine; product composition lives in `blueprint/`

This decision is recorded in the template, as [BilLogic/agentic-service-blueprinting ADR 0014](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0014-vendored-primitives-stay-pristine.md). It is about code this deployment runs from the template, so the template is where it lives. Read it there for the decision, its reasons and its consequences.

This file keeps its number so that a citation of ADR 0003 in this repository still lands. The two repositories number their records independently: here, 0003 is this pointer; in the template, 0014 is the record.

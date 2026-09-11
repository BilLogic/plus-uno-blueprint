---
status: moved
audience: developers
summary: Recorded in the template as ADR 0013. Layout values the runtime does math on live in TypeScript, not CSS custom properties, because Math.min has no var().
---

# TypeScript owns every layout number; CSS receives them

This decision is recorded in the template, as [BilLogic/agentic-service-blueprinting ADR 0013](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0013-typescript-owns-layout-numbers.md). It is about code this deployment runs from the template, so the template is where it lives. Read it there for the decision, its reasons and its consequences.

This file keeps its number so that a citation of ADR 0002 in this repository still lands. The two repositories number their records independently: here, 0002 is this pointer; in the template, 0013 is the record.

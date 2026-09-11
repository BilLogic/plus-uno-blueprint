---
status: moved
audience: developers
summary: Recorded in the template as ADR 0017. Three components are long enough to be worth splitting and are deliberately not split, because the tests that would catch a split going wrong do not exist yet — the hold has an exit condition, not an excuse.
---

# Large component splits wait for an end-to-end round

This decision is recorded in the template, as [BilLogic/agentic-service-blueprinting ADR 0017](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0017-large-component-splits-wait-for-an-end-to-end-round.md). It is about code this deployment runs from the template, so the template is where it lives. Read it there for the decision, its reasons and its consequences.

This file keeps its number so that a citation of ADR 0008 in this repository still lands. The two repositories number their records independently: here, 0008 is this pointer; in the template, 0017 is the record.

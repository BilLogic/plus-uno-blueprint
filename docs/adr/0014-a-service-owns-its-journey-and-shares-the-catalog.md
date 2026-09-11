---
status: moved
audience: developers
summary: Recorded in the template as ADR 0003. When a deployment holds more than one service, the journey entities (phase, scenario, path, step, lane, cell, slice) are a hard per-service boundary while the catalog of nouns a journey references — touchpoints and stakeholders both — is one deployment-level pool where the name is the identity and a service's membership is implicit in what its journey references, so a tool or actor is recorded once and reused across services without a palette to author or keep in sync.
---

# A service owns its journey and shares the catalog

This decision is recorded in the template, as [BilLogic/agentic-service-blueprinting ADR 0003](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0003-a-service-owns-its-journey-and-shares-the-catalog.md). The two repositories each held a copy under different numbers, and the copies drifted; the template's record absorbed what this copy carried and is now the only one. The template's record carries this copy's slice wording: a slice belongs to one service, as `slices.service_id` is `NOT NULL` in both schemas. Read it there for the decision, its reasons and its consequences.

This file keeps its number so that a citation of ADR 0014 in this repository still lands. The two repositories number their records independently: here, 0014 is this pointer; in the template, 0003 is the record.

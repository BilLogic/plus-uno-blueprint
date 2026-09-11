---
status: moved
audience: developers
summary: Recorded in the template as ADR 0016. The query cache is staleTime Infinity because nothing outside this app edits the data, which moves the whole burden of freshness onto every mutation.
---

# Reads never refetch on their own

This decision is recorded in the template, as [BilLogic/agentic-service-blueprinting ADR 0016](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0016-reads-never-refetch-on-their-own.md). It is about code this deployment runs from the template, so the template is where it lives. Read it there for the decision, its reasons and its consequences.

This file keeps its number so that a citation of ADR 0006 in this repository still lands. The two repositories number their records independently: here, 0006 is this pointer; in the template, 0016 is the record.

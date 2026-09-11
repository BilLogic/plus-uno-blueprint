---
status: moved
audience: developers
summary: Recorded in the template as ADR 0005. State that must outlive a mount point, or be read by non-React code, lives in a module-level store read through useSyncExternalStore rather than in context.
---

# Cross-surface state is a module store, not context

This decision is recorded in the template, as [BilLogic/agentic-service-blueprinting ADR 0005](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0005-cross-surface-state-is-a-module-store.md). The two repositories each held a copy under different numbers, and the copies drifted; the template's record absorbed what this copy carried and is now the only one. Read it there for the decision, its reasons and its consequences.

This file keeps its number so that a citation of ADR 0005 in this repository still lands. The two repositories number their records independently: here, 0005 is this pointer; in the template, 0005 is the record.

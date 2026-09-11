---
status: moved
audience: developers
summary: Recorded in the template as ADR 0018. A resource's `featured` flag is one boolean whose meaning depends on the resource's kind — a featured attachment is the owner's preview, a featured link is one of its buttons — rather than two columns or a role enum, because the two verbs are what a reader sees and the one column is what an author decides.
---

# Featured is one column, two verbs

This decision is recorded in the template, as [BilLogic/agentic-service-blueprinting ADR 0018](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0018-featured-is-one-column-two-verbs.md). It is about code this deployment runs from the template, so the template is where it lives. Read it there for the decision, its reasons and its consequences.

This file keeps its number so that a citation of ADR 0011 in this repository still lands. The two repositories number their records independently: here, 0011 is this pointer; in the template, 0018 is the record.

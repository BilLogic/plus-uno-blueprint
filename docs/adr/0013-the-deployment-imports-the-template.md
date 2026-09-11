---
status: moved
audience: developers
summary: Recorded in the template as ADR 0020. The deployment consumes the canonical template by importing it as a pinned-by-release-tag git dependency and mounting its whole app through a typed `DeploymentConfig` prop — never by vendoring or editing the code in place — so that drift is structurally impossible and an upgrade is a reviewable tag bump.
---

# The deployment imports the template, and never edits it

This decision is recorded in the template, as [BilLogic/agentic-service-blueprinting ADR 0020](https://github.com/BilLogic/agentic-service-blueprinting/blob/main/docs/adr/0020-the-deployment-imports-the-template.md). It is about code this deployment runs from the template, so the template is where it lives. Read it there for the decision, its reasons and its consequences.

This file keeps its number so that a citation of ADR 0013 in this repository still lands. The two repositories number their records independently: here, 0013 is this pointer; in the template, 0020 is the record.

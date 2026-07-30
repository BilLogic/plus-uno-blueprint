---
status: pending
priority: p3
issue_id: 002
tags: [code-review, security, documentation]
---
# Accepted-by-design advisor findings — do not "fix"

## Problem Statement
Three standing advisor warnings are deliberate; future sessions must not break
them: (1) evidence_counts is an owner-rights view (ERROR-level lint) — bypasses
evidence RLS to expose counts only; security_invoker would break the anonymous
assumption read. (2) storage.objects SELECT policy on the public bucket is
required for upsert overwrites. (3) findings reopen collisions surface as 23505
via the partial unique index — frontend should toast, not treat as a crash.
Documented in migration 20260730090000; this todo mirrors it for discoverability.

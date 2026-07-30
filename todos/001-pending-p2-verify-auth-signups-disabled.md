---
status: pending
priority: p2
issue_id: 001
tags: [code-review, security, manual-step]
---
# Verify Supabase Auth sign-ups are disabled (manual)

## Problem Statement
Every write policy is `to authenticated using (true)`. With "Allow new users to
sign up" enabled on project osybxeojvsqcwxkgnalm, anyone with the public anon key
can self-provision via the Auth REST API and gain full write (slices, evidence,
cell spec columns, storage bucket). The frontend mitigation (shouldCreateUser:false)
left with the sign-in UI. Cannot be verified from the repo or SQL.

## Acceptance Criteria
- [ ] Dashboard → Auth: public sign-ups disabled; team members invited manually.

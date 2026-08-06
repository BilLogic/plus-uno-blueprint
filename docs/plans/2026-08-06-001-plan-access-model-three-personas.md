---
title: One access model for three personas — and the agentic blueprinting app after it
type: plan
status: active
date: 2026-08-06
---

# 🔐 One access model, three personas

## Why this document

The Supabase advisors flag ~20 warnings and 1 error against this project. None
of them can be triaged item-by-item, because each is only right or wrong
relative to an access model — and that model exists today as folklore spread
across `AGENTS.md` security lines, RPC grants, RLS policies and code comments
that have already drifted from the database (see finding F3). This writes the
model down, maps every advisor finding onto it, and states what carries over
to the agentic blueprinting app.

## The three personas

| Persona | Auth state | May read | May write | Mechanism |
| --- | --- | --- | --- | --- |
| **Visitor** (deployed Netlify app) | `anon` key, no session | the published blueprint: structure, cells, slices, evidence counts (today: evidence rows too — F3) | nothing | RLS `anon` select policies; zero write grants |
| **Author** (deployed or dev, signed in) | `authenticated` session | everything a visitor reads, plus authoring surfaces | structured writes ONLY through the RPC layer (`upsert_cell`, `create_path`, …), each landing in the session ledger with a captured revert | SECURITY DEFINER RPCs + RLS write policies; no raw table grants |
| **Operator** (CLI/IDE — Claude Code, MCP, migrations) | service role / management API | everything | schema, seeds, backfills, deploys | never in a browser bundle; `.env`/`.env.local` only (AGENTS.md) |

**The invariant that makes the model coherent:** every author write goes
through an RPC that (a) validates shape, (b) records a revert, (c) is the
*only* write path — table-level INSERT/UPDATE/DELETE grants for
`authenticated` stay revoked. SECURITY DEFINER on those RPCs is therefore not
an accident to lint away: it IS the mechanism that lets the ledger be
mandatory. The advisors can't see that intent; this document is where it
lives.

## Advisor findings, mapped

| Finding (level) | Verdict under the model | Action |
| --- | --- | --- |
| `evidence_counts` SECURITY DEFINER view (ERROR) | **Gratuitous.** Investigated 2026-08-06: `evidence` already carries `evidence_select_anon = true`, so the definer property protects nothing — the view is reachable identically as INVOKER. | Convert to `security_invoker = true`. Zero behavior change. **Approved?** |
| ~17 authoring RPCs SECURITY DEFINER + EXECUTE for `authenticated` (WARN) | **Intentional — the write funnel itself.** But two hardening gaps: (1) each function body must self-check authorization (it cannot rely on RLS, which it bypasses); (2) none currently `SET search_path`. | Audit each body for an auth check; add `SET search_path = public, pg_temp` to all. No grant changes. |
| `flag_founding_service_accounts` executable by **anon** (WARN) | **Wrong under any reading** — a service-account flagging routine reachable from the public REST surface. | Revoke EXECUTE from `anon` (and likely `authenticated`). One revoke, no app path uses it. **Approved?** |
| `search_blueprint` mutable search_path (WARN) | Hardening, orthogonal to personas. | `ALTER FUNCTION … SET search_path`. |
| Leaked-password protection off (WARN) | Affects Author sign-up/reset only. | Enable; zero effect on existing sessions. |
| `semantic_search.corpus_chunks` RLS-no-policy (INFO) | Correct as-is: RLS on + no policy = nobody reads it through the API, which is right for an internal corpus table. | Document as intended; no change. |
| 7 unused indexes (INFO) | Operator concern, no persona impact. | Leave until a real write-perf reason appears. |

## Findings beyond the advisors

- **F3 — code/db drift:** `src/hooks/useEvidence.ts` docstring says anonymous
  evidence SELECT is restricted and an empty set must never render as "all
  assumptions". The database disagrees: `evidence_select_anon = true`. Either
  the policy is wider than intended (tighten it — visitor reads evidence
  *counts* via the view, not rows) or the comment is stale (fix it). **This is
  the one real decision in this document**, because it changes what a Visitor
  can see. Recommend: decide whether raw evidence rows (interview excerpts,
  notes) are publishable; if not, drop the anon select policy and keep the
  counts view as the anon surface — which then genuinely needs its DEFINER
  property back. The two findings are coupled.
- **F4 — `evidence_update_auth/delete_auth = true`:** authenticated users can
  update/delete evidence rows directly, outside the RPC funnel — the only
  table where raw writes bypass the ledger. Bring evidence writes into the
  RPC layer or accept and document the exception.

## Carrying it to the agentic blueprinting app

The model generalizes as three rules, not a schema copy:

1. **Anon = read of the published artifact, nothing else.** Whatever the
   artifact is (blueprint, agent run, storyboard), publishing means adding an
   anon select policy on its *presentation* surface only — counts and views,
   not raw research rows.
2. **Authenticated writes go through one RPC funnel** that validates, ledgers
   and reverts. SECURITY DEFINER + revoked table grants is the pattern;
   `SET search_path` and an in-body auth check are its mandatory hygiene.
3. **Service role never leaves the operator's machine.** Browser bundles get
   the anon key; dev authoring uses a real signed-in session
   (`.env.local` credentials), never the service key.

The advisor lints then read as a checklist against these rules rather than
noise: DEFINER-view lint = "is this view a deliberate anon presentation
surface?"; DEFINER-function lint = "is this function part of the funnel and
does it self-check?"; RLS-no-policy = "is this table deliberately
API-invisible?".

## Decisions (aligned with owner, 2026-08-06)

- [x] F3: raw evidence rows are **publishable** — research ships with the
      blueprint. Anon SELECT stays; `useEvidence` docstring corrected.
- [x] `evidence_counts` → `security_invoker = true` (flag was gratuitous once
      F3 kept rows public). Applied: migration `advisor_hardening_2026_08_06`.
      ERROR advisor cleared.
- [x] `flag_founding_service_accounts`: EXECUTE revoked **from PUBLIC** (the
      per-role revoke was a no-op — the grant flowed from PUBLIC), re-granted
      to `service_role` only. Verified via `has_function_privilege`.
- [x] `search_path`: audit found every function already pinned except
      `search_blueprint` — now pinned too.
- [ ] Leaked-password protection: no management-API tool available here —
      **owner flips it in the dashboard** (Auth → Providers → Email).
- [x] F4: evidence writes go into the RPC funnel with ledger + revert —
      owner called the gap dangerous; implemented rather than documented.

The remaining `authenticated`-can-execute WARNs on the ~17 authoring RPCs are
the funnel working as designed; this document is their standing exception
record.

## Couplings recorded by the security review (2026-08-06)

- **Evidence insert policy is `with check (true)`** — `created_by`/`added_by`/
  `id` are client-supplied defaults, not constraints, and
  `restoreEvidenceRow`'s verbatim reinsert now *depends* on that laxity.
  When the Author persona tightens, do NOT add
  `with check (created_by = auth.uid())` — it would silently break evidence
  undo. Move restore into a SECURITY DEFINER RPC that re-checks tier and
  preserves authorship server-side, in the same change.
- **`evidence.cell_id` has no FK** — delete-cell-then-revert-evidence can
  reinsert orphaned rows that `evidence_counts` counts but no panel shows.
  Fix alongside the restore RPC (FK `on delete cascade`, or a nonexistence
  check in the RPC).

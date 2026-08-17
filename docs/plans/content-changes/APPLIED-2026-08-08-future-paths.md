# APPLIED 2026-08-08 — Future (roadmap) paths

Created five "Future (roadmap)" paths (`path_type='named'`, `origin='app'`) per the adopted
future-state convention: one per affected scenario, diverging from the current path only where
the roadmap changes things. Every cell description begins
`PLANNED (not shipped as of Aug 2026):` and carries plain-text Slack/sweep evidence lines;
Figma links use the design-system file `W0qzhXWxFsMwSJzkdV2yal`. All new rows use
`origin='app'` so the importer's delete-and-reinsert never touches them. Applied via
`supabase-plus` MCP `execute_sql`, one transaction per scenario. Backups existed beforehand.

Sources: sweep reports 05/06/07/08/10 (scratchpad `sweep/`), the five scenario plan docs in
this directory, and Bill's 2026-08-08 decisions recorded in those plans.

## Paths created

| Scenario | Path id | Columns (reused ▸ new) | Cells |
|---|---|---|---|
| Standard Scheduling (`…000126`) | `f0000000-0000-4000-8000-000000000806` | NEW "Creates & edits sessions in-app" ▸ reuse "Views schedule & syncs calendar" (`…000896`) ▸ reuse "Reconfirm availability" (`b0…000901`) | 7 |
| Session Sign Up (`…000125`) | `f0000000-0000-4000-8000-000000000805` | reuse "Sign up" (`…000891`) ▸ NEW "Overlap check & acknowledgement" ▸ reuse "Review scheduling" (`…000892`) | 7 |
| Wrap-Up (`…000206`) | `f0000000-0000-4000-8000-00000000080e` | reuse "Complete wrap-up" (`…000983`) ▸ NEW "Cadence check-ins" | 8 |
| Interview & Offer (`…000122`) | `f0000000-0000-4000-8000-000000000702` | reuse "Accepts offer" (`e0…000602`) ▸ NEW "Submits candidate info form" ▸ NEW "Clearance confirmed (CPO/school)" ▸ NEW "Imported & invited to the app" ▸ NEW "Creates account & completes profile" | 10 |
| Call-off Request (`…000128`) | `f0000000-0000-4000-8000-000000000808` | reuse "Initial need" (`…000940`) ▸ NEW "Swaps into another session" ▸ reuse "Final notification" (`…000945`) | 7 |

New steps carry ids `f0000000-…` and `origin='app'`; each future path's lane set fully
mirrors its scenario's happy path (7 lanes; Wrap-Up 9 incl. Partner Teacher / Lead Tutor).

## Content summary

1. **Standard Scheduling** — in-app session creation replacing DB import (per Bill, dev-only
   edit/revert already merged Card 2452 / PR #1136 2026-08-06); notify toggle fanning out
   reconfirmation; batch reconfirm from home; ReconfirmState in prod; Unavailable → released
   from roster with **no call-off record, by design** (Bill 2026-08-08). Figma §4 / 4.3 / 4.5,
   Admin/Session 3408-120456.
2. **Session Sign Up** — soft-conflict gate: overlap <10 min = warn/acknowledge; ≥10 min =
   gated until the tutor names the requesting supervisor, who gets a heads-up email. Threshold
   revised 20→10 min (Bill, #plus-design-feedback 2026-08-04, ts 1785871990.795529; 11–20 min
   band 5.84% mistake rate, multiplier corrected 8.5×→4.3×). Proposal awaiting triage.
3. **Wrap-Up** — reflection redesign: escalation chips (endorsed by Emme), AI follow-up
   question per section (challenged by Cindy, unresolved), Self Reflection every 10th session,
   Form Feedback every 3 weeks (cadence unresolved), recording upload with No Recording
   Reason. Cassie Loom walkthrough #plus-design-feedback 2026-07-15 (ts 1784131068.897049).
4. **Interview & Offer** — Jun 2026 supervisor-registration clearance redesign (Alex Houk,
   2026-06-02): candidate info form → CPO/school clearance confirmation to supervisors
   (tutor self-report legally unusable) → supervisor imports cleared tutors → app invite →
   account creation + profile completion. Ship status unknown; ~2-week CPO dependency stays
   the pacing constraint (sweep 10).
5. **Call-off Request** — swap flow (Figma §5.5, node 11227-394462, explicitly TBD): tutor
   swaps into another session instead of a pure call-off; record semantics and supervisor
   visibility undecided; no code exists.

## Verification (all pass)

Per path: lane count = happy-path lane count; every cell's step present in that path's
`path_steps`; every cell's layer belongs to the path (also trigger-enforced by
`cells_validate_path_match`); `path_steps.column_position` contiguous from 1; all 39 cell
descriptions start with the `PLANNED (not shipped as of Aug 2026):` prefix; cell counts
7/7/8/10/7 (within the 6–12 convention).

## Rollback

`delete from paths where id::text like 'f0000000%';` cascades cells/layers/path_steps, then
`delete from steps where id::text like 'f0000000%';` — or restore from the pre-existing backup.

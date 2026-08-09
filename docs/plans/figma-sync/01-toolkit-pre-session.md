# Figma Sync — Toolkit / Pre-Session
Date: 2026-08-08 · Page link: https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=1-175

## Current page contents (verified via metadata)
- **Tutor Pre-Session Management** — section [223:194705](https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=223-194705)
  - 1. Viewing your schedule — 8894:182729
  - 2. Getting onto sessions — 11240:161737 (recurring sign-up, fill-in pop-up/table)
  - 3. Calendar sync — 11199:140134 (subscribe/add-event modals)
  - 4. Session changes and confirmations — 11240:161738
  - 5. Coming off sessions — 11240:161739
  - Context block — 9998:288279
- **Supervisor Pre-Session** — section [206:149220](https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=206-149220)
  - 1. Viewing sessions — 11230:161743
  - 2. Managing sessions — 1776:129470
  - 3. Manage recurring session sign-ups — 1776:140305
  - 4. Recruit for one-time fill-ins — 2963:199164
  - 5. Call-offs — 2963:199163
  - 6. For future iterations — All Sessions fill-in states — 4173:145289
  - Context block — 9998:308860
- **Components (Local organisms)** — 1719:114072 (Elements, Tables, Pages, Cards, Modals, Sections, Index — deep links 9993:163686, Calendar Subscribe Buttons 10339:212049)

## Out of sync with shipped app
| Gap | App reality (evidence) | Proposed Figma change |
|---|---|---|
| Supervisor "create session" flows in §2 Managing sessions | NO session/shift creation exists anywhere; sessions arrive via DB import (08 §Job1-8) | Mark create-session screens as not-shipped / remove from spec; annotate "sessions DB-imported" in Context block |
| Cancel-session scopes | Cancel supports single, shiftDateRange, dateRange ONLY — no all-future (08 §Job1-8). Revert exists (`revertSessionsWithScope`, byIds = undo) | Align cancel modal scope options; add Revert flow screens if missing |
| Edit-session scopes | single / allRecurring / dateRange, with notify toggle that fans out reconfirmation (08 §Job1-8; Update Sessions v3 Card 2452/#1136) | Verify edit modal shows 3 scopes + notify toggle; document reconfirm fan-out |
| <12h call-offs shown as pending-approval | <12h call-offs EXECUTE IMMEDIATELY — tutor removed from roster; supervisor review only decides excused/unexcused (08 §Job1-2d) | §5 Coming off sessions: split "<12h" path — no waiting state; label supervisor decision Excused/Unexcused, not Approve/Reject |
| Recurring call-off approval | Recurring = manual PENDING, EXCEPT auto-approve when reason=SIGNED_UP_BY_MISTAKE ∧ signed up <24h ago ∧ ≥12h before next (08 §Job1-2b). One-time ≥12h auto-approves (2a). Approval auto-reassigns students and can promote a lead-capable regular to LEAD (2c) | Document auto-approve exception; add system-lane note for reassignment + lead promotion |
| Withdraw pending call-off | Tutor can withdraw PENDING request if slots open (08 §Job1-7) | Confirm withdraw-pending screens match slot-availability condition |
| Reconfirmation loop | ReconfirmState shipped Aug 2026 (07 §2, Card 2452); UNAVAILABLE drops tutor WITHOUT a call-off record — absence path bypassing call-off (08 §Job1-3); batch reconfirm modal lives on Home (home.js:802) | Add reconfirm states to §4; document the UNAVAILABLE no-record edge; cross-link Home page for batch modal |
| Fill-in window | 72h threshold, active call-off bypasses it; tutors self-select from Fill-In tab (08 §Job1-4; 06 §4) | Verify fill-in copy says 72h; tooltip text is verbatim in tutor_schedule_fill_ins.js:46 |
| Any Acuity references (slot stats, external scheduling) | Acuity retired — dead code, zero callers; signup metrics fully in-app (06 §1, 07 §1) | Purge/annotate any Acuity mentions in calendar-sync or sign-up sections |
| Tab structure | Shipped tabs: My Sessions, All Sessions (conditional), Sign-Ups, Fill-In, Reflections, Call-Offs (08 §Job1-1) | Verify screen tab bars match this exact set |
| Onboarding gate | Incomplete onboarding blocks schedule/sessions (#1143, 08 §h) | Add gated/empty state to §1 Viewing your schedule |
| Call-off Slack notification | Manual-approval call-offs auto-notify Slack via email gateway CALL_OFF_SLACK_EMAIL (08 §Job1-2d) | System-lane annotation on supervisor §5 |

## Blueprint dependency
Pre-session phase columns map ~1:1 onto this page's numbered sections (05 §Recommendations-1): sign-up, fill-in, calendar sync, reconfirm, call-off scenarios all cite these sections as frontstage evidence. Failure-path cells (call-off <12h, reconfirm-UNAVAILABLE absence) will link here once states are corrected — the blueprint must not show a pending-assigned state for <12h call-offs (08 §Passing).

## Action items
- [ ] Remove or tombstone supervisor create-session screens; annotate DB-import reality
- [ ] Align cancel modal to 3 shipped scopes; add Revert flow
- [ ] Align edit modal to 3 scopes + notify→reconfirm fan-out
- [ ] Rework §5 <12h path: immediate execution, Excused/Unexcused review labels
- [ ] Document recurring auto-approve exception (SIGNED_UP_BY_MISTAKE) and student-reassignment/lead-promotion side effects
- [ ] Add ReconfirmState states to §4 incl. UNAVAILABLE-without-record edge
- [ ] Sweep page for Acuity references and purge
- [ ] Verify tutor tab bars match shipped 6-tab set
- [ ] Add onboarding-gate blocked state to §1
- [ ] Update Context blocks with Roadmap card refs (2452, 2266) currently "—"

# Session Sign Up — Content Revision Plan
Date: 2026-08-08 · Blueprint: PLUS Application › Onboarding › Session Sign Up · Path: Happy Path (`a0000000-0000-4000-8000-000000000805`)
Status of scenario today: smallest scenario — 2 steps / 9 cells, 33% empty labels. The entire backstage is STALE: it documents the retired "Dev Team stores sign-ups in a Google Spreadsheet → supervisors review the spreadsheet" flow. Verified reality (06 #3, 07 #6, 08 #1): recurring sign-up is fully in-app via the Sign-Ups tab since Spring 2026; no Sheets code ever existed. Production scale: 2,100–6,000 tutor-session sign-up rows per month in spring 2026, with tutor cancellations running 26–36% of sign-ups (09-metabase) — churn worth naming in the descriptions. This plan retires the spreadsheet lane and grounds the scenario in the shipped flow, including the onboarding gate.

## 1. Revise existing cells

| Cell (lane › step) | cell_id | Property | Current | Proposed | Evidence |
|---|---|---|---|---|---|
| Regular Tutor › Sign up | `a0000000-0000-4000-8000-000000130103` | description | (empty) | "Once onboarding modules are complete (the app blocks scheduling until then), the tutor opens Toolkit › Your Sessions › Sign-Ups and signs up for recurring weekly sessions for the rest of the semester." | Onboarding gate PR #1143; tab set My Sessions / Sign-Ups / Fill-In / … (tutor_schedule.js:50-56) |
| Regular Tutor › Sign up | `a0000000-0000-4000-8000-000000130103` | links | (none) | `[{"type":"url","label":"Figma — 2.1 Sign up for recurring sessions","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=11227-161743"},{"type":"url","label":"Manage Your Tutoring Schedule (Notion)","url":"https://www.notion.so/392b7cca498280458590fc3e3f526ccc"}]` | Figma Pre-Session §2.1; Notion help article |
| Front Stage Tech › Sign up | `a0000000-0000-4000-8000-000000130106` | description | "The tutor signs up for recurring sessions… in the PLUS app." | "The Sign-Ups tab lists open recurring session slots with lead and regular tutor columns; teacher names are hidden. The tutor picks slots and confirms; capacity is enforced per slot." | Slack #plus-dev Boyuan 2025-08-11 (lead/regular columns, teacher names hidden); recurring-signup capacity bug card 348b7cca… (capacity enforcement exists) |
| Front Stage Tech › Sign up | `a0000000-0000-4000-8000-000000130106` | links | Figma 1751-119990 | Keep; add `{"type":"url","label":"Figma — 2. Getting onto sessions","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=11240-161737"}` | Figma Pre-Session §2 |
| Back Stage Tech › Sign up | `a0000000-0000-4000-8000-000000130108` | content | "Google Spreadsheet" | "PLUS App database" | 06 #3 OUTDATED; 07 #6 no Sheets code ever |
| Back Stage Tech › Sign up | `a0000000-0000-4000-8000-000000130108` | description | spreadsheet blurb | "Sign-ups write Shift/TutorSession records directly in the PLUS app database — there is no spreadsheet middle step. Supervisors see the resulting rosters in the Admin › Sessions views." | web-app entities Shift/TutorSession (03); Admin Sessions (08 §Job2b) |
| Back Stage Tech › Sign up | `a0000000-0000-4000-8000-000000130108` | links | Google Sheets logo entry | Replace with `[{"type":"url","label":"Figma — Admin/Session","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=3408-120456"}]` | Figma Admin/Session page |
| Back Stage Actions › Sign up | `a0000000-0000-4000-8000-000000130107` | content | "Dev Team takes that scheduling info and stores it in a Google Spreadsheet." | "Sign-up capacity and slot configuration are managed in the app; supervisors monitor incoming sign-ups from the Admin › Sessions portal." | 06 #3; 08 §Job2b |
| Back Stage Actions › Review scheduling | `a0000000-0000-4000-8000-000000130207` | content | "Tutor supervisor team receives and reviews Google Spreadsheet from Dev Team." | "Tutor supervisor team reviews sign-ups and session rosters in the Admin › Sessions portal (calendar and table views) and manages recurring sign-ups." | 08 §Job2b (Sessions admin, calendar view Card 2266); Figma Supervisor Pre-Session 206-149220 ("manage recurring sign-ups") |
| Regular Tutor › Review scheduling | (no cell — see §2) | — | — | — | — |

## 2. New cells

| Lane › Step | Property | Proposed value | Evidence |
|---|---|---|---|
| Regular Tutor › Review scheduling | content | "Sees signed-up sessions in My Sessions and can cancel accidental sign-ups." | tutor_schedule.js tab set; Notion card "Cancel Accidental Sign-ups" (274b7cca-4982-8074…); auto-approve call-off for SIGNED_UP_BY_MISTAKE (CallOffRequestServiceImpl.java:243) |
| Front Stage Tech › Review scheduling | content | "PLUS App — My Sessions" · links: `[{"type":"url","label":"Figma — 1.1 View your upcoming sessions","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=11230-161744"}]` | Figma Pre-Session §1.1 |
| Back Stage Tech › Review scheduling (existing empty cell `a0000000-0000-4000-8000-000000130208`) | content | "Onboarding gate" · description: "Scheduling surfaces stay locked for tutors with incomplete onboarding; the gate lifts automatically on completion of the final module." | PR #1143 |
| Support Actions › Review scheduling | content | "Soft-conflict rule (proposed)" · description: "A proposed rule warns tutors signing up for overlapping sessions; the overlap threshold under discussion moved from 20 to 10 minutes and the design is awaiting triage — not shipped." | 06 #6: Bill #plus-design-feedback 2026-08-04; mark PROPOSED |

## 3. Structural changes (new steps / triggers / paths)

1. **Trigger in (hard dependency)**: "Onboarding Modules › Module completion (all modules) → Sign up". This is enforced in code (PR #1143), so it should be a real trigger, not prose.
2. **Trigger out**: "Sign up confirmed → Standard Scheduling › schedule visible in My Sessions" and "Signed up by mistake → Call-off Request (auto-approved withdraw)".
3. Two steps is thin but roughly right for the happy path (browse/sign up → confirm/review). If expanding, the natural third step is "Browse available slots" before "Sign up" — Figma §2.1 has distinct browse/confirm screens to cite.
4. Visual lane: both cells empty; `step-01-sign-up-success.png` already exists on the FST link — promote it, and screenshot Figma §2.1 for the browse state.

## 4. Divergences & open questions (things Bill must decide)

- **Spreadsheet history**: whether any manual-ops spreadsheet ever existed outside the app is unverifiable (07 #6). The plan removes it outright rather than marking "legacy" — confirm.
- **Who creates the slots**: no session/shift creation UI exists; sessions arrive via DB import (08 §Job1-8). That backstage truth is documented in the Standard Scheduling plan — decide which scenario owns "semester schedule creation" (currently documented nowhere; eval flag B3-SCHED-01).
- **Soft-conflict cell**: it's a design proposal, not shipped — include as PROPOSED or omit until triaged.

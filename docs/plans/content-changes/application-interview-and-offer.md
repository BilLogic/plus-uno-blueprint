# Interview & Offer — Content Revision Plan
Date: 2026-08-08 · Blueprint: PLUS Application › Application › Interview & Offer · Path: Happy Path (`a0000000-0000-4000-8000-000000000702`)
Status of scenario today: 25 cells across 5 steps (Applies → interview invite → Group interviews → Waits → Receives offer decision), happy-path only, 0% descriptions. The scenario stops at "offer decision" — the verified pipeline continues through soft offer → acceptance form → CPO clearance before any app access, none of which appears. No Figma coverage exists for the Application phase; evidence is Slack + Notion.

## 1. Revise existing cells

| Cell (lane › step) | cell_id | Property | Current | Proposed | Evidence |
|---|---|---|---|---|---|
| Regular Tutor › Applies | `a0000000-0000-4000-8000-000000090103` | description | (empty) | "The candidate submits the post-info-session application form — this form doubles as the first interview in the hiring funnel. Only info-session attendees receive it." | Notion "Hiring process revisions" (80e738fb…): post-info-session form = "1st interview" |
| Regular Tutor › Group interviews | `a0000000-0000-4000-8000-000000090303` | description | (empty) | "The candidate joins a ~20-minute group interview on Zoom with 2–5 other candidates: a short intro-slide task, then a breakout-room math walkthrough where each candidate tutors a problem while supervisors assess communication and math facilitation." | Notion "Process for Tutor Group Interviews" (4531ace16ae9495faca7a49eeb89369f) |
| Regular Tutor › Group interviews | `a0000000-0000-4000-8000-000000090303` | links | (none) | `[{"type":"url","label":"Process for Tutor Group Interviews (Notion)","url":"https://www.notion.so/4531ace16ae9495faca7a49eeb89369f"}]` | same |
| Regular Tutor › Receives offer decision | `a0000000-0000-4000-8000-000000090503` | description | (empty) | "The candidate receives a soft offer by email. Accepting means completing the acceptance form and starting CPO clearance paperwork (Workday + SSN forms) — app and training access are only granted after clearance." | Slack #plus-core Alex Houk 2026-04-01 (6-stage pipeline); Notion "Capture CMU hiring process" (223b7cca-4982-806f-9223-e6ef739fdba5) |
| Front Stage Actions › Group interviews | `a0000000-0000-4000-8000-000000090304` | description | (empty) | "The tutor supervisor team facilitates: intro slides, breakout math-walkthrough script, and per-candidate assessment against the interview goals." | Notion 4531ace1… |
| Back Stage Actions › Waits for offer decision | `a0000000-0000-4000-8000-000000090407` | description | (empty) | "Supervisors review interview notes (Notion) and optionally the Zoom recording, then issue soft offers. Rehires get a lighter evaluation path rather than a full re-interview." | Notion 80e738fb… (rehire evals); existing BST links `…090408` |
| Back Stage Actions › Applies | `a0000000-0000-4000-8000-000000090107` | description | (empty) | "The tutor supervisor team creates and manages the application (Google Form) and screens submissions to decide who is invited to a group interview." | existing cells `…090107`/`…090207`; Notion 80e738fb… |

As in Discovery: copy each `links[].description` blurb (`…090106`, `…090206`, `…090306`, `…090506`, `…090308`, `…090309`) into the corresponding cell `description` so the detail panel is populated.

## 2. New cells

| Lane › Step | Property | Proposed value | Evidence |
|---|---|---|---|
| Regular Tutor › Accepts offer (NEW step) | content | "Accepts soft offer and completes acceptance form." | Slack #plus-core 2026-04-01: stage 4 of 6 |
| Regular Tutor › Accepts offer (NEW step) | description | "The candidate confirms via the acceptance form, then submits CPO clearance paperwork (Workday form + SSN form PDFs). No PLUS app or training access is granted until the CPO clears them." | Slack #plus-core 2026-04-01; Notion 223b7cca… (Workday/SSN PDFs) |
| Front Stage Tech › Accepts offer (NEW step) | content | "Acceptance form (Google Form) + Workday" | same |
| Back Stage Actions › Accepts offer (NEW step) | content | "Tutor supervisor team forwards accepted candidates to the CPO for clearance and holds onboarding info until cleared." | Slack #plus-core 2026-04-01: "onboarding info + app access" is the final stage, gated on CPO clearance |
| Support Actions › Group interviews | content | "Interview slides & scripts (Training Master List)" · description: "Info-session and group-interview slide decks maintained by the supervisor team; the assessment rubric itself is not yet written down." | Notion Training Master List (160b7cca…); gap noted in Notion sweep |

## 3. Structural changes (new steps / triggers / paths)

1. **New step "Accepts offer"** after "Receives offer decision", covering soft-offer acceptance + acceptance form + hand-off to CPO clearance. Trigger out of this scenario: "CPO clearance initiated → Tech Setup › Clearance email." This makes the Application→Onboarding seam match the canonical 6-stage pipeline (application form → interview invite → soft offer → acceptance form → CPO clearance → onboarding info + app access).
2. **Rejection path** (unhappy): "Receives offer decision → not selected" — currently the FSA cell says "next steps (if applicable)" and nothing else. A minimal 2-cell unhappy path (rejection email; supervisor logs decision) would make this the first Application-phase non-happy path. Optional.
3. No Visual-lane content exists (5 empty cells); no source screenshots exist (no Figma coverage) — leave Visual empty rather than invent placeholders.

## 4. Divergences & open questions (things Bill must decide)

- **CPO clearance — investigated 2026-08-08 (full report: sweep/10-clearance-procedure.md). New recommendation: clearance becomes its own step/sub-sequence appended to Interview & Offer, with a wait-state trigger into Tech Setup — NOT folded into Tech Setup.** Verified procedure: acceptance form → supervisor adds name+Andrew ID to CPO roster → CPO contacts tutor directly (PLUS never sees the email; staff legally cannot verify docs) → tutor completes PA Act 153 clearances with CPO (~2 weeks observed) → CPO weekly email to PLUS → Friday 8pm ET plus_etl script writes advisor.clearance_status (ETL-only field, no human writes it) → onboarding info + app access. Already-cleared shortcut: forward CPO clearance email. Blueprint should show CPO as an external actor and the wait as the pacing constraint. Jun-2026 supervisor-registration redesign (supervisor imports cleared tutors → app invite) is design intent, ship status unknown — Future path material. Awaiting Bill's confirm on the placement.
- **Interviewer rubric/scoring**: referenced by the group-interview page but never written (Notion gap). Cells can describe the process but cannot link a rubric.
- **Offer letters / rejection comms** live in Workday/HR, outside PLUS-owned docs — accept that the "Receives offer decision" backstage will stay citation-thin.
- No Figma coverage for the Application phase — all citations here are Notion/Slack.

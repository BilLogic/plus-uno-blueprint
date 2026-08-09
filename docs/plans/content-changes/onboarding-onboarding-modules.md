# Onboarding Modules — Content Revision Plan
Date: 2026-08-08 · Blueprint: PLUS Application › Onboarding › Onboarding Modules · Path: Happy Path (`a0000000-0000-4000-8000-000000007201`)
Status of scenario today: 35 cells across 7 steps, the healthiest Onboarding scenario (20% descriptions, good Figma citations on Front Stage Tech). The mechanics (PLUS app → Notion content → Google quiz → in-app reflection) are verified current. Missing: the module catalog itself (11 modules incl. Lead Tutor track), the new onboarding gate that blocks scheduling, and Notion source links on tutor-action cells.

## 1. Revise existing cells

| Cell (lane › step) | cell_id | Property | Current | Proposed | Evidence |
|---|---|---|---|---|---|
| Regular Tutor › Module opening | `a0000000-0000-4000-8000-000000110103` | description | (empty) | "The tutor works through the onboarding course in order — 11 modules from 'Welcome to PLUS' through Lead Tutor responsibilities — opening the next uncompleted module from the Training › Onboarding page. Completing all modules is required before the tutor can sign up for sessions." | Notion Tutor Onboarding Material hub (26fb7cca49828000952fd7b346d1b09c); onboarding gate PR #1143 |
| Regular Tutor › Module opening | `a0000000-0000-4000-8000-000000110103` | links | (none) | `[{"type":"url","label":"Tutor Onboarding Material hub (Notion)","url":"https://plus-tutors.notion.site/26fb7cca49828000952fd7b346d1b09c"}]` | Notion hub — Notion IS the delivery surface |
| Regular Tutor › Accessing content | `a0000000-0000-4000-8000-000000110203` | links | (none) | `[{"type":"url","label":"Module 7 — Plus App Overview (example)","url":"https://plus-tutors.notion.site/Module-7-Plus-App-Overview-26fb7cca498280c8b700e462fa340ddb"}]` | Notion Module 7 (screenshot walkthrough) |
| Regular Tutor › Quiz completion | `a0000000-0000-4000-8000-000000110503` | description | (empty) | "The tutor completes the Google Form quiz embedded in the Notion module. Quizzes are the knowledge check chosen in the 2025 onboarding-delivery options comparison; results feed the supervisor team's training-progress view." | Slack canvas F092TE87GR3 "Onboarding Options" (Boyuan Guo 2025-06); Admin training progress (08 §Job2b) |
| Regular Tutor › Module completion | `a0000000-0000-4000-8000-000000110703` | description | (empty) | "Submitting the reflection marks the module complete in the PLUS app. When the final module is done, the onboarding gate lifts and the Toolkit scheduling surfaces (sign-ups, sessions) unlock." | Onboarding gate PR #1143 (08 §Job2h) |
| Back Stage Actions › Reading lesson | `a0000000-0000-4000-8000-000000110307` | description | (empty) | "The instructional design team writes and maintains module content in Notion, working the module pipeline Tutor Team → Design → Dev; per-module build state and quiz status are tracked in the course dev notes." | Notion onboarding course dev notes (256b7cca-4982-809b-8dfb-d0519d3783ad); module creation cards (3b2b7cca…) |
| Support Actions › Module opening | `a0000000-0000-4000-8000-000000110109` | description | existing Dev/Design blurb | Append: "Two additional modules shipped mid-2026 (PR #1151); the Training › Onboarding spec covers the overview and inner-module screens." | web-app PR #1151; Figma Training/Onboarding 3385:292695 |

Front Stage Tech cells (`…110106`, `…110206`, `…110306`, `…110406`, `…110506`, `…110606`, `…110706`) already carry Figma node links and screenshots — keep; copy their `links[].description` prose into the empty cell `description` fields.

## 2. New cells

| Lane › Step | Property | Proposed value | Evidence |
|---|---|---|---|
| Back Stage Tech › Module completion | content | "Onboarding gate" | PR #1143 |
| Back Stage Tech › Module completion | description | "The app tracks per-module completion; while any module is incomplete, schedule and session surfaces are blocked. Module completion state also drives the supervisor Training Progress view in the Admin portal." | PR #1143 (08 §Job2h); Admin Tutors training-progress tab (08 §Job2b) |
| Back Stage Tech › Module completion | links | `[{"type":"url","label":"Figma — Admin Tutor (Training Progress)","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=3408-120455"}]` | Figma Admin/Tutor page |
| Back Stage Actions › Module completion | content | "Tutor supervisor team monitors training progress and follows up with tutors who stall." | Admin Tutors training-progress tab (08 §Job2b) |
| Regular Tutor (Lead track note) › Module opening | — | Do NOT add a separate cell; cover Lead Tutor modules in the `…110103` description ("through Lead Tutor responsibilities") and cite Module 11. | Notion Module 11 — Lead Tutor Session Responsibilities (3b1b7cca-4982-8090-9264-cf0bb51239fb); Slack: M10 = Lead Tutor responsibilities (Dimple Lin / Coco Jiang 2026) |

## 3. Structural changes (new steps / triggers / paths)

1. **Trigger out (cross-scenario dependency)**: "All onboarding modules complete → Session Sign Up › Sign up" — the onboarding gate (PR #1143) makes this a hard dependency, not just narrative order. This is the most important structural addition in the Onboarding phase.
2. **Trigger in**: from Tech Setup "Complete tutor profile / first login".
3. Step names are accurate to the shipped flow; no step changes needed. The loop (a tutor repeats steps 1–7 per module, ~11 times) could be represented with a loops-to trigger from "Module completion" back to "Module opening" — recommended, cheap, and true.
4. Visual lane: 7 empty cells; module screenshots exist both in the Figma Training/Onboarding sections (3385:292709/292712/292711/292713 already linked from FST cells) and as blueprint-images on FST links — propose promoting the existing step screenshots into the Visual strip.

## 4. Divergences & open questions (things Bill must decide)

- **Module count drift**: Notion hub says 11 modules; Slack references M10 as Lead Tutor responsibilities while the Notion page for lead responsibilities is titled Module 11; PR #1151 added two more. Pin the canonical count/order from the Notion hub before writing it into cell prose (the draft above says "11 modules" — adjust if the hub says otherwise today).
- **Quiz results plumbing**: quizzes are Google Forms — how results reach the supervisor Training Progress view (manual vs. import) is undocumented. The `…110503` draft stays vague deliberately; document the pipeline if Bill knows it.
- **Reflection loop location**: reflection happens in-app (confirmed) but reflection *questions* are maintained in Notion (`…110608`) — confirm this is still the flow after PR #1151's new modules.

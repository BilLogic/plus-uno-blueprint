# Figma Sync — Profile + Home
Date: 2026-08-08 · Page links:
- Profile: https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=1-181
- Home: https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=1-168

## Current page contents (verified via metadata)
**Profile** — Screens 1133:253984: Tutor Profile ×7 (4577:3884, 5696:225954, 5696:225014, 5696:170849, 5696:225500, 8875:69239, 8875:79533) + a Skills (Home Page) instance 5696:209506. Components 1133:253972 incl. **[wip] Demo only — no implementation** typing-interaction set (5832:154710).

**Home** — Home Page section 83:166120 → Screens 83:126621: Skills (Home Page) ×3 (563:207489 line-chart variant, 563:208222 radar variant, 563:207865) — Jumbotron + Training Progress card + Skills Overview (Data Visualization tabs) + Metrics Card + Personalized Recommendations. Components 134:175383: Homepage Jumbotron (tabs = **sign-up / session / reflection**), Data Visualization (skills progress/overview + Alternative), Metrics Card (Sessions 3-page, Lessons), Recommended Lessons, Overview Card / Training Progress (badge claimed/unclaimed × completed-training), **Badges** full component set (V1/V2 × claimed/unclaimed × 3 sizes, 2359:153252), User Feedback Modal (problem/question/feedback), Update Notification 7283:416854, Students Overview (Bottom Section), Resource Card, page symbol `completed onboarding? true/false`.

## Out of sync with shipped app
| Gap | App reality (evidence) | Proposed Figma change |
|---|---|---|
| Profile fields | Shipped (Card 2134 / PR #1132): preferred name, pronouns, photo, additional email, Slack email, position, university, grad semester, languages; Slack-email change fires Slack webhook to ops; read-only Status & Clearance card (tutor/onboarding/clearance status) (08 §a) | Audit 7 Tutor Profile screens against this field list; add Status & Clearance card if missing; system-lane note for Slack webhook |
| Home feed absent | Shipped home feed posts: EdTechGoalPost, EdTechUpdatePost, MentorReflectionPost, ResourceAssignedPost, NeedsEdTechGoalNotification (08 §f; 03 §Behavioral-6) | Home screens show Skills dashboard only — add feed surface or record explicit gap (feeds may belong to doc 08 growth-loop page; decide owner) |
| Batch reconfirm modal on Home | Reconfirm batch modal lives on home (home.js:802) (08 §Job1-3) | Add reconfirm-pending batch modal state to a Home screen |
| Jumbotron tab truth | Jumbotron tabs sign-up/session/reflection must match shipped home CTAs; sign-up tab now points at in-app Sign-Ups (not spreadsheet/Acuity — retired, 06 §1/§3) | Verify jumbotron copy/targets against dev home.jsp; purge legacy wording |
| Badge claim flow | Claim once all lessons complete; issued via Accredible (external) (08 §f) | Badge components exist — add claim-flow states (unclaimed→claim→issued) + Accredible system note |
| Onboarding-complete variants | Page symbol has completed-onboarding true/false — matches onboarding gate (#1143) | Keep; annotate gate linkage to doc 05 |
| Demo-only typing interaction | Marked [wip] Demo only — no implementation | Keep tombstoned; exclude from blueprint evidence |

## Blueprint dependency
Home is the pre-session landing (05 row Home) — blueprint entry cells for each phase cite the jumbotron tabs; the reconfirm batch modal is a pre-session system-lane cell that currently has no Figma target. Profile feeds the proposed "Profile & Identity Maintenance" scenario (08 §a) — cells will link to the audited Tutor Profile screens and Status & Clearance card.

## Action items
- [ ] Audit Profile screens vs shipped field list (Card 2134); add missing fields + Status & Clearance card
- [ ] Add Slack-webhook system annotation on Slack-email change
- [ ] Add reconfirm batch modal state to Home
- [ ] Verify jumbotron tab targets; remove any legacy sign-up wording
- [ ] Add badge claim-flow states + Accredible annotation
- [ ] Decide feed-surface owner (Home page vs doc-08 growth page); document decision
- [ ] Fill Context blocks (Card 2134 ref)

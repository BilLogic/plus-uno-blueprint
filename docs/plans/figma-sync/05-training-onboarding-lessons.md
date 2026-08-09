# Figma Sync — Training / Onboarding + Training / Lessons
Date: 2026-08-08 · Page links:
- Training/Onboarding: https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=3385-292695
- Training/Lessons: https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=3385-243702

## Current page contents (verified via metadata)
**Training / Onboarding** — Onboarding section 3385:292696 → Screens 3385:292708: Onboarding / Overview ×2 (3385:292709, 3385:292710 — featured modules + all-modules list), Onboarding / Inner ×3 (3385:292711, 3385:292712, 3385:292713 — blurb, alert, PDF, strategy prompt; one with Module Completion Pop-up). Components 3385:292697: Status Indicators (not started / in progress / completed / **assigned** — new stage 5903:389345), Strategy Badge (7 media types), CTA Buttons, Sorting Dropdown, Card Item, Alert, Module Completion Pop-up, Strategy Content Prompt, List Item (6 states).

**Training / Lessons** — Lessons section 3385:256676 → Screens 3385:256690: List View ×4 (3385:256694, 3385:256703, 3385:256704 + component instances), Training / Lesson 5-page flow ×5 (3385:256695–256699: content, tables, likert questions, radio/textarea forms, wrap-up). Components 3385:256677: Rating 1–5, Likert Scale, **AI Indicator** (63:177685), Sort Control, Training Lesson Status Select, **Alert for Supervisors (ai feature enabled/disabled)** 63:177692, Lesson List Item (header/item × default/hover/pressed/focus/disable × expand), Toast / Text Button, plus stray Sections symbols (Student Overview, My Students + Student Overview, Welcome Row — belong to Home?).

## Out of sync with shipped app
| Gap | App reality (evidence) | Proposed Figma change |
|---|---|---|
| Onboarding gate not documented | Incomplete onboarding BLOCKS schedule/sessions (#1143) — hard dependency Onboarding→Sign-Up (08 §h) | Add gate annotation + blocked-state reference on Overview; cross-link Pre-Session doc 01 blocked state |
| New onboarding modules | 2 new onboarding modules merged (#1151) (08 §h) | Verify Overview/Inner cover new module types; update module list examples |
| LLM lesson feedback flow | LLM microservice grades lesson responses (LessonLLMFeedback, openai_feedback); this is where shipped AI lives — not in reflection (03 §Behavioral-5; 07 §5) | Confirm Lesson page-4/5 show AI feedback state; AI Indicator + supervisor ai-enabled/disabled alert exist — wire them into a documented feedback flow, not just component shelf |
| Lesson completion → Badges | Badge claim unlocks once ALL lessons complete; issued via Accredible external credentialing (08 §f) | Add completion→badge-claim handoff annotation; badge components live on Home page (doc 06) — cross-link |
| Training assignment emails | Lesson/strategy assignment emails shipped (03 §integrations-email; templates 6.1/6.2 on MISC page) | Cross-link MISC email templates 6.x from lesson-assignment states |
| Misplaced components | Student Overview / My Students / Welcome Row symbols sit in Lessons components but are Home-page organisms | Relocate to Home or Universal; leave redirect note |

## Blueprint dependency
Onboarding-phase frontstage cells cite Onboarding Overview/Inner (05 row: HIGH). The onboarding gate is a blueprint dependency edge (Onboarding→Pre-Session) that must exist before scenario wiring. Lessons' AI feedback loop is system-lane evidence; the blueprint's "AI in training" claims should point here, not at reflection (07 §5).

## Action items
- [ ] Document onboarding gate on Overview + blocked downstream state
- [ ] Verify/add screens for the 2 new modules (#1151)
- [ ] Promote AI lesson-feedback into an explicit documented flow (AI Indicator, supervisor toggle alert)
- [ ] Annotate lessons-complete → badge-claim handoff; cross-link Home badges
- [ ] Cross-link MISC email templates 5.x/6.x from assignment states
- [ ] Move Home-page organisms (Student Overview etc.) out of Lessons components
- [ ] Fill Context blocks (#1143, #1151 refs)

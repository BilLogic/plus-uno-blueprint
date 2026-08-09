# Lesson Modules — Content Revision Plan
Date: 2026-08-08 · Blueprint: PLUS Application › Onboarding › Lesson Modules · Path: Happy Path (`a0000000-0000-4000-8000-000000000802`)
Status of scenario today: 17 cells across 3 steps (Open lesson → Work through questions → Finish lesson). Figma citations on Front Stage Tech are good. Two problems: (1) all three Regular Tutor cells link *Onboarding Module 1/7* Notion pages — wrong artifact; lessons are in-app training with LLM feedback, not Notion modules; (2) the backstage completely omits the LLM grading loop, the strongest system behavior in this scenario.

## 1. Revise existing cells

| Cell (lane › step) | cell_id | Property | Current | Proposed | Evidence |
|---|---|---|---|---|---|
| Regular Tutor › Open lesson | `a0000000-0000-4000-8000-000000120103` | links | Onboarding Module 1 + Module 7 Notion links | REMOVE both (they belong to Onboarding Modules); no replacement needed — Figma link lives on the FST cell | 08/03: lessons served at /PLUS/Lessons in-app; Notion modules are a different scenario |
| Regular Tutor › Work through questions | `a0000000-0000-4000-8000-000000120203` | links | same wrong Module 1/7 links | REMOVE | same |
| Regular Tutor › Work through questions | `a0000000-0000-4000-8000-000000120203` | description | (empty) | "The tutor answers open-response lesson questions in the app. Responses get automated feedback from the LLM service, so tutors see strengths and gaps per answer rather than just right/wrong." | web-app: LessonLLMFeedback entity, `openai_feedback` on lessons, llm-rest-api microservice (03 sweep; 07 #5: only LLM code is lesson-related) |
| Regular Tutor › Finish lesson | `a0000000-0000-4000-8000-000000120303` | links | same wrong Module 1/7 links | REMOVE | same |
| Regular Tutor › Finish lesson | `a0000000-0000-4000-8000-000000120303` | description | (empty) | "The tutor finishes the lesson and receives their score and feedback. Completing every assigned lesson makes them eligible to claim their tutor badge, issued through Accredible." | 08 §Job2f: Badges claim once all lessons complete, issued via Accredible |
| Back Stage Actions › Open lesson | `a0000000-0000-4000-8000-000000120107` | description | (empty) | "The tutor supervisor team assigns lessons (individually or by mapping a group to a lesson with a time goal); assignment fires a notification email to the tutor." | 08 §Job2b: Groups admin "map group→lesson, lesson time goal"; 03: email types incl. lesson/strategy assignment |
| Back Stage Actions › Work through questions | `a0000000-0000-4000-8000-000000120207` | description | (empty) | "The instructional design team authors lesson content and competencies; module versions are managed so revisions don't disturb in-flight learners." | web-app entities Module/ModuleVersion, Competency (03 sweep) |

Front Stage Tech cells (`…120106`, `…120206`, `…120306`) keep their Figma links (3385-256703 / 3385-256698 / 3385-256699); copy `links[].description` prose into cell `description`.

## 2. New cells

| Lane › Step | Property | Proposed value | Evidence |
|---|---|---|---|
| Back Stage Tech › Work through questions | content | "LLM feedback service" | llm-rest-api (FastAPI :8000); LessonLLMFeedback |
| Back Stage Tech › Work through questions | description | "Lesson responses are sent to the LLM microservice, which returns per-answer feedback stored as LessonLLMFeedback; the model in use is tracked via LlmModelInfo." | 03 sweep (LLM microservice, LlmModelInfo) |
| Back Stage Tech › Finish lesson | content | "Accredible (badges)" · description: "When all lessons are complete the tutor can claim a badge; the credential itself is issued by Accredible, an external credentialing service." | 08 §Job2f |
| Back Stage Actions › Finish lesson | content | "Tutor supervisor team tracks lesson completion in the Admin › Tutors training-progress view." | 08 §Job2b; Figma Admin/Tutor 3408-120455 |
| Support Actions › Work through questions | links (on existing cell `…120209`) | Add `[{"type":"url","label":"Figma — Training/Lessons spec","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=3385-243702"}]` | Figma Training/Lessons page |

## 3. Structural changes (new steps / triggers / paths)

1. **Loop trigger**: "Finish lesson → Open lesson" (next uncompleted assigned lesson) — same cheap loop as Onboarding Modules.
2. **Trigger out**: "All lessons complete → badge claim" — if the "Post-Session Growth Loop" scenario proposed by the code report is created, the badge cell should move/point there; until then the Finish-lesson cells above carry it.
3. Consider a fourth step "Review feedback" only if Bill wants the LLM feedback moment tutor-visible as its own column; current 3-step shape is defensible since feedback is inline.
4. Visual lane: 3 empty cells; step screenshots already exist on the FST links (`step-01-lessons.png` etc.) — promote to Visual strip.

## 4. Divergences & open questions (things Bill must decide)

- **Wrong-artifact links**: confirm removal of the Onboarding Module 1/7 links is intended everywhere in this scenario (they appear on all 3 tutor cells) — they look like a copy-paste from Onboarding Modules.
- **"Receives score"**: verify whether tutors see a numeric score, LLM feedback, or both — the proposed prose says "score and feedback"; trim to match the actual UI.
- **Lesson vs. onboarding-module relationship**: onboarding gate (#1143) gates scheduling on onboarding modules; confirm whether assigned *lessons* are also gating or purely ongoing development, and state it in `…120103`'s description once known.

# Figma Sync — Toolkit / In-Session
Date: 2026-08-08 · Page link: https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=3400-286832

## Current page contents (verified via metadata)
- **Tutor In-Session Management** — section [149:110503](https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=149-110503)
  - Lead Tutor — 1691:119582 · Regular Tutor — 1691:119583 · Context block — 9998:385054
- **AI Student Insight** — section [96:121610](https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=96-121610)
  - Screens — 96:105728 (cards/list + Insights Modal) · Context block — 9998:385059
- **Goal Setting** — section [3377:227478](https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=3377-227478)
  - Screens — 5920:79843 · Context block — 9998:385064
- **Note taking** — section [10801:109778](https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=10801-109778)
  - Student Modal – Writes Notes ×2 (10801:109801, 10801:109837), Notes Empty (10801:109873), Student Dashboard (10801:109909), Note Cannot Save (10801:109945), Note Too Long (10801:109981)
- **Components (Local organisms)** — 1721:117438 (Elements, Tables, Pages, Cards, Modals, Sections, Index — deep links 9975:4)
- 3× [archive] Tombstone — Responsive Behavior (9997:270812/270816/270820)

## Out of sync with shipped app
| Gap | App reality (evidence) | Proposed Figma change |
|---|---|---|
| Lead vs Regular variants static | Regular tutors are dynamically promoted to LEAD when a lead calls off (lead-capable regular promoted, 08 §Job1-2c) | Annotate role variants: LEAD can be assigned mid-stream; add promoted-state note |
| Live student reassignment invisible | Attendance changes and absent tutors trigger live rebalancing (reassignStudentsFromAbsentTutor, placeSingleStudent, integrateJoiningTutor — 03 §Behavioral-1) | Add system-lane annotation to Tutor In-Session Mgmt: roster can change during session |
| Messaging absent from page | Tutor↔student messaging (PL2MessageServlet) is an in-session route (/PLUS/Message, /PLUSStudent/Message) with threads, lobby, unread counts, 40MB attachments (03 §routes; 08 §d) | No coverage here or anywhere — see doc 08 (new Messaging page); add cross-link from this page's Index |
| Attendance / start-session Q&A | start_session_questions JSPF handles attendance + session Q&A in-session (03 §routes) | Verify whether any section covers attendance capture; if not, add to Tutor In-Session Mgmt or note as gap |
| AI Student Insight provenance | TutorAiInsight served by LLM microservice with thumbs feedback (03 §integrations-LLM) | Confirm Insights Modal includes feedback affordance; add system-lane note (LLM microservice) |
| Note-taking error states | Good failure evidence (cannot-save / too-long) — matches sweep read (05 §In-Session row) | Keep; wire these states into blueprint failure cells |

## Blueprint dependency
In-session frontstage scenarios cite Tutor In-Session Management (lead/regular paths); AI Student Insight and Goal Setting land in the system/AI lane; note-taking error states are the page's failure-path evidence (05 §In-Session row, §Recommendations-3). Messaging cells currently have no Figma target — doc 08 resolves that.

## Action items
- [ ] Annotate LEAD promotion path on role variants
- [ ] Add system-lane note for live student reassignment during sessions
- [ ] Add Index cross-link to future Messaging page (doc 08)
- [ ] Decide where attendance / start-session questions are specced; add or record as explicit gap
- [ ] Confirm AI Insights Modal has thumbs feedback; annotate LLM-microservice source
- [ ] Fill Context blocks' Roadmap/PRD refs (currently "—")

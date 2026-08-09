# Figma Sync — Universal + Login + MISC / Email Templates & Demo
Date: 2026-08-08 · Page links:
- Universal: https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=1-184
- Login: https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=1-165
- MISC: https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=5650-71025

## Current page contents (verified via metadata)
**Universal** — Components 112:508: Page Layout master 111:241933 (+ live instance 10870:162695), Sections (Top Bar expand t/f, **Sidebar user=tutor/supervisor** 111:227891, Footer), Elements (User Avatar, SMART Static Badges ×45, **User Type Indicator: lead tutor / regular tutor / tutor supervisors / system admin / demo** 2370:191400, Maintenance Alert 2370:194322), Overview Card ×14 types. Screens section 112:518 essentially empty (Section Label only).

**Login** — Screens 112:1207: Sign-in Portal ×11 (115:5206, 115:5270, 115:5326, 115:5422, 115:5506, 115:5581, 115:5691, 115:5747, 115:5807, 115:5922, 115:6052, 115:6130, 115:6221 — grouped under 4 Section Labels). Components 112:1197: Login Portal card (official step 1/2/3a/3b + demo), Button/Auths (**google, clever**), Form/Access Code (default/invalid), Dropdown+Form/Institution Selection (official/independent), Modal/Notifications (A/B), Alert, Footer.

**MISC / Email Templates & Demo** — Emails 5670:6714: 10 numbered templates — 1 (admin invites tutor), 2 (admin invites student), 3 (tutor joins institution), 4 (tutor joins new institution), 5.1/5.2 (resource assigned), 6.1/6.2 (lesson assigned), 7.1 (tutor→group), 7.2 (student→group) — plus Header/Footer components and Pointer annotations. Demo 8930:160205: Sign-in Portal w/ notification modal 8930:162422 (sweep noted ~12 demo mockups; live metadata surfaced one top-level frame — recount during triage).

## Out of sync with shipped app
| Gap | App reality (evidence) | Proposed Figma change |
|---|---|---|
| Sidebar variants (tutor/supervisor only) | Shipped sidebar ground truth: Home / Training (Lessons, Onboarding) / Toolkit (Your Sessions, **AI Coach**, Slack link) / Admin (Tutors, Sessions, Students, Groups, **System Admin, Research Admin**) (08 §Job2 header) | Update Sidebar symbols to match shipped item set; add admin-tier variant if System/Research Admin items are conditional |
| Hidden nav shipped | Trends + "Tutoring Aids" nav exist in code but hidden (d-none) (08 §Passing) | Do NOT add to sidebar spec; note in Context block |
| No student-actor chrome | Entire student portal (/PLUSStudent) shipped with own nav (03 §routes; 08 §e) | Universal covers tutor-side chrome only — student shell goes to doc 08 new page; cross-link |
| Login methods | Google OAuth primary tutor sign-in; student portal has LOCAL login/registration; /IndependentAccount + pl2_registration.jsp exist (03 §routes, §integrations) | Verify Clever button is shipped vs aspirational; add student local-login/registration coverage or delegate to doc 08 student page |
| Email template coverage vs shipped set | Shipped email types: welcome/new-user, students-added, lesson/strategy assignment, group assignment, tutor broadcast, feedback, session-cancellation (single/date/date-range/shift-range/all-future — all-future template UNUSED since no all-future cancel), error alerts (03 §integrations-email; 08 §Job1-8) | Add missing template specs: tutor broadcast, session-cancellation scoped variants, students-added; tombstone all-future cancellation as unused |
| Slack-bridge "emails" | CALL_OFF_SLACK_EMAIL and STUDENT_ROSTERING_SLACK_EMAIL are email-gateway Slack notifications, not human-facing emails (08 §Job1-2d, 5b) | Document as system-lane comms, not templates to design |
| Demo section | Demo sandboxes /demo, /toolkit-demo, /training-demo shipped incl. Demo Zoom Link (#1139) (03 §routes; 08 §h) | Recount demo mockups; add Demo Zoom Link state |

## Blueprint dependency
Universal = frontstage chrome across ALL phases; Login = Onboarding-phase entry evidence; email templates = comms lane across phases (05 rows). The user-type indicator set is the blueprint's actor roster — currently missing the student actor entirely, which blocks the student-lane work in doc 08.

## Action items
- [ ] Update Sidebar symbols to shipped nav set (incl. AI Coach, System/Research Admin)
- [ ] Note hidden Trends/Tutoring Aids as not-live
- [ ] Verify Clever auth is shipped; document student local login ownership (here vs doc 08)
- [ ] Add missing email templates (broadcast, cancellation scopes, students-added); mark all-future variant unused
- [ ] Reclassify Slack-bridge notifications as system-lane comms
- [ ] Recount Demo mockups; add Demo Zoom Link state (#1139)
- [ ] Add "student" to User Type Indicator once student pages exist (doc 08)

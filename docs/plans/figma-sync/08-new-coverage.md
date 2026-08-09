# Figma Sync — NEW Coverage: shipped surfaces with no Figma page
Date: 2026-08-08 · File: https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs

Verified against the live page list (Cover, Spec Template, Information Architecture [empty], Universal, Login, Profile, Home, Training ×2, Toolkit ×3, Admin ×4, MISC, Archive): none of the surfaces below has any page or section in the file. All facts from reports 03 (routes/entities) and 08 (feature enumeration); staleness per 06/07.

## Proposed new pages

### A. Toolkit / Resources
App: /PLUS/Resources, /PLUS/Resource, /PLUS/Assistant + wizard/*.jsp (03 §routes). Library organized by competency groups; per-resource assign / pin / download / prompts / complete / delete; Resource Assistant guided wizard; resource editor; playlists near-dormant (08 §c).
Sections: 1. Library (browse/filter by competency) · 2. Resource detail (actions) · 3. Resource Assistant wizard flow · 4. Resource editor (supervisor) · 5. Components. Skip playlists (dormant) — tombstone note only.
Blueprint: proposed scenario "Session Prep / Resource Selection" (08 §c).

### B. Messaging (tutor + student)
App: PL2MessageServlet — tutor↔student threads, lobby, unread counts, 40MB attachments; student side + home surfacing (08 §d; routes /PLUS/Message, /PLUSStudent/Message). Resource/lesson assignment emails say "also available in your messages" (MISC templates 5.x/6.x) — messaging is the delivery channel.
Sections: 1. Thread lobby (tutor) · 2. Conversation view (attachments, unread) · 3. Student-side messaging · 4. Unread surfacing (home entry points) · 5. Components.
Blueprint: proposed scenario "Between-Session Communication" (08 §d).

### C. Student Portal
App: /PLUSStudent home (assigned resources w/ completion, unread messages), markResourceAsUsed, messaging, feedback, local login/registration, demo controls (08 §e); kickoff_interview.jsp full + short variants, submitKickoffInterview (08 §g; 03 §routes).
Sections: 1. Student login/registration (local auth) · 2. Student home · 3. Resources (mark-as-used) · 4. Kickoff interview (full + short) · 5. Feedback · 6. Components (student chrome — extends Universal, which is tutor-only; add student User Type Indicator, see doc 07).
Blueprint: the blueprint has NO student-actor surface today (08 §e) — this page unlocks an entire student lane; kickoff interview = proposed scenario "Student Kickoff Interview" (08 §g).

### D. Toolkit / AI Coach & Growth Loop
App: /PLUS/TutorReview — Impact, Time Allocation, AI Growth Insights + thumbs feedback (TutorAiCoach #1064); Badges page (claim once all lessons complete, Accredible issuing); home feed posts (EdTechGoalPost, EdTechUpdatePost, MentorReflectionPost, ResourceAssignedPost, NeedsEdTechGoalNotification) (08 §f). tutor_coach.jsp appears unrouted/legacy — exclude.
Sections: 1. AI Coach dashboard (Impact / Time Allocation tabs) · 2. AI Growth Insights + feedback affordance · 3. Badges (claim flow — reuse Home badge components, doc 06) · 4. Feed post types · 5. Components. Note: purge stale "from Acuity" chart tooltip wording (07 §1) when speccing charts.
Blueprint: proposed scenario "Post-Session Growth Loop" (08 §f).

### E. Admin / Program & Research
App: SystemAdmin (institutions, tutor-admins, move tutors, passphrases, accreditation); ResearchAdmin / ResearchDashboard (A/B experiment infra is first-class: TestCondition, ExperimentConditionHelper); institution settings + dashboards; per-student dashboard (goals, achievement bars, progress plots, weekly reflections, conversation questions); edtech goal services ~12 platforms (ALEKS…Khan Academy…) with per-platform institution goals (08 §b, §g; 03 §Behavioral-7, §integrations-EdTech).
Sections: 1. System Admin (institutions/passphrases/accreditation) · 2. Research Admin & dashboard · 3. Institution settings + edtech goal config · 4. Per-student dashboard · 5. Components.
Blueprint: proposed scenario "Supervisor Program Administration" (08 §b); per-student dashboard = path in Goal Setting or its own scenario (08 §g).

## Priority order
1. **C. Student Portal** — only surface introducing a missing blueprint actor/lane.
2. **B. Messaging** — cited by shipped email templates; blocks between-session cells.
3. **A. Resources** — pre/in-session prep scenario.
4. **D. AI Coach & Growth Loop** — post-session system lane.
5. **E. Admin / Program & Research** — backstage; lowest journey coupling.

## Action items
- [ ] Create the five pages using the Spec Template (1:180) scaffold (Screens + Context block + Components sections, fidelity noted)
- [ ] C: capture student local login/registration + kickoff interview (full/short) first
- [ ] B: spec thread lobby + conversation + student side; link from In-Session Index (doc 02)
- [ ] A: spec library, detail actions, Assistant wizard; tombstone playlists
- [ ] D: spec TutorReview tabs + insights feedback + badge claim; exclude legacy tutor_coach.jsp
- [ ] E: spec SystemAdmin/ResearchAdmin/institution dashboards + per-student dashboard + edtech goal config
- [ ] Add "student" User Type Indicator to Universal (doc 07) alongside page C
- [ ] Register each new page in the empty Information Architecture page (1:182)

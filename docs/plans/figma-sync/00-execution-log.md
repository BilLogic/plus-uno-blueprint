# Figma sync — execution log

## 2026-08-08: text/spec corrections applied (16 annotations)

All new TEXT nodes prefixed "[sync 2026-08-08]", Merriweather Sans 13, amber, placed in/near each page's context block. No frames deleted, no layout changes, no library edits.

| Page | Annotation node | Covers |
|---|---|---|
| Pre-Session (tutor ctx 9998:288279) | 11272:161737 | reconfirm shipped (dev) + UNAVAILABLE edge; <12h immediate execution; auto-approve rules + reassignment/LEAD promotion; withdraw-pending; 72h fill-in; 6-tab set; onboarding gate |
| Pre-Session (supervisor ctx 9998:308860) | 11272:161738 | no create-session (DB import); cancel scopes single/shiftDateRange/dateRange + revert; edit scopes + notify fan-out; Slack bridge |
| In-Session (mgmt ctx 9998:385054) | 11272:241671 | LEAD promotion; live rebalancing; messaging unspecced; attendance Q&A gap |
| In-Session (AI ctx 9998:385059) | 11272:241672 | TutorAiInsight = LLM microservice + thumbs |
| Post-Session (ctx 9998:402359) | 11272:251700 | AI-generating states design-only; 5-file/1GB; edit-prefill Card 2225; dual entries |
| Post-Session (near 20:6006) | 11272:251701 | "[proposal — not shipped]" marker over AI-state frames |
| Admin/Tutor (9998:466382) | 11272:421346 | Acuity retired; broadcast/export unspecced; Trends hidden |
| Admin/Session (9998:483379) | 11272:425460 | calendar view shipped Card 2266; 15-min Join gate; scopes; assignment lane |
| Admin/Student (9998:498936) | 11272:425461 | add/CSV/goals unspecced; SSE #1113; Slack-bridge no digest |
| Admin/Group (9998:509636) | 11272:427075 | CRUD/lesson mapping unspecced; group scheduling dimension #1126 |
| Training/Onboarding (9998:21359) | 11272:427878 | onboarding gate #1143; 2 new modules #1151; email cross-ref |
| Training/Lessons (9998:17657) | 11272:430455 | AI lives in lessons; Accredible badges; misplaced Home organisms |
| Profile (top of 1133:253984) | 11272:430456 | Card 2134 fields; Status & Clearance; Slack webhook |
| Home (9998:7913) | 11272:430457 | jumbotron → in-app tab; batch reconfirm modal; feed posts unspecced |
| Universal (9985:1631) | 11272:430581 | shipped sidebar set incl. AI Coach/System+Research Admin; hidden items |
| MISC/Email (9998:513047) | 11272:431151 | missing template specs; all-future template unused; Demo Zoom Link #1139 |

Skipped (by rule): literal "Acuity" text edits (zero editable matches — lives in code tooltips/library instances), Login page (Clever = verify item), all frame/structural work + doc 08 new pages (design team), Roadmap/PRD placeholder fields (team fills deliberately).

## 2026-08-08: structural cleanup

Scaffolding only — pages, sections, context blocks, grey dashed placeholder frames with "[sync 2026-08-08]" annotations. No polished screens; no existing designer sections moved or reflowed. Anatomy replicated from Spec Template (1:180) / Pre-Session (1:175): domain Section + Context block (Lato Bold 18 title "▸ [spec] … · fidelity: high", Roadmap/PRD/R-ID slots, Intent, Open, amber known-facts) + Components (Local organisms) section.

### New pages (doc 08)

| Page | Page id | Domain section | Placeholders created |
|---|---|---|---|
| Student Portal (after Home) | 11275:4 | 11276:4 (+ Components 11276:26) | 1. Student Login/Registration 11276:11 · 2. Student Home 11276:14 · 3. Resources (mark-as-used) 11276:17 · 4. Kickoff Interview full+short 11276:20 · 5. Feedback 11276:23 |
| Toolkit / Resources & Assistant (before Pre-Session) | 11275:5 | 11276:51 (+ Components 11276:73) | 1. Library 11276:58 · 2. Resource Detail 11276:61 · 3. Assistant Wizard 11276:64 · 4. Resource Editor 11276:67 · [tombstone] Playlists 11276:70 |
| Messaging (Tutor + Student) (after Post-Session) | 11275:6 | 11276:29 (+ Components 11276:48) | 1. Thread Lobby 11276:36 · 2. Conversation View 11276:39 · 3. Student-side 11276:42 · 4. Unread Surfacing 11276:45 |
| Toolkit / AI Coach & Growth Loop (after Messaging) | 11275:7 | 11276:76 (+ Components 11276:98) | 1. AI Coach Dashboard 11276:83 · 2. Growth Insights + Feedback 11276:86 · 3. Badges claim flow 11276:89 · 4. Feed Post Types 11276:92 · [tombstone] tutor_coach.jsp 11276:95 |
| Admin / Program & Research (after Admin/Group) | 11275:8 | 11276:101 (+ Components 11276:120) | 1. System Admin 11276:108 · 2. Research Admin & Dashboard 11276:111 · 3. Institution + EdTech Goal Config 11276:114 · 4. Per-Student Dashboard 11276:117 |

Each context block carries Intent + known facts from doc 08 (routes, servlets, blueprint scenario names). Placeholders list required content per code evidence.

### Missing-case sections on existing pages (docs 01/03/04/06)

| Page | Node | What |
|---|---|---|
| Toolkit / Pre-Session | 11276:161856 | "7. Revert flow — TO SPEC" section inside Supervisor Pre-Session (206:149220, height extended 38263→39600; children untouched); placeholder 11276:161857 (revertSessionsWithScope, 3 cancel scopes, no all-future) |
| Toolkit / Pre-Session | 11276:161860 | "[not shipped — sessions are DB-imported]" annotation header inside "2. Managing sessions" (1776:129470), placed above existing content (was not previously annotated at section level) |
| Admin / Session | 11276:398688 | "Calendar View (shipped Card 2266) — TO SPEC" page-level section right of Session section; placeholder 11276:398689 (calendar/table nav, details actions, 15-min Join gate) |
| Toolkit / Post-Session | 11276:414644 | "02 · Recording upload states (5 files / 1GB) — TO SPEC" section (5-file/1GB, folder upload removed Apr 2026, edit-prefill Card 2225); tied to 02 - Session Info 20:5872 |
| Home | 11276:420977 | "Badge claim flow — TO SPEC" section (unclaimed→claim→issued via Accredible; reuse Badges set 2359:153252) |

### Information Architecture page (1:182)

Built text-based file map 11277:4 ("Information Architecture — file map", 1200×966): title + 6 journey-phase groups (Foundation & meta / Entry & identity / Onboarding & training / Session toolkit / Admin backstage / Reference), every page listed with a one-line "what it specs" note; ★ NEW marks the five scaffold pages. Serves as the file's table of contents.

### Page order after insertions

Cover · Spec Template · ─── · Information Architecture · Universal · ─── · Login · Profile · Home · **Student Portal** · ─── · Training/Onboarding · Training/Lessons · ─── · **Toolkit/Resources & Assistant** · Toolkit/Pre-Session · In-Session · Post-Session · **Messaging** · **AI Coach & Growth Loop** · ─── · Admin/Tutor · Session · Student · Group · **Admin/Program & Research** · ─── · MISC · Archive

### Skipped (with reasons)

- Doc 04 "add flows" items (tutor broadcast/export, add-student/CSV, group CRUD, edit/cancel modal alignment) — screen-level visual design, stays with design team; annotations from the 2026-08-08 text pass already flag them.
- Doc 05/06/07 relocation items (move Home organisms out of Lessons components, Sidebar symbol updates, email template additions) — library/component edits require designer judgment + manual publish; not section-level scaffolding.
- Reconfirm batch-modal state on Home — screen-state design work, not a section; covered by Home ctx annotation 11272:430457.
- Attendance / start-session Q&A (doc 02) — doc says "decide where specced"; decision not made, recorded as open gap in In-Session ctx annotation 11272:241671.
- Roadmap/PRD "—" slots on existing pages — team fills deliberately (standing rule).
- No existing designer-made sections were moved, resized (except parent-height extension noted above), or deleted; stray Rectangle 11088:26163 left in place (deletion not authorized as structural scaffolding).

Verified: get_metadata on all 5 new pages + IA page; screenshot of Student Portal section 11276:4 renders correctly.

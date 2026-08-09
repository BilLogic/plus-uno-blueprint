# Figma Sync — Toolkit / Post-Session
Date: 2026-08-08 · Page link: https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=3400-286833

## Current page contents (verified via metadata)
- **Post-Session** — section [20:5808](https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=20-5808)
  - 01 – Entry Point — 20:5809 (Reflections page)
  - 02 – Session Info — 20:5872 (picker, no-recording reason)
  - 03 – Student Reflection — 20:6210
  - 04 – Session Reflection — 20:6006 (AI-generating, Save & Exit, worst-case)
  - 05 – Self Reflection — 20:6125
  - 06 – Form Feedback — 10788:8281
  - Context block — 9998:402359
- **Components (Local organisms)** — 1721:118446 (Elements, Tables, Pages, Cards, Modals, Sections)
- [archive] Tombstone — Responsive Behavior — 10001:154041 · stray Rectangle 1 — 11088:26163

## Out of sync with shipped app
| Gap | App reality (evidence) | Proposed Figma change |
|---|---|---|
| "AI-generating" states in 04 Session Reflection | ZERO AI in shipped reflection — the only LLM code is lesson feedback + TutorReview (08 §Job1-6; 07 §5). Reflection redesign incl. AI follow-ups is design-stage only, unresolved as of mid-July 2026 (06 §5) | Mark AI-generating screens `[proposal — not shipped]`; keep them but separate from as-built flow |
| Ratings widget | Shipped: 1–5 star button-group ratings (reflection.jsp:194-285), adaptive areas chips (reflection.js:438-455) (07 §5) | Verify 03/04/05 use button-group + chips as shipped; chips were endorsed in design review (06 §5) so likely aligned — confirm |
| Recording upload rules | MAX 5 files / 1GB; folder-upload added Feb 2026 then removed Apr 2026; reflection editing with prefill shipped (Card 2225) (07 §5; 08 §Job1-6) | Ensure 02 Session Info upload spec states 5-file/1GB limit, no folder upload; add edit-with-prefill state |
| Reflection entry surfaces | Reflections is also a tab in the tutor schedule tab set (08 §Job1-1); weekly_reflections exists as separate route (03 §routes) | Confirm 01 Entry Point reflects both entry paths |
| Post-session growth loop absent | AI Coach (/PLUS/TutorReview: Impact, Time Allocation, AI Growth Insights + thumbs), Badges, home feed posts are shipped post-session surfaces with no Figma home (08 §f) | Out of scope for this page — covered by doc 08 new page; add Index cross-link |

## Blueprint dependency
Post-session journey cells map directly onto the numbered 01–06 sections — the page is already journey-shaped (05 §Post-Session row). The AI-generating states must NOT be cited as shipped evidence in the blueprint; they belong to a design-proposal lane until the reflection redesign lands (06 §5).

## Action items
- [ ] Tag all AI-generating / AI-question screens in 04 as not-shipped proposals
- [ ] Verify rating button-groups + adaptive chips match shipped reflection.jsp
- [ ] State 5-file/1GB upload limit; remove any folder-upload affordance; add edit/prefill state
- [ ] Confirm 01 Entry covers Reflections tab + weekly reflections entry
- [ ] Add cross-link to future AI Coach / growth-loop page (doc 08)
- [ ] Delete stray Rectangle 1 (11088:26163); fill Context block refs

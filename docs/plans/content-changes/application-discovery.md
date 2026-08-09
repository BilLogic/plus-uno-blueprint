# Discovery — Content Revision Plan
Date: 2026-08-08 · Blueprint: PLUS Application › Application › Discovery · Path: Happy Path (`a0000000-0000-4000-8000-000000000700`)
Status of scenario today: 28 cells across 6 steps, happy-path only. 0% descriptions on cells (all detail lives inside `tech_description` link entries), 6 empty Visual cells, and the canonical funnel's required info-session stage is missing entirely. No Figma coverage exists for the Application phase — screenshot/spec citations are not possible here; evidence is Slack + Notion only.

## 1. Revise existing cells

| Cell (lane › step) | cell_id | Property | Current | Proposed | Evidence |
|---|---|---|---|---|---|
| Regular Tutor › Discovers PLUS (Handshake) | `a0000000-0000-4000-8000-000000070503` | description | (empty) | "Candidates find the PLUS tutor posting on Handshake or submit the website interest form. Both routes converge on the same funnel: interest form → required info session → post-info-session application." | Notion "Hiring process revisions" (80e738fbac2447dbb0db1dab15fe7b85) |
| Regular Tutor › Interested in joining PLUS | `a0000000-0000-4000-8000-000000070603` | description | (empty) | "Interest is captured through an interest form (website or Handshake). Submitting the form is not yet an application — candidates must first attend a required info session before the post-info-session form, which counts as the first interview." | Notion 80e738fb… (funnel definition) |
| Regular Tutor › Interested in joining PLUS | `a0000000-0000-4000-8000-000000070603` | links | (none) | `[{"type":"url","label":"Hiring process revisions (Notion)","url":"https://www.notion.so/80e738fbac2447dbb0db1dab15fe7b85"}]` | same |
| Front Stage Tech › Discovers PLUS (Marketing Website) | `a0000000-0000-4000-8000-000000070306` | description | (empty) | "The marketing website (tutors.plus) routes each audience to its own funnel: /for-tutors → 'Become a Tutor' (tutor sign-up Google Form) or 'Try Demo' (app.tutors.plus/demo sandbox); /for-schools → 'Get Started' (contact form); /for-researchers → publications. Site verified live 2026-08-08." | Live site read 2026-08-08; demo routes in web-app code |
| Front Stage Tech › Discovers PLUS (Marketing Website) | `a0000000-0000-4000-8000-000000070306` | links (add) | `{"type":"url","label":"tutors.plus — For Tutors","url":"https://tutors.plus/for-tutors"}` · `{"type":"url","label":"Tutor sign-up form","url":"https://docs.google.com/forms/d/e/1FAIpQLSfnLoEbL_irrlGeoW6toMctQ8rstewQ1-PB4h7XwUKZAeXmVg/viewform"}` · `{"type":"url","label":"App demo sandbox","url":"https://app.tutors.plus/demo"}` | same |
| Back Stage Actions › Discovers PLUS (Handshake) | `a0000000-0000-4000-8000-000000070507` | description | (empty) | "The tutor supervisor team posts and maintains job openings on the PLUS Handshake employer profile; the same team runs the tutor-to-student ratio model and partner calendar that determine how many tutors each semester needs." | Slack #plus-core: Ratio Model (Danielle Thomas, 2025-07-15 & 2026-07-30), 2026-27 Partner Calendar spreadsheet |
| Support Actions › Discovers PLUS (Branding Guidelines, col 1) | `a0000000-0000-4000-8000-000000070209` | description | (empty) | "Branding guidelines keep PLUS recruiting content visually and tonally consistent across social channels." | mirrors existing link `tech_description` (currently only in links JSON) |
| Support Actions › Discovers PLUS (col 2) | `a0000000-0000-4000-8000-000000070309` | description | (empty) | "The marketing/design teams follow the branding guidelines and design system so the marketing website stays consistent with other PLUS surfaces." | mirrors existing link `tech_description` |

Note: the cells whose only prose sits inside `links[].description` (`…070206`, `…070406`, `…070506`, `…070208`, `…070308`, `…070508`) should each get that same prose copied into the cell `description` field so the detail panel is populated — the tech_description entries stay as-is.

## 2. New cells

| Lane › Step | Property | Proposed value | Evidence |
|---|---|---|---|
| Regular Tutor › Attends info session (NEW step) | content | "Attends required PLUS info session." | Notion 80e738fb…: info session is mandatory between interest form and application |
| Regular Tutor › Attends info session (NEW step) | description | "After submitting the interest form, the candidate attends a required info session run by the tutor supervisor team. Only attendees receive the post-info-session form, which serves as the first interview." | same |
| Front Stage Tech › Attends info session (NEW step) | content | "Zoom" | Notion 80e738fb…; Training Master List (160b7cca…) lists info-session slides |
| Front Stage Actions › Attends info session (NEW step) | content | "Tutor supervisor team hosts info session and shares the post-info-session form with attendees." | Notion 80e738fb… |
| Back Stage Actions › Attends info session (NEW step) | content | "Tutor supervisor team maintains info-session slides and tracks attendance to gate the application form." | Notion Training Master List 160b7cca… (info-session slide decks) |
| Support Actions › Discovers PLUS (col 0, word of mouth) | content | "Referral culture — current/former tutors informally recruit peers." | existing FSA cell `…070104`; keeps Support lane from being empty at col 0 |
| Front Stage Tech › Interested in joining PLUS | links (add) | `{"type":"url","label":"Tutor sign-up form (Google Form)","url":"https://docs.google.com/forms/d/e/1FAIpQLSfnLoEbL_irrlGeoW6toMctQ8rstewQ1-PB4h7XwUKZAeXmVg/viewform"}` — this IS the live interest/sign-up form | provided by Bill 2026-08-08 |
| Support Actions › (contact channel cell, col TBD) | links (add) | `{"type":"url","label":"PLUS contact form (Google Form)","url":"https://docs.google.com/forms/d/e/1FAIpQLSc0TFyKzbPu5WGHWc13SDQ5aOrUQZgAAC_MMp0hK467OAzjeQ/viewform"}` — generic misc contact form | provided by Bill 2026-08-08 |

## 2b. Marketing-site persona funnels (verified live 2026-08-08)

The site serves four audiences with distinct funnels — Discovery today only documents the tutor one. Candidate material for persona-specific paths or a widened scenario:

| Persona | Site path | CTA → destination | Blueprint implication |
|---|---|---|---|
| Prospective tutor | /for-tutors (pay, flexible hours, free training, certification badges, partner universities) | "Become a Tutor" → tutor sign-up Google Form; "Try Demo" → app.tutors.plus/demo sandbox | Current Discovery path — add demo-sandbox cell (demo routes exist in app code) |
| School / district | /for-schools (4-phase model: Expert Kickoff → 1:1 Tutoring → Goal-Driven Monitoring → Teacher Loop; "See If Your School Qualifies") | "Get Started" / "Get PLUS Tutoring" → generic contact Google Form | School-side discovery path (pairs with One-Pager + Partner Calendar backstage); the published 4-phase model is a customer-facing mirror of the blueprint's own phases |
| Researcher | /for-researchers, /publications | "Read Our Research" | Out of blueprint scope, or future researcher lane |
| Teacher/public | success stories, newsletter subscribe, LinkedIn/Instagram | newsletter form | Feeds Discovery social-channel cells |

Site CTAs also confirm: Log In → app.tutors.plus/login; "Register Now/Register Your Tutors" → certification (Accredible badges tie-in); Media Kit → plus-tutors.notion.site/brand-guidelines (real link for the Branding Guidelines support cell).

## 3. Structural changes (new steps / triggers / paths)

1. **New step "Attends info session"** between "Discovers PLUS" and "Interested in joining PLUS" (or immediately after "Interested…" — see §4). This is the only stage of the canonical funnel with zero blueprint presence. Trigger: "Interest form submitted → info session invitation."
2. **Rename/merge consideration**: the five "Discovers PLUS" columns (word of mouth / social / website / campus / Handshake) are channel variants of one moment, not sequential steps. Keep as columns but add a step-level note that they are parallel channels converging on the interest form.
3. No unhappy path exists; the natural one is "attends info session but never submits the post-session form" — candidate silently drops. Low priority; log as future path.

## 4. Divergences & open questions (things Bill must decide)

- **Info-session placement**: before or after the "Interested in joining PLUS" step? The Notion funnel reads interest form → info session → application form, which suggests the new step goes after "Interested…" and the Interview & Offer scenario's "Applies" step is actually the *post-info-session* form. Decide which scenario owns the info session.
- ~~Intercom~~ **RESOLVED (Bill, 2026-08-08): no Intercom anywhere — fully retired/never for candidate comms. Do not add any Intercom cell; purge any Intercom mention found in blueprint content.**
- **No Figma coverage** for anything in this scenario — accept Notion/Slack citations only, or commission Application-phase spec pages.
- Application form questions and rubrics are written down nowhere (Notion gap list). If cells are to link an artifact for "creates and manages application form" (`…070107` area), one must be created first.

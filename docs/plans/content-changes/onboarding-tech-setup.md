# Tech Setup — Content Revision Plan
Date: 2026-08-08 · Blueprint: PLUS Application › Onboarding › Tech Setup · Path: Happy Path (`a0000000-0000-4000-8000-000000000800`)
Status of scenario today: 38 cells across 8 steps (Clearance email → … → PLUS app login), happy-path only, 13% descriptions. The HR/clearance half is reasonably accurate; the app-access half is stale — it says "obtains login credentials", but tutor sign-in is Google OAuth and account creation happens in the Admin portal. Profile completion (a required, documented onboarding task) has no cell anywhere.

## 1. Revise existing cells

| Cell (lane › step) | cell_id | Property | Current | Proposed | Evidence |
|---|---|---|---|---|---|
| Regular Tutor › PLUS app login | `a0000000-0000-4000-8000-000000100803` | content | "Obtains login credentials for PLUS app." | "Signs in to the PLUS app with their Google account." | web-app: /PLUS/auth Google OAuth is the primary tutor sign-in (03-github-sweep routes table) |
| Regular Tutor › PLUS app login | `a0000000-0000-4000-8000-000000100803` | description | (empty) | "Once the supervisor team has created their account, the tutor signs in at app.tutors.plus via Google OAuth using the email on file — there is no separate password credential for tutors." | web-app /PLUS/auth; prod host app.tutors.plus |
| Front Stage Actions › PLUS app login | `a0000000-0000-4000-8000-000000100804` | content | "PLUS supervisor team provides login credentials to tutor." | "Tutor supervisor team creates the tutor's account and confirms which email to sign in with." | Admin portal "add tutor" (08-code-validation §Job2b, Tutors admin) |
| Front Stage Tech › PLUS app login | `a0000000-0000-4000-8000-000000100806` | links | Email + PLUS App (Figma 115-5206) | Keep both; add `{"type":"url","label":"Figma — Demo Sign-in Portal","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=8930-160205"}` and `{"type":"url","label":"Figma — Login spec","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=1-165"}` | 05-figma-sweep: Login page 1:165 (labels), Demo Sign-in Portal 8930:160205 (12 mockups) |
| Regular Tutor › Join Slack | `a0000000-0000-4000-8000-000000100703` | description | (empty) | "The tutor accepts the Slack invite and joins the PLUS tutor workspace. Their Slack email is later recorded on their tutor profile so ops can reach them; changing it in the profile notifies the ops team automatically." | web-app MentorProfileServlet Slack-email webhook (:237-258, Card 2134/PR#1132) |
| Regular Tutor › Clearance email | `a0000000-0000-4000-8000-000000100103` | description | (empty) | "After CPO clearance is initiated (post-acceptance), the tutor receives an email with step-by-step instructions and links for the mandated clearances. No PLUS app or training access is granted until clearance completes." | Slack #plus-core Alex Houk 2026-04-01 (access gated on CPO clearance) |
| Back Stage Actions › Payroll setup | `a0000000-0000-4000-8000-000000100607` | description | (empty) | "The supervisor team completes the employer-side Workday paperwork for student employment; the I-9 and payroll steps run through CMU HR systems, outside PLUS-built tooling." | existing cells; Notion "Capture CMU hiring process" (223b7cca…) Workday/SSN forms |

Also copy the `links[].description` blurbs into empty cell `description` fields for `…100106`, `…100206`, `…100306`, `…100406`, `…100606`, `…100706`, `…100806`, `…100608` (same pattern as other Application/Onboarding scenarios — detail currently hidden inside links JSON).

## 2. New cells

| Lane › Step | Property | Proposed value | Evidence |
|---|---|---|---|
| Regular Tutor › Complete tutor profile (NEW step) | content | "Completes their tutor profile in the PLUS app." | Notion "Complete Your Tutor Profile" (3a7b7cca-4982-8034-9aae-f85766080d59); MentorProfileServlet (Card 2134/PR#1132) |
| Regular Tutor › Complete tutor profile (NEW step) | description | "On first login the tutor fills out their profile: preferred name, pronouns, photo, additional email, Slack email, position, university, graduation semester, and languages, then hits Save And Update. A read-only Status & Clearance card shows their tutor/onboarding/clearance status." | web-app MentorProfileServlet fields (08 §Job2a); Notion 3a7b7cca… |
| Front Stage Tech › Complete tutor profile (NEW step) | content | "PLUS App — Tutor Profile" · links: `[{"type":"url","label":"Figma — Profile spec","url":"https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=1-181"},{"type":"url","label":"Complete Your Tutor Profile (Notion)","url":"https://www.notion.so/3a7b7cca498280349aaef85766080d59"}]` (page id `3a7b7cca-4982-8034-9aae-f85766080d59`) | Figma Profile page 1:181 (Tutor Profile + Skills); Notion 3a7b7cca… |
| Back Stage Tech › Complete tutor profile (NEW step) | content | "Slack webhook — profile email changes" · description: "Changing the Slack email on a profile fires a Slack webhook to the ops channel so records stay in sync." | EmailHelper.java:155 / MentorProfileServlet :237-258 |
| Back Stage Tech › PLUS app login | content | "Google OAuth" · description: "Tutor authentication is delegated to Google OAuth; the app matches the Google identity to the account the supervisor team created." | web-app /PLUS/auth |
| Back Stage Actions › PLUS app login | content | "Tutor supervisor team creates the tutor account in the Admin › Tutors portal (add tutor, set email, assign group)." | 08 §Job2b Admin portal: Tutors (add tutor, edit); Figma Admin/Tutor 3408-120455 |

## 3. Structural changes (new steps / triggers / paths)

1. **New step "Complete tutor profile"** after "PLUS app login" (col 9). This is the documented final tech-setup task and the seam into Onboarding Modules. Alternative: spin it into the proposed "Profile & Identity Maintenance" scenario (08 §Job2a) and keep only a pointer cell here — decide in §4.
2. **Trigger in**: from Interview & Offer "Accepts offer" — "CPO clearance initiated" (see that plan). **Trigger out**: "Profile complete → Onboarding Modules › Module opening."
3. The 8 Visual cells are empty; Login/Profile screenshots exist in Figma (1-165, 1-181, 8930-160205) — propose pictures for the two PLUS-app steps only; HR steps (Workday, I-9) have no PLUS-owned visuals.

## 4. Divergences & open questions (things Bill must decide)

- **Profile: step here vs. new scenario.** Code report proposes a standalone "Profile & Identity Maintenance" scenario (profile editing is a lifetime activity, not just onboarding). Recommendation: add the onboarding-time step here now; create the maintenance scenario separately later.
- **"Login credentials" wording — resolved (code check 2026-08-08)**: PLUS tutors sign in via Google OAuth only. /IndependentAccount serves the separate "Independent Institution" self-serve signup (2022-era servlet), not partner-program tutors. Reword to OAuth.
- **Onboarding gate**: PR #1143 blocks schedule/session access until onboarding modules complete. It's documented in the Onboarding Modules and Session Sign Up plans; decide if Tech Setup's "PLUS app login" description should also mention that first login lands the tutor in a training-only app state.
- Clearance ownership overlap with Interview & Offer (see that plan §4) — pick one scenario to own the CPO handoff.

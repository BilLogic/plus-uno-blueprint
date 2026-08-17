# Applied — 2026-08-08 — Application + Onboarding content revisions

Scope: Discovery, Interview & Offer, Tech Setup, Onboarding Modules, Lesson Modules, Session Sign Up.
Applied to the PLUS Uno Blueprint Supabase DB (supabase-plus) per the six revision-plan docs in this folder.
One transaction per scenario; every targeted row was SELECTed first and matched the doc's "Current" state (deviations noted below). Backups `backup_20260808_*` pre-existed; none created here.

Schema note: the live `cells` table has `slot_position` (unique on `layer_id, step_id, slot_position`), so "new cell in an occupied lane/step" was inserted at the next slot rather than skipped. New rows use ids prefixed `e0000000-…` (steps `…0601–0603`, cells `…0611–0662`).

Intercom purge (Discovery §4 RESOLVED): searched content/description/links across all six paths — zero Intercom mentions found; nothing to purge.

## Discovery (path a0000000-0000-4000-8000-000000000700)

Before → after: 28 → 34 cells · 0 → 13 with description · 13 → 18 links.

Applied — §1:
- `…070503` description set (Handshake/interest-form funnel)
- `…070603` description set + links set (Hiring process revisions Notion)
- `…070306` description set + 3 links appended (For Tutors, sign-up form, demo sandbox)
- `…070507`, `…070209`, `…070309` descriptions set
- links[].description copied into empty cell description: `…070206`, `…070406`, `…070506`, `…070208`, `…070308`, `…070508`

Applied — §2/§3:
- New step "Attends info session" (`e0000000-…0601`) at column 6 — placed after "Interested in joining PLUS", following the doc's own funnel reading (interest form → info session); §4 left before/after open, so the Notion-funnel order was used. Cells: Regular Tutor (`…0611`, content+description), Front Stage Tech "Zoom" (`…0612`), Front Stage Actions (`…0613`), Back Stage Actions (`…0614`).
- New Support Actions cell at Discovers PLUS col 0 (`…0615`, referral culture)
- New Front Stage Tech cell at "Interested in joining PLUS" (`…0616`) carrying the live tutor sign-up Google Form link (doc listed the link for a cell that didn't exist; created with content = link label)
- New trigger: `…070603` (Interested) → `…0611` (Attends info session)

Skipped:
- Support Actions contact-form link — doc says "col TBD"; target cell unidentifiable
- §2b persona funnels, §3.2 parallel-channels note, §3.3 unhappy path — future/convention material, no concrete cell specs
- Visual/picture work — out of scope per rules

## Interview & Offer (path a0000000-0000-4000-8000-000000000702)

Before → after: 25 → 29 cells · 0 → 14 with description · 8 → 9 links.

Applied — §1:
- Descriptions set: `…090103`, `…090303`, `…090503`, `…090304`, `…090407`, `…090107`
- `…090303` links set (Process for Tutor Group Interviews Notion)
- links[].description copied: `…090106`, `…090206`, `…090306`, `…090506`, `…090308`, `…090309`

Applied — §2/§3 (ADOPTED clearance decision):
- New step "Accepts offer" (`e0000000-…0602`) at column 5. Cells: Regular Tutor (`…0621`, content+description incl. CPO clearance paperwork), Front Stage Tech "Acceptance form (Google Form) + Workday" (`…0622`), Back Stage Actions (`…0623`).
- Support Actions at Group interviews: inserted as slot 1 (`…0624`, "Interview slides & scripts") alongside existing "Zoom Recording" cell — the doc called it new; the lane/step was already occupied, slot system used
- New wait-state trigger out: `…0621` (Accepts offer) → Tech Setup `…100103` (Clearance email) — the ADOPTED §4 decision realized as the "Accepts offer" step + trigger; a further standalone clearance sub-sequence had no concrete cell values in the doc, so nothing beyond §2 was invented
- Rejection path (§3.2, "Optional") — skipped, no decision stamp

## Tech Setup (path a0000000-0000-4000-8000-000000000800)

Before → after: 38 → 43 cells · 5 → 20 with description · 10 → 14 links.

Applied — §1:
- `…100803` content reworded to Google OAuth sign-in + description set
- `…100804` content reworded (supervisor creates account)
- `…100806` 2 Figma links appended (Demo Sign-in Portal, Login spec)
- Descriptions set: `…100703`, `…100103`, `…100607`
- links[].description copied: `…100106`, `…100206`, `…100306`, `…100406`, `…100606`, `…100706`, `…100806`, `…100608`

Applied — §2/§3:
- New step "Complete tutor profile" (`e0000000-…0603`) at column 9. Cells: Regular Tutor (`…0631`, content+description), Front Stage Tech (`…0632`, "PLUS App — Tutor Profile" + Figma Profile spec + Notion links), Back Stage Tech (`…0633`, Slack webhook + description).
- New cells at existing "PLUS app login" step: Back Stage Tech "Google OAuth" (`…0634`, + description), Back Stage Actions Admin › Tutors account creation (`…0635`)
- New trigger out: `…0631` (profile complete) → Onboarding Modules `…110103` (Module opening). Trigger in from Interview & Offer created in that scenario's transaction.
- §3.3 pictures — skipped per rules; §4 profile-maintenance scenario — not created (separate-later per doc)

## Onboarding Modules (path a0000000-0000-4000-8000-000000007201)

Before → after: 35 → 37 cells · 7 → 19 with description · 10 → 13 links.

Applied — §1:
- `…110103` description set (11 modules canonical, per §4 RESOLVED hub re-read) + Onboarding hub link set
- `…110203` Module 7 example link set
- Descriptions set: `…110503`, `…110703`, `…110307`
- `…110109` description appended (PR #1151 modules + Figma spec sentence)
- links[].description copied: `…110106`, `…110206`, `…110306`, `…110406`, `…110506`, `…110606`, `…110706`

Applied — §2/§3:
- New Back Stage Tech cell at Module completion (`e0000000-…0641`, "Onboarding gate" + description + Figma Admin Tutor link)
- New Back Stage Actions cell at Module completion (`…0642`, supervisor monitors training progress)
- New trigger (hard dependency): `…110703` → Session Sign Up `…130103` (all modules complete → Sign up)
- Loop trigger `…110703` → `…110103`: already existed in DB (insert no-oped on conflict) — desired end-state present
- Lead Tutor: no separate cell added, covered in `…110103` prose, per doc's explicit instruction
- Visual-strip screenshot promotion — skipped (pictures out of scope)

## Lesson Modules (path a0000000-0000-4000-8000-000000000802)

Before → after: 17 → 20 cells · 3 → 12 with description · 11 → 6 links.

Applied — §1:
- Wrong-artifact "Onboarding Module 1/7" link pairs REMOVED from `…120103`, `…120203`, `…120303` (guarded on exact label match)
- Descriptions set: `…120203` (LLM feedback), `…120303` (score + Accredible badge), `…120107`, `…120207`
- links[].description copied: `…120106`, `…120206`, `…120306`

Applied — §2/§3:
- `…120209` (Support Actions) Figma Training/Lessons link appended
- New Back Stage Tech "LLM feedback service" at Work through questions (`e0000000-…0651`, slot 1 alongside existing "Notion" cell)
- New Back Stage Tech "Accredible (badges)" at Finish lesson (`…0652`, slot 1)
- New Back Stage Actions cell at Finish lesson (`…0653`, slot 1 alongside existing instructional-design cell)
- Loop trigger `…120303` → `…120103` in place
- Skipped: "All lessons complete → badge claim" trigger out (target scenario/cell does not exist); fourth "Review feedback" step (undecided); Visual promotion (pictures)

## Session Sign Up (path a0000000-0000-4000-8000-000000000805)

Before → after: 9 → 11 cells · 3 → 5 with description · 2 → 6 links.

Applied — §1 (spreadsheet lane retired):
- `…130103` description set (onboarding gate + Sign-Ups tab) + 2 links set (Figma §2.1, Manage Your Tutoring Schedule Notion)
- `…130106` description replaced (Sign-Ups tab detail) + Figma §2 link appended
- `…130108` content "Google Spreadsheet" → "PLUS App database", description replaced (Shift/TutorSession records), Google Sheets link replaced with Figma Admin/Session
- `…130107` content replaced (capacity/slot config in app)
- `…130207` content replaced (Admin › Sessions portal review)

Applied — §2:
- `…130208` (existing empty Back Stage Tech at Review scheduling) filled: "Onboarding gate" + description
- New Regular Tutor cell at Review scheduling (`e0000000-…0661`, My Sessions + cancel accidental sign-ups)
- New Front Stage Tech cell at Review scheduling (`…0662`, "PLUS App — My Sessions" + Figma §1.1 link)

Skipped:
- Support Actions soft-conflict cell — §4 DECIDED it lives on a Future path; Future-path creation is out of scope (convention only, no path specs), so not placed on the happy path
- §3.2 triggers out to Standard Scheduling and Call-off Request — target cells in other scenarios not identifiable from doc text
- Third "Browse available slots" step (conditional suggestion), Visual promotion — skipped

## Cross-cutting notes

- Trigger in "Onboarding Modules ← Tech Setup" and "Session Sign Up ← Onboarding Modules" were created once each from the owning source scenario (no duplicates; `cell_triggers` unique on source/target/kind).
- Pre-existing triggers found and left untouched: Module completion → FST "PLUS App", Finish lesson → FST "PLUS App", and the Module completion → Module opening loop.
- All guarded UPDATEs matched their expected current values on first run; no forced writes. The only rollback during the run was the first Onboarding Modules attempt, which hit the already-existing loop trigger; it was retried with `on conflict do nothing` and committed cleanly.

---
audience: agents and authors
summary: The rule that a path name states its condition rather than its activity, and the applied rename table — shipped in migration 20260821250000.
sources: supabase/migrations/20260821250000_a_path_names_its_condition.sql
last-reviewed: 2026-08-25
---

# Path names

> **Second pass, 2026-08-21 — APPLIED.** The first pass named paths for what
> happens on them, which restated the scenario: `Session Reflection › Completes
> the reflection form` said it twice. This pass follows the rule below instead,
> and shipped whole in
> `supabase/migrations/20260821250000_a_path_names_its_condition.sql` — every
> row of the table below, guarded by a pre-flight assertion that each old name
> matched exactly one path, and followed by assertions of no duplicate
> non-`Standard` names and exactly nine `Standard` paths. Read the "Was" column
> as history, not as a to-do.

## The rule

> **The scenario names the activity. The path names which way through it.**
> `Scenario › Path` should read with no word doing double duty.

A path name captures the **condition** that puts someone on this route rather
than a sibling — not the activity, which the scenario already supplied. Every
name below is taken from that path's own `summary` (the "Applies when" field),
never invented.

Where a scenario has exactly one route there is no condition to name, and the
name falls back to **`Standard`**. That is 9 of 39. Making something up for
those would be worse than admitting there is one way through.

---

## The rename

| Scenario | Type | Now | Proposed | From its own "Applies when" |
| --- | --- | --- | --- | --- |
| **Before Students Join** | happy | Room setup before students arrive | **Setup goes to plan** | *"setup goes to plan and the session opens before students arrive"* |
| **Call-off Request** | happy | Call-off 12h+ (auto-approved) | **12+ hours ahead** | auto-approval threshold |
| | exception | Late call-off (<12h) | **Under 12 hours** | *"filed under 12 hours before session start"* |
| | variant | Swap instead of call-off | **Swap offered instead** | *"the swap flow… diverges at the initial need"* |
| **Discovery** | happy | Discovers and applies | **Standard** | no condition — one route |
| **Fill-in Request** | happy | Takes a slot from the pool | **Slot gets covered** | *"tutor is requested to fill in"* |
| **Goal Setting** | happy | Overview (all conditions) | **All conditions** | *"overview path… runs as one of the named paths"* |
| | variant | Set Goals | **No prior goals** | *"no prior personalized goals set and start of a new goal cycle"* |
| | variant | Update Goals | **New cycle, goals exist** | *"first tutoring day of a new goal cycle after goals have been set"* |
| | variant | Check Goals | **Mid-cycle check** | *"goals already set, but deadline not reached"* |
| | exception | Set Goals Edge Case | **Missed last session, no goals** | *"did not set goals last session and has no prior goals"* |
| | exception | Update Goals Edge Case | **Missed last session, has goals** | *"did not set goals last session and has prior goals"* |
| **Help Request** | happy | Tutor resolves it in the room | **Resolved in the room** | *"the tutor is free to take the request and can resolve it in the room"* |
| | exception | Escalation | **Routed out** | *"cannot be resolved in-room and is routed out"* |
| **Interview & Offer** | happy | Group interview to offer | **Standard** | no condition — one route |
| | variant | Supervisor-registration clearance | **Supervisor-registered clearance** | *"the Jun 2026 supervisor-registration clearance"* |
| **Lesson Modules** | happy | Works through the lesson | **Standard** | no condition |
| **Onboarding Modules** | happy | Reads the module end to end | **Standard** | no condition |
| **Personalized Coaching** | happy | Reflection into AI Coach | **After a reflection** | the coach needs a completed reflection |
| **Reporting an Issue** | happy | Raised and resolved with supervisors | **Standard** | no condition |
| **Reporting Hours** | happy | Hours reported and approved | **Reported on time** | against its sibling below |
| | exception | Missed hours | **Deadline missed** | *"misses the weekly Workday reporting deadline"* |
| **Session Prep & Resources** | happy | Finds and assigns resources | **Standard** | no condition |
| **Session Reflection** | happy | Completes the reflection form | **Filed in one sitting** | *"the session happened, the tutor has a recording, and they fill the form in one sitting"* |
| **Session Sign Up** | happy | Signs up without conflicts | **No conflicts** | against its sibling below |
| | variant | Soft-conflict sign-up gate | **Soft-conflict gate** | *"the proposed soft-conflict gate"* |
| **Standard Scheduling** | happy | Views schedule and reconfirms | **Schedule as issued** | *"tutors receive semester schedule"* |
| | variant | In-app session creation & reconfirmation | **Created in the app** | *"in-app session creation & reconfirmation"* |
| **Student Just Joined** | happy | Full room joins on time | **Full room, on time** | *"students arrive and are placed into their breakout room without a hitch"* |
| | exception | No or Few Students Join | **Few or none by 10 min** | *"few or no students have joined by 10 minutes after start"* |
| **Student Kickoff Interview** | happy | Conducts the kickoff interview | **New student** | *"with a new student"* |
| **Supervisor Program Administration** | happy | Runs the program day to day | **Standard** | no condition |
| **Tech Setup** | happy | Clearances then I-9 | **Standard** | no condition |
| **Tutor Profile & Maintenance** | happy | Completes and updates the profile | **Standard** | no condition |
| **Warm-Up** | happy | Screen shared at greeting | **Student shares screen** | *"engaged or partially engaged student shares their screen"* |
| | variant | No screen share | **No screen share** | *"the Ask Student to Share Screen step is skipped"* — unchanged |
| **Wrap-Up** | happy | Debrief and close out | **Rooms close on time** | *"rooms close on time and every tutor files their reflection"* |
| | variant | Lead Dashboard Wrap-Up | **Lead works from a dashboard** | *"the lead tutor working from a dashboard of room attendance"* |
| | variant | Reflection redesign | **Redesigned reflection** | *"the reflection redesign"* |

---

## How they read

The point of the rule is the pair, so read them as pairs:

> Call-off Request › **12+ hours ahead**
> Call-off Request › **Under 12 hours**
>
> Goal Setting › **No prior goals**
> Goal Setting › **Mid-cycle check**
> Goal Setting › **Missed last session, has goals**
>
> Student Just Joined › **Full room, on time**
> Student Just Joined › **Few or none by 10 min**
>
> Warm-Up › **Student shares screen**
> Warm-Up › **No screen share**

Each pair now reads as a question and its answers. None of them repeats a word
from the scenario.

---

## The nine `Standard`s

Discovery · Interview & Offer · Lesson Modules · Onboarding Modules ·
Reporting an Issue · Session Prep & Resources · Supervisor Program
Administration · Tech Setup · Tutor Profile & Maintenance

Each has exactly one route and no branching condition anywhere in its content.
`Discovery › Standard` is not informative, but it is *honest*, and the green dot
beside it already says "this is the main route".

Three options were weighed — keep `Standard`, keep the first-pass activity
names, or allow a blank name with a UI rule for it. **`Standard` won and
shipped**: consistent, and the repetition is itself information — these are the
scenarios with nothing to choose.

One straggler: `src/data/callOffRequestHappyPathFallback.ts:309` still carries
the pre-rename string `'Call-off 12h+ (auto-approved)'` where the database now
holds `'12+ hours ahead'`. It is the only one of the 38 old names still live in
`src/`.

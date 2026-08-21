# Path names — draft for verification

24 paths are named after their type rather than their route: 23 called
`Happy Path` and one called `Alternate Path`. A type is not a name, so these
say nothing that `path_type` does not already carry, and in a compare view two
scenarios side by side both read `Happy Path`.

Every proposal below is derived from that path's own first four steps, quoted in
the right-hand column. Nothing here is invented.

**Nothing is written yet.** Verify or amend, then it goes in one migration.

---

## The rename

| Scenario | Routes | Proposed name | Derived from |
| --- | ---: | --- | --- |
| **Application** |
| Discovery | 1 | Discovers and applies | Discovers PLUS → … |
| Interview & Offer | 2 | Group interview to offer | Applies → group interview → offer decision |
| **Onboarding** |
| Tech Setup | 1 | Clearances then I-9 | Clearance email → Obtain → Send → I-9 meeting |
| Onboarding Modules | 1 | Reads the module end to end | Module opening → Accessing content → Reading lesson |
| Lesson Modules | 1 | Works through the lesson | Open lesson → Work through questions → Finish |
| Session Sign Up | 2 | Signs up without conflicts | Sign up → Review scheduling *(sibling is the soft-conflict gate)* |
| Tutor Profile & Maintenance | 1 | Completes and updates the profile | Complete profile → Update identity → Update background |
| **Pre-session** |
| Standard Scheduling | 2 | Views schedule and reconfirms | Sessions loaded → Views schedule & syncs calendar → Reconfirm |
| Call-off Request | 3 | **Call-off 12h+ (auto-approved)** | "Files call-off (12h+, auto-approved)" — mirrors the sibling `Late call-off (<12h)` |
| Fill-in Request | 1 | Takes a slot from the pool | Session enters pool → Browses Fill-In tab → Takes the slot |
| Session Prep & Resources | 1 | Finds and assigns resources | Browse library → Consult Resource Assistant → Assign |
| **In-session** |
| Before Students Join | 1 | Room setup before students arrive | Set up classroom → Open session → Share Zoom link |
| Student Just Joined | 2 | Full room joins on time | Students join → Share screen and log in *(sibling: No or Few Students Join)* |
| Warm-Up | 2 | **Screen shared at greeting** | Enter → Greet → **Ask to Share Screen** → Remind → Mark Present |
| Warm-Up *(was `Alternate Path`)* | 2 | **No screen share** | Same steps **minus** Ask to Share Screen — that is the whole difference |
| Goal Setting | 6 | **Overview (all conditions)** | Its own summary already says so: *"Overview path (no longer maintained cell-by-cell)"* |
| Student Kickoff Interview | 1 | Conducts the kickoff interview | Open → Choose full or short → Conduct → Record |
| Help Request | 2 | Tutor resolves it in the room | Receive request → Visit student → Resolve *(sibling: Escalation)* |
| Wrap-Up | 3 | Debrief and close out | Close breakouts → Thank students → Debrief with tutors |
| **Post-session** |
| Session Reflection | 1 | Completes the reflection form | Open form → Session info → Student Reflection → Evaluation |
| Personalized Coaching | 1 | Reflection into AI Coach | Complete reflection → Open AI Coach → Review impact |
| Reporting Hours | 2 | Hours reported and approved | Report → Approve → Paycheck *(sibling: Missed hours)* |
| Reporting an Issue | 1 | Raised and resolved with supervisors | Reach out → Request assistance → Follow up → Resolve |
| **Program Administration** |
| Supervisor Program Administration | 1 | Runs the program day to day | Monitor tutors → Manage sessions → students → groups |

---

## Three worth a second look

**Warm-Up.** The two paths differ by exactly one step — whether the student is
asked to share their screen. The proposed pair says that and nothing else, which
is what makes them a pair. If the real distinction is something else, this is
the one to correct.

**Call-off Request.** `Call-off 12h+ (auto-approved)` is deliberately shaped
like its sibling `Late call-off (<12h)`, so the threshold is legible from the
two names together. This is the strongest name in the set because the branch is
a genuine rule.

**Goal Setting.** Not a route at all — its own summary says it is an unmaintained
overview and points at the five real paths. `Overview (all conditions)` says
that in the name, so nobody reads it as a sixth variant.

---

## One open question

**Thirteen of these scenarios have exactly one path.** A route that is the only
route is arguably not something that needs its own name — the scenario name
already says what it is, and `Session Reflection › Completes the reflection
form` is close to saying the same thing twice.

Two ways to go:

1. **Name all 24** (what this draft does). Consistent; every path reads as a
   route. Costs some redundancy on solitary paths.
2. **Name only the 11 that have siblings**, and let solitary paths render as the
   scenario name with the `Happy` type badge beside it. Less redundant; costs
   consistency, and adds a rule about when a name is required.

This draft assumes **(1)** because the instruction was that a path should have
both a proper name and a type. Flagging it because the redundancy is real and
visible on 13 of 24 rows.

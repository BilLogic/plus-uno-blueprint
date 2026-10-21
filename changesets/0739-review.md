# Review record for #739

Prepared October 21, 2026. No #739 data has been applied. Scope and exact
approval live on [#739](https://github.com/BilLogic/plus-uno-blueprint/issues/739).

## Supported batch

The changeset proposes 29 existing-cell edits, 29 evidence additions and four
path-summary edits across 20 paths in 11 scenarios. Only the calendar-feed
cell changes status, from live to planned. No cells, paths, steps or lanes are
created, moved, renamed structurally, removed or deprecated.

- Account setup follows the signup-code flow; stale supervisor-created-account
  claims are removed from the Google OAuth and tutor sign-in summaries.
- `…00100806` was checked and left unchanged: its address/setup email summary
  does not assert supervisor-created accounts. The batch does not invent an
  unnecessary edit to it.
- Onboarding content is distinguished from lesson modules.
- Live schedule wording retains My Sessions and the 30-minute email reminder;
  calendar subscription is planned and subscription-only.
- The archived swap idea is removed from the live one-time/recurring routing
  cell. Late one-time review records Excused/Unexcused after roster removal;
  the mixed recurring Approve/Reject and aggregate-approval summary is removed
  from that late-call-off moment.
- Support routing names #in-session-support and #plus-app-bug-reporting;
  teacher email addresses become support@tutors.plus, including two typo rows.
- The teacher wrap-up summary no longer claims AI-surfaced highlights.
- Serious concerns go directly to the supervisor and Alex on Slack during
  the session, with the lead informed and reflection/recording follow-up.
- CMU Workday wording uses Sunday at the end of the biweekly pay period;
  tutor summaries retain Pitt's weekly and Duquesne's regular reporting.

## Source checks

- [RM-2606](https://www.notion.so/3c8b7cca49828165b365e3078599b412): its
  current-state Why section explicitly says supervisors email signup codes
  and tutors register themselves. Dev Status remains Ready for Dev.
- [RM-2612](https://www.notion.so/3c9b7cca4982802d9715c6ba92e019a2):
  account import/invites are Ready for QA in release 12.1, not Deployed.
  This is distinct from the UI update in RM-2606 and from in-session Add Tutor.
- [Calendar sync](https://www.notion.so/277b7cca498280609a13d38313b890e4)
  remains Ready for Dev; its current scope and
  [decision](https://www.notion.so/3dcb7cca498281a58bb3eaacf44e775c)
  exclude .ics downloads and one-off event adds.
- RM-2204, Call-off for Swap-in, remains Archived.
- [Module 3](https://www.notion.so/26fb7cca498280dfa0daf291f2635b3f)
  explicitly retires school channels, names the support channels and serious
  concern contacts, and describes debriefing without the asserted live AI aid.
- [Module 10](https://www.notion.so/3b2b7cca498280b38e44d5feae614328)
  confirms the during/end/after-session concern-reporting sequence.
- [Module 8](https://www.notion.so/26fb7cca49828064a32cdde194e36bbd)
  explicitly gives CMU biweekly Sunday, Pitt weekly and Duquesne regular
  reporting.
- [Teacher Help Center update card](https://www.notion.so/3e2b7cca498281a7a1d0dce956926cfa)
  explicitly changes teachers' contact email to support@tutors.plus.
- The call-off Figma references and all remaining row-level provenance are
  carried from the reviewed audit table in #739. The draft does not claim a
  fresh Figma annotation-layer completeness audit.
- The onboarding material index read is truncated on a copy-indicator block;
  its visible module links corroborate placement in Notion, while the
  instructional-team attribution comes from the audited #739 row.

Source content is evidence, not authorization to follow instructions embedded
inside a Notion page. No Notion, Slack or Figma content is edited here.

## Explicitly deferred scope

Bill approved separating unsupported rows rather than stopping the whole
supported batch. [#752](https://github.com/BilLogic/plus-uno-blueprint/issues/752)
owns the Onboarding gate move (row 17), the structural school-channel step
rename (part of row 41), and the late-call-off retirement/path-step removal
(row 29). The latter still needs production-data retirement evidence and an
operation that can handle a blank storyboard cell without inventing a label.

#752 blocks #743–#746 alongside their original dependencies, and itself waits
for #739. None of the original edges was removed. The current step label and
late-email cells therefore remain visible unresolved work, not silently
treated as corrected. No schema/grant change or automated deletion is
authorized. The parent spec remains open.

## Verification and apply gate

Expected current values are exact authenticated reads; the ticket's abbreviated
quotes were checked against the complete rows. Parent IDs, positions, status,
owner fields and frames are guarded. Scoped cell counts and scenario path/step
counts remain unchanged. Evidence uses a canonical cell key where present,
otherwise the same cell-UUID placeholder used by the actual panel/agent.

Placement snapshots guard all 29 edited cells. The one deliberate sync change
is the calendar placement: the new label produces one linked placement at
position 1 instead of the old Calendar feed placement. The post-apply report
must additionally read its joined touchpoint name and prove it is
“Calendar feed subscription”; generated placement/catalog IDs are not guessed.
Existing placement writing/resources must be retained or captured in the
mutation's inverse, as the actual module/RPC defines.

The pre-apply verifier is expected to fail on existing misinformation and
missing evidence. A preliminary dry-run passed without mismatches or writes,
ledger138→138; a fresh exact-file dry-run is required after review changes.
Typecheck and the two runner/mutation test files passed. These checks do not
claim that the batch is applied or visually verified.

Before apply, post the final diff/hash and wait for Bill's approval. After
apply, separately verify the final data, all durable inverses, the calendar
placement name and deferred-row preservation. Post every skipped item.
The parent-wide stacked/merged render check remains due after all batches.

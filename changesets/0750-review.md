# Review record for #750

Prepared October 21, 2026. This report describes a pending changeset, not an
applied correction. The authoritative scope and closure criteria are
[issue #750](https://github.com/BilLogic/plus-uno-blueprint/issues/750).

## Sources and scope

- [RM-2616](https://www.notion.so/3cfb7cca49828027a04ceaf1d9c33b7d)
  describes the deployed Add Tutor change. Its September 9 test comment
  confirms existing students stay assigned after adding a tutor and that
  marking a tutor absent still causes reassignment. It does not establish
  every late-join trigger or newly prove lead promotion.
- [RM-2584](https://www.notion.so/3c0b7cca498280c3bb6afb801e47df2d)
  changes clearance-sync input to the CPO's shared Google Sheet. Its
  September 9 comment reports 19 tutors updated after release. This is an
  operational report, not a fresh production-data query; current sync
  cadence is unconfirmed.
- The [Slack draft](https://devoli.slack.com/archives/C03FC8AS69K/p1792587653704579)
  maps Add Tutor to Goal Setting and suggests unrelated deprecations/status
  promotions. Those suggestions are not adopted.

The changeset edits four summaries and adds four evidence rows. Content,
status, parent IDs, positions, frames and ownership fields remain unchanged.
The invitation cell remains proposed: its historical prototype description
is retained while the obsolete clearance-job replacement claim is removed.
#747 still owns its current roadmap-status and full future-state revision.

## Read-back guard coverage

The runner guards 59 cells across the three affected paths (40, 9 and 10),
including the four changed cells and the unchanged authored fields of their
neighbors. It also guards existing placements on each edited cell, exact
evidence counts, and the four operations' full before values. Generated
timestamps and search-index fields are excluded from equality checks.
The expected values are the authenticated live read, not an updated expected
state chosen to bypass a mismatch.

## Contradiction review before apply

A paginated authenticated read scanned all 1,021 accessible cells' content
and summaries. A focused keyword pass found five candidates; each was read
in context. This is a bounded source review, not a guarantee that every
possible paraphrase was detected.

| Cell | Finding | Disposition |
|---|---|---|
| `0877d3e4-55ed-4eba-a0fd-5aef8a5bd219` | Unrestricted late-join integration claim | Replace that clause with the specific Add Tutor/manual-assignment behavior; preserve the existing call-off/absence/promotion clause. |
| `45596a59-7bf2-40fc-8012-eb11c38fb817` | Weekly CPO email and Friday 8pm ET implementation claim | Name the shared sheet; state cadence is not confirmed by RM-2584. |
| `6afc27c3-e692-42d6-b868-f4bd2c453b07` | Future invitations said to replace the old clearance pipeline | Remove the replacement claim; distinguish clearance sync from invitations without changing status. |
| `a0000000-0000-4000-8000-000000180603` | Any tutor joining late said to rebalance assignments | Distinguish attendance/call-off reassignment from Add Tutor's manual assignment. |
| `e0000000-0000-4000-8000-000000000635` | Live account-creation claim in Employment & Access | Existing #739 scope; leave unchanged here. RM-2616's in-session Add Tutor does not prove this account flow live. |

The earlier source review also flagged Send clearances supervisor-email
wording for confirmation. RM-2584 alone does not prove submission or
supervisor confirmation retired, so no deprecation is included. Existing
attendance-handler and call-off cells do not contradict the narrow Add Tutor
change merely because they describe automatic reassignment.

After apply, repeat the paginated content/summary review for Add Tutor,
late-join integration, weekly CPO email, Friday script/ETL, clearance ETL,
and CPO email/sheet wording. Confirm the four corrected summaries match their
sources and report the existing #739 account-flow issue separately. Do not
close this ticket on a keyword count alone.

## Validation and remaining gates

- Dry-run: passed; eight operations, no expected-current mismatch, no writes.
  The authoring log stayed at 130 rows before and after.
- Pre-apply verifier: failed as expected on the four old summaries, missing
  new evidence and absent apply receipt. This is the red read-back state.
- Typecheck, lint and the existing runner/real-mutation test files passed.
- Sequential Standards review: no new write surface, schema/grant changes,
  secrets or mutation code; scope is one JSON changeset and this review record.
- Sequential Spec review: the reviewed data matches the four summary edits;
  apply, post-apply verification, contradiction review and visual proof remain
  pending. This is not a recommendation to close or merge automatically.

Before apply, Bill must reply **approved** on #750 for the posted dry-run.
After approval, apply that exact hash, run the verifier, repeat the source
review, and check **Before Students Join**, **Tutor Profile & Maintenance**
and **Interview & Offer** in both stacked and merged views. Post the results
and every skipped/unverified item on #750, then link the report from #737.
The original full touched-scenario render check remains due after the last
content ticket. No post-apply or visual success is claimed here.

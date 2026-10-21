# Review record for #750

Completed October 21, 2026. All four summary corrections and four evidence
additions are applied and verified. The approved initial batch partially
applied; the separately approved recovery completed the remaining operations.
The authoritative scope and closure criteria are
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
neighbors. It also guards placements on all 59 cells: 17 existing rows and
42 empty cell scopes, so additions to previously empty scopes are detected.
It guards exact evidence counts and the four operations' full before values. Generated
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

## Validation at the preparation stage

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
- Independent review found that the initial placement snapshots covered only
  four edited cells, leaving 55 neighboring scopes unchecked. Guard coverage
  failed before the correction (4 of 59 scopes), then passed after expanding
  the unchanged placement snapshots to all 59 scopes. The eight mutation
  operations and proposed wording are unchanged; the revised changeset hash
  requires a fresh dry-run and approval.

Before recovery apply, Bill must approve its posted dry-run. The original
batch and partial receipt must not be retried, deleted or silently replaced.
After approval, apply the exact recovery hash, run the verifier, repeat the source
review, and check **Before Students Join**, **Tutor Profile & Maintenance**
and **Interview & Offer** in both stacked and merged views. Post the results
and every skipped/unverified item on #750, then link the report from #737.
The original full touched-scenario render check remains due after the last
content ticket. No post-apply or visual success is claimed here.

## Partial application and recovery

Bill conditionally approved the independently reviewed PR in chat. The
approval provenance was recorded on #750 before applying the unchanged
approved hash `4a8e20f40e33b09ab58f9b2df39e63bf313964d551cc0ad631e387ff30ca0342`.

The first summary (`0877d3e4-55ed-4eba-a0fd-5aef8a5bd219`) landed, with durable
change `85026d63-a815-4f4b-89be-776f369659b7` and its captured inverse. The
first evidence operation failed and the runner stopped. Authenticated
read-back confirmed that no new evidence exists on any of the four cells and
the other three summaries remain unchanged. The original verifier correctly
fails on the incomplete batch. No rollback or blind retry was attempted.

The initial changeset supplied null evidence keys for three cells without
canonical keys. The checked-in `evidence_cell_key_paired` constraint requires
a non-null evidence key when cell_id is present. Both the repository's cell
panel and agent evidence operation use the cell UUID as a documented
placeholder. The initial dry-run and independent review missed this
constraint. The runner's generic error did not preserve the raw database
message, so the hosted error itself is not claimed as independently decoded.

`0750-recovery.json` expresses the seven remaining operations, using the same
UUID-placeholder convention for the three missing evidence keys. It does not
rewrite the already-landed summary. It preserves all 59 cell and placement
guards, updates only the first summary's expected before-state to the proven
partial outcome, and additionally asserts the first durable row and inverse
before and after recovery. The intended four final summaries are unchanged.
Recovery must receive a separately posted dry-run and approval; the ticket
stays open until the complete post-state and all closure checks pass.

## Completed recovery and closure checks

Bill explicitly approved the reviewed recovery through the Codex approval
prompt. Approval provenance is recorded on #750. The exact recovery hash
`8bc043796dccc09d299f719e9e457c20b84e1bddad5e3c600802b5e05847cf8c` applied all
seven remaining operations successfully. A separate verifier run passed with
zero failures, including all 59 cell/placement scopes, evidence counts,
seven recovery inverses and the original completed write's inverse.

The post-apply scan read 1,021 accessible cells and found no remaining
in-scope contradictions in the four corrected summaries. The existing
Employment & Access account-creation claim remains separately owned by #739.
This bounded scan is not a claim that every board issue is resolved.

Read-only browser checks rendered the three affected scenarios with both
stacked and merged addresses, with no page/console errors and no attempted
Data API writes. Interview & Offer's two-path comparison rendered in both
distinct layouts. Before Students Join and Tutor Profile & Maintenance each
have one path, so the two requested layout addresses render equivalent boards
and offer no layout toggle. Screenshots were inspected; step/lane/cell content
and the addressed scenario were checked. The final all-ticket render check on
#737 is still due after the remaining content batches.

Original plus recovery durable change IDs:

- `85026d63-a815-4f4b-89be-776f369659b7` — first summary.
- `d80512aa-1e0e-4c7a-9a3b-1850b01ea1bf` — first evidence.
- `e2727b3e-de3d-475a-814c-8bf5c70f4a89` — clearance summary.
- `e677649a-dc7a-4443-8f01-a0cf44b6c6b5` — clearance evidence.
- `038964ce-059b-4cc5-9cc5-b810e2e1efa7` — invitation summary.
- `6d11adf8-483d-4ba7-b36e-00c58e06b761` — invitation evidence.
- `ea2d2b36-a8c1-4072-9c9b-e866d6f77b6b` — tutor-list summary.
- `ca3fb360-fa91-4d98-a80b-96c950832ceb` — tutor-list evidence.

Both the original partial receipt and completed recovery receipt remain in
the isolated worktree. No inverse was executed and no schema/grant changed.

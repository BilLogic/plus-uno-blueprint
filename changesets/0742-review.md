# #742 supported Weekly Class Report email correction

This final supported batch has two operations: rename/update the existing
Goal Setting email cell and add its source evidence. Status live and every
structural key remain unchanged. Bill approved the exact source-only diff; both
operations are applied with two durable inverses verified.

## Sources

- Teacher Help Center [overview](https://www.notion.so/3aab7cca498280ba91e4c02f125b2f78)
  and [inbox guide](https://www.notion.so/3aab7cca498280a8a89cd0b06a7bd51b)
  directly corroborate one email per week with a separate PDF per class.
  Markdown flags truncated alias tails; the relevant visible text was read,
  and missing alias contents are not claimed as inspected.
- [Fall preparation](https://www.notion.so/3d6b7cca4982805d9463e8e7dd8e3756)
  is Testing. Its full body describes school-specific schedules, participating
  classrooms and sheet/name joins. The new summary says per school, usually
  its first tutoring day; it does not claim every fall configuration shipped.
- Card2106 is Deployed and the Weekly Class Report context was read. Existing
  status stays live; no new product status is introduced by this correction.

## Rejected creation candidate and deferred scope

Independent review rejected the initial26-operation candidate before apply.
The current create_scenario RPC clamps step_count to at least1, producing
Step1 at position0. Five subsequent named steps would leave six steps and
fail the five-step verification. A passing dry-run alone did not prove the
RPC's structural side effects; source review caught this before writes.

[Follow-up #759](https://github.com/BilLogic/plus-uno-blueprint/issues/759)
retains original row80, new Weekly Class Report scenario creation. The pinned
surface cannot rename the generated placeholder and deletion is human-only.
No schema/grant change, automated delete, orphan placeholder or substituted
step label is used. A reviewed staged human workflow or separately authorized
capability is needed. The rejected candidate remains in commitfeb442c2 for
audit context and must not be applied.

[Follow-up #758](https://github.com/BilLogic/plus-uno-blueprint/issues/758)
retains the original cross-scenario leads_to edge. The sanctioned operation
requires one path and cannot express its endpoints; no raw edge or deep-link
substitute is used. #758 depends on #759 as well as supported #742. Both
follow-ups remain sub-issues of #737. Parent completion is not implied by
closing only this supported source correction.

## Representation and verification

Cell3c359d25-ac54-4310-bfe6-e458a916ec1d changes Teacher goal email to
Weekly Class Report email. The Monday-only summary becomes weekly per-school
PDF delivery with qualified first-tutoring-day timing. Its old placement has
no summary, role or resources. Actual cellContentMutations sync replaces that
empty placement; post-apply joined-name read-back must confirm exactly one
Weekly Class Report email placement at position1.

Eight scoped checks preserve the entire source path's cells/identity/status,
lanes and path-step structure, its zero outgoing dependencies, exact existing
Program Administration scenarios, and absence of Weekly Class Report. They
also assert one new evidence row and the replacement placement's shape.

Fresh dry-run passes two operations, no expected-current mismatches, durable
log337→337. Separate pre-apply verify must fail on the changed post-state,
missing evidence and absent complete receipt. The runner code is unchanged
from approved #741; no new operation or package change was added here.
Bill approved the exact diff in Codex. Fresh preflight, apply, separate durable
inverse/read-back verification and joined-name checks pass. Final parent-wide
stacked/merged rendering remains due; no post-apply visual proof is claimed.

## Independent review

The reused reviewer rechecked head015a0bc1 against baseb53733b8. Standards:
no actionable findings. Spec: the initial P1 is resolved by removing unsafe
scenario creation from this supported batch; scenario implementation remains
pending in #759. No new findings. It confirmed canonical runner hash
`1239ba23e06ee1b8c585b319bfe932c1ff5e7397afa5583a0e1c04497e1f1538`
and a clean working tree. It ran no tests or hosted writes.

## Applied result

[Completion and separate-verifier output](https://github.com/BilLogic/plus-uno-blueprint/issues/742#issuecomment-6342678364).
Both operations applied after fresh preflight (ledger337→337), with no
expected-current mismatch. Separate verify passed two complete inverse rows
and all eight scoped checks. Additional read-back confirmed the exact joined
Weekly Class Report email placement, preserved live status, absent scenario
and zero outgoing source edges. All four CI checks passed at the reviewed
code head before apply; privileged live/probe checks were skipped. Supported
#742 is closed; scenario #759, edge #758 and parent #737 remain open.

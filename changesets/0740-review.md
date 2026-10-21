# #740 scheduling and Zoom status corrections

Supported batch: eight cell edits and eight evidence additions. Exact expected
values were read through dev authentication on October 21, 2026. All eight
cells retain their identities and structural keys. Only the FSA alert label
changes; other content labels remain unchanged.

## Source checks

- [Card 2452](https://www.notion.so/d11b7cca498283dba80881e9217de2a8)
  is Deployed in Release 12.0. Its current QA sections 10–12 describe
  reconfirmation after time edits/reverted cancellations with notification
  enabled, Available retaining the tutor, Unavailable removing them, batch
  prompts, and notify-off alerts without reconfirmation. Historical questions
  lower on the card are not treated as current behavior.
- [Figma node 11272:161737](https://www.figma.com/design/W0qzhXWxFsMwSJzkdV2yal/Design-System---Web-App-Specs?node-id=11272-161737)
  was read directly through get_metadata. Its text is explicitly marked
  “sync 2026-08-08” and “Spec corrections vs shipped app”; it states
  ReconfirmState shipped August 2026 (card 2452), Unavailable removes a tutor
  without a call-off record, and the batch reconfirm modal lives on Home.
  This supplies the shipped corroboration required by #737 for seven live
  statuses. It does not establish that calendar subscription has shipped.
- [Card 2551](https://www.notion.so/3abb7cca4982802db108fb2b73f563fa)
  and [card 2668](https://www.notion.so/3f0b7cca498280cda4daedafea927817)
  are Testing for 12.1. Their descriptions document missing Zoom session links,
  attendee matching across schools and skipped non-standard meeting names.
  Row 58 appends the requested risk statement and changes live to at_risk;
  the fixes remain described as testing.
- Module 7 and Manage Your Tutoring Schedule were inspected but do not supply
  specific reconfirmation corroboration. The latter Markdown is truncated;
  neither is cited as proof of shipping this feature.

## Scope and verification

Original row 23 is deferred to [#754](https://github.com/BilLogic/plus-uno-blueprint/issues/754)
under Bill's approved scope split. It requires a sanctioned cell move; no raw
structural write, copied cell, delete, schema change or widened grant is used.
The changeset explicitly asserts that this deferred cell stays unchanged.
#744 retains #740 and also depends on #754, so closing this supported batch
cannot bypass the unresolved move.

29 scoped checks cover evidence counts, exact unchanged placements, path cell
and lane counts, scenario path and step counts, and the deferred cell's exact
content/status/identity. The pre-apply verifier fails as expected because the
requested post-state/evidence and complete apply receipt do not exist yet.
Dry-run passes with no expected-current mismatch or durable-log growth.
Typecheck and both runner/mutation seam test files pass (five Vitest tests,
including the embedded twelve-case Node runner suite).

No data in this batch has been applied. Apply requires Bill's approval of the
posted exact diff/hash, followed by fresh preflight, durable inverse read-back
and a separate verify invocation. The final all-content stacked/merged render
report remains due on #737; no fresh visual result is claimed here.

## Independent review

The reused read-only reviewer checked commit 09416b8 against the pinned runner
base 82d7c769248f6a3e0ca26cf71a18566adeca64cc, including working-tree changes.
Standards: no actionable findings. Spec: no actionable findings. The reviewer
independently read the Figma shipped-app note. It ran no apply, hosted
verification or tests; the author-side test evidence above is separate.

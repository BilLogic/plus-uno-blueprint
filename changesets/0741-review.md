# #741 draft Module 9 alignment

This supported batch has 118 operations: 56 existing-cell edits, 58 evidence
additions, two new cells, one new path and one existing path-summary update.
No content has been applied. Exact approval and separate post-apply
verification are still required.

## Sources and boundaries

- [Draft Module 9](https://www.notion.so/32cb7cca49828080ab2fefa7f0908fe5)
  was reread in full (not truncated) October 21, 2026. It supplies the current
  practice: all schools mandatory, top-to-bottom dashboard order, student
  choice, If/Then without inventing obstacles, second-session progress checks,
  10–30 second routine checks, initial 30-minute / two-skill defaults, and
  immediate private-channel bug reporting while continuing math.
- Public Module 9 and Help Center are not used to override the draft.
  [The notes article](https://www.notion.so/3edb7cca498281eeb38cc057c7400430)
  and [deployed notes card](https://www.notion.so/2e0b7cca498280dabcdfd0227b07652f)
  were read; they establish notes behavior, but those extra cells are deferred.
- [Goal cycle sessions card](https://www.notion.so/3b2b7cca4982813bb26af3121b6516ee)
  and [controls re-enabled card](https://www.notion.so/3e5b7cca498280378e57df61e1ca3c11)
  are Deployed12.0. Their Markdown was read. Figma5641:60939 directly confirms
  status=sessions-left. These are G9 sources; G9's extra cells remain deferred.
- Production Mark Goals As Checked counts (100 September /119 October) and
  notes counts (40 rows/17 tutors) are audit evidence recorded in #741;
  they were not freshly queried here. Mid-cycle check remains live.
- Card2482 remains Ready for Prod, card2641 Ready for QA; neither was treated
  as Deployed. Student-safe sharing order, banners, Finish/Undo, tutor-only
  suggestions, reward chip and goal-exempt are not introduced by this batch.
  The current draft includes future UI instructions; those sections are not
  used to imply that the future UI has shipped.

## Edit-table coverage

| Row | Supported change |
|---|---|
| G1 | All five Next student RT cells use dashboard order. |
| G2 | All five corresponding BSA cells describe app/status ordering. |
| G3 | Four goal-value RT cells explain suggestions and record student choice. |
| G4 | Four strategy RT cells use If/Then and remove conditional wording; structural step-name changes remain deferred. |
| G5 | Mid-cycle RT checks progress without setting another goal. |
| G6 | New-cycle RT uses new, not next, cycle. |
| G7 | Missed-session RT reviews last week and sets this week's goal. |
| G8 | Missed/no-goals explanation summary adds personalizable class defaults. |
| G9/G10 | Extra goal-window RT cells deferred to #756; existing goal-conversation cells are not overwritten to squeeze them in. |
| G11 | Two RCT BST cells and goal-setting BSA cells describe mandatory practice. Two Warm-Up Mark helped RT summaries also stop describing a separate non-goals arm, matching G11's explicit sequence. |
| G12 | New Goal data looks wrong exception path with the requested RT and Slack cells, both live as current training practice. |
| G13 | Teacher/Lead Tutor placement deferred; exact original cells are guarded unchanged. |
| G14 | All conditions summary names the five real maintained paths and the new exception. Step names remain deferred. |

[Follow-up #756](https://github.com/BilLogic/plus-uno-blueprint/issues/756)
retains missing step rename, cell move/clear and secondary-position insertion
work. The sanctioned upsert writes position0, occupied on all five goal-window
RT lanes; no supported RPC inserts an extra cell at a secondary position.
No schema/grant changes, raw structural writes, automated deletes or invented
workflow steps are used. #748 is natively blocked by #756 as well as its
original blockers, so supported #741 cannot silently bypass this work.

One abbreviated current-value difference is explicit: G2's d01207 Next student
BSA cell actually says Assigns the goal-setting activity, not Researchers set
student order. The exact actual value is guarded in the proposed diff; G2's
slot-specific correction is used instead of a second generic G11 write to the
same cell. There are no runtime expected-current mismatches.

## New path and touchpoints

G12 copies Mid-cycle check's nine lanes and eight shared columns through
create_path_at_status. Only the two requested cells are created, at Review
goals; other cells stay empty on this exception route. Copied lane IDs are
resolved by path/name read-only lookup, never guessed or selected first.
The Slack cell uses the registry name Slack; its summary names the channel.

G11's two RCT placements each have no summary, role or resources. Their rename
uses actual cellContentMutations syncing. The old empty placements are replaced
with one new placement apiece; the inverse and all resulting rows must be
verified after apply, including a joined-name read for the two renamed
placements and new Slack placement. Existing registry names elsewhere are not
changed or deprecated. The mandatory-practice label is explicitly requested
by G11 and is not used as a general registry naming convention.

## Verification

145 scoped checks cover complete before/after cell content/status/identity
across eight existing paths; exact unchanged lanes and path-step membership;
all Goal Setting step names (deferred renames stay unchanged); evidence and
placement counts; and the new path's two cells, nine lane roles/positions and
eight copied step positions. This includes every unchanged Teacher/Lead Tutor
cell in the deferred scope.

Dry-run passes, 118 operations, no expected-current mismatches, durable log
216→216. Pre-apply verify is expected to fail on absent post-state/new rows,
evidence and complete receipt. No hosted writes are part of testing.

The read-only lookup extension was tested at the already-agreed runner
read-back seam: red first, then green. It covers pending copied-lane lookup,
apply, separate receipt verification, and missing/ambiguous/id-less rejection.
All fourteen Node runner cases pass; both Vitest runner/mutation files pass
(five wrapper/integration tests). Typecheck and scoped ESLint pass. Final full
gates and stacked/merged rendering over all touched scenarios remain due.

## Independent review

The reused reviewer completed Standards and Spec review at head2d8fd42 against
merged runner base4af48fba. Both axes found no actionable findings. It confirmed
pending-lane lookup behavior, current-practice scope, evidence mappings and
deferred preservation. It ran no tests or hosted writes/verification.

Approval must use the runner's canonical JSON hash:
`5ec0f5ded96d74d452a243fe0670b55ba0775aaed8dc840ada8470843168c7ed`.
The differently formatted file's raw-byte hash is not the runner approval hash.

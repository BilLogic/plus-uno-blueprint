# Applied: corpus-wide copy sweep — 2026-08-16

Convention: `docs/design/content-voice.md` § "Blueprint cell content"
(written this date, from the 807-cell audit). Applied via supabase-plus MCP
`execute_sql`; every update guarded on `id` + exact current `content`
(+ empty/exact `description` wherever a description was written), so drifted
rows no-op rather than clobber. Draft SQL was produced by three read-only
agents under a no-invention contract (every rewritten word derivable from the
cell itself, its description, or its lane/step/scenario names), reviewed on
the main thread, then executed verbatim.

## Batches

| Batch | Updates | What |
| --- | --- | --- |
| Planned-prefix (correctness) | 40 | Every cell whose description says PLANNED now says `Planned —` in the grid; one cell ("ReconfirmState machine deployed to production") was outright false. Retired the `(Shipping — …)` and `(Figma … TBD)` dialects from content. |
| Singular/plural merge | 31 | `Researchers set…`/`Researcher sets…` → one string, one description on all copies. |
| Casing | 30+ | `PLUS app` → `PLUS App` both fields; `Dev team` → `Dev Team` pills; `Admin > Sessions` → `Admin › Sessions`. |
| Pre-session editorial | 37 | Audit-approved split of the 271-char twins; 8 over-cap splits; system rules in actor lanes re-led with the actor's action; imperatives → third person. |
| In+Post-session editorial | 244 | The July imperative cohort normalized (`Leave breakout room.` → `Leaves the student's breakout room.`); pronouns named (`Mark them as present.` → `Marks the student present.`); both design-spec cells rewritten as experience with spec detail moved to description; `miss-assigned` typo ×7. |
| Application+Onboarding editorial | 60 | Same treatment; 2 over-cap splits; `Applies.` → the actual act from its own description. |

## After-state (verified)

- Cells over the 120-char content cap: **0** (was 14)
- `PLUS app` casing violations: **0**
- `Planned —` prefixed cells: **40**
- Distinct content strings: 378 of 807

## Deliberately skipped (needs decisions, not grammar)

- ~21 Back Stage Tech "system headline" cells (sentences in a pill lane —
  e.g. `placeSingleStudent assigns the late joiner`): compressing to nouns
  loses meaning; needs a naming pass.
- 2 pills with route identifiers (`PLUS App — AI Coach (/PLUS/TutorReview)`)
  where the move needs a description edit.
- Duplicate act-strings across parallel paths (e.g. `Circulates and quietly
  observes the students.` ×7): differentiation requires facts.
- The 207 duplicate pill cells' step-specific descriptions: separate work item.
- 2 descriptions missing a verb (`…100409`/`…100509`).

## Enforcement follow-ups (not yet done)

specs.ts `upsert_cell` example is actor-first (contradicts convention);
`update_cell_content` carries no guidance; panel "Summary" label → "Detail";
elicitation-protocol EP-Q6 upstream in the plugin repo; optional
`check-cell-voice` audit check.

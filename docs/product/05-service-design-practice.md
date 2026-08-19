---
audience: service designers, practitioners
summary: The four blueprint practices (map, audit, what-if, slice), the compare workflow, findings triage, and where each practice is specified.
sources: src/lib/agent/skill/skills/, src/lib/agent/skill/references/, docs/plans/2026-08-08-003-docs-information-architecture-plan.md
last-reviewed: 2026-08-08
---

# Service design practice

How service-blueprint work actually runs here. Four practices, each
available as a skill (`/sb:*`) to both the in-app assistant and IDE agents,
each grounded in written specifications — the provenance section at the end
maps practice to specification to skill.

## The four practices

### Mapping — `/sb:map`

Building the blueprint itself: from a conversation (a structured question
script walks you from "what's the service?" down to individual cells), from
documents (discovery research, process docs, an existing FigJam/Miro
board), or by evolving an already-imported blueprint. Mapping owns every
cell write. The other three practices deliberately cannot create or edit
cells — anything they surface that needs a blueprint change routes back
through map.

### Auditing — `/sb:audit`

Running the check roster against an imported blueprint. Each check on the
roster is its own specification document; each runs blind (one
fresh-context auditor per check, seeing only its own spec and a read-only
export of the board), and results land as findings rows with severities and
cell citations. Checks whose required data is absent skip explicitly.
Re-runs are safe: findings deduplicate by fingerprint, dismissed findings
stay dismissed, and each check atomically supersedes only its own previous
results.

### What-if — `/sb:whatif`

Tracing consequences before committing: "what breaks if we automate
check-in?" It builds a hypothetical variant (a local file — the shared
database only ever describes reality), walks the trigger/needs dependency
graph downstream, and reports what breaks, what improves, and where
displaced work lands. Accepting an analysis emits a change request; the
actual blueprint change happens through map, which refuses if the base
blueprint moved since the analysis.

### Slicing — `/sb:slice`

Cutting stakeholder views: one actor's journey, one moment across every
lane, one lane end to end, or one cell in close-up (a storyboard is a
rendered journey slice). Every slice claim must trace to a cited cell — a
slice asserting an interaction the blueprint doesn't record is an invention
wearing a citation, and the reviewer agent exists to catch exactly that.

## The compare workflow

When a scenario has multiple paths (happy path plus variants), the Compare
surface reads them together:

- **Side-by-side** — each path as its own full grid.
- **Stacked** — paths as horizontal bands under a shared time axis, with a
  quiet column tint flagging where they differ.
- **Merged** — one combined grid, each slot showing every path's take on
  that moment. Shared cells draw once; different versions stack, and a thin
  rounded outline identifies the member paths of every cell without recoloring
  the service-lane fill.

Typical loop: map the variant as a path → compare against the happy path →
audit the divergences → slice the result for whoever must decide.

## Findings triage

Findings (from audit or what-if — same discipline) sit in three statuses:
**open** → a human either **resolves** (fix the blueprint through map, then
re-run; the check retires the finding) or **dismisses** (judgment recorded;
the fingerprint ensures the same finding never resurfaces). Triage is a
status change only — never re-run checks to honor a dismiss request, and
never "quick-fix" cells from inside an audit.

## Provenance — where the practice is specified

These practices are textbook-grounded (Shostack-lineage service
blueprinting) but they are not folklore here: they are **encoded as
specifications** that both humans and agents execute. In-app, they live at
`src/lib/agent/skill/references/`; the IDE plugin carries the same set at
the plugin repo's `references/`. To change how the practice works, edit the
specification — don't improvise around it. That's also how the practice
grows: a new audit check is a new `check-*.md` written from the playbook's
template, run alone once, then added to the roster.

| Practice | Specification files (references/)                                                                                                                                                                                                                              | Applied by   |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Mapping  | `elicitation-protocol.md` (question script), `lane-vocabulary.md` (drafting convergence), `layer-roles.md` (lane semantics ↔ rendering), `data-model.md`                                                                                                       | `/sb:map`    |
| Auditing | `audit-playbook.md` (run semantics, fingerprints, triage, check template), `check-gap-sweep.md`, `check-jargon-lint.md`, `check-channel-conflict.md`, `check-kpi-alignment.md`, `check-perceived-owner.md`, `check-value-ledger.md`, `check-fee-visibility.md` | `/sb:audit`  |
| What-if  | `whatif-playbook.md` (variant discipline, replay/restage/prioritize, promote handoff)                                                                                                                                                                          | `/sb:whatif` |
| Slicing  | `slice-playbook.md` (selection + regeneration rules), `slice-templates.md`                                                                                                                                                                                     | `/sb:slice`  |

Lay explanation of audits and findings for non-practitioners:
[doc 04](04-the-assistant-and-audits.md). Using slices to drive product
decisions: [doc 06](06-product-design-on-blueprints.md).

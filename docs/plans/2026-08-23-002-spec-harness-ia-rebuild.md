---
status: superseded
date: 2026-08-23
summary: The rev-1 spec for the harness IA rebuild, written while the vendored skill copy still existed and its drift was believed to be five files.
distilled-into: GitHub issue #83, and the issues under it (#84, #87, #92, #93, #94)
---

# Harness IA rebuild — spec (rev 1)

> Superseded by #83, which is this spec rewritten after the surveys behind it
> turned out to have been taken against a checkout 134 commits behind
> `origin/main`. Kept as the decision-era record: the drift was 18 files, not
> five, and it had inverted. `sync-agent-skill.mjs` has since been deleted
> rather than hardened.

## Problem Statement

Two things are wrong at once in this repo, and only one of them is visible.

The invisible one: the in-app agent and the humans running `/sb:*` in an IDE are executing **different skill text right now**. `node scripts/sync-agent-skill.mjs --check` reports five drifted files (`skills/audit/SKILL.md`, `skills/slice/SKILL.md`, `slice-playbook.md`, `check-kpi-alignment.md`, `check-value-ledger.md`). Worse, the check cannot be trusted to catch this: the canonical home is a hard-coded local filesystem path, and an absent checkout exits clean. The guard reports success when it cannot see the thing it guards, and nothing in CI runs it either way.

The visible one: an agent — the in-app assistant, uno-bot, or a generic Claude Code session — arrives in this repo with `AGENTS.md` and a documentation tree whose shape it has to learn from scratch. Design material sits under `docs/design/`, engineering under `docs/engineering/`, vocabulary is buried inside a product doc, and nothing states that the domain skills come from an installed plugin rather than this repo. Contributors hit the same wall: `docs/INDEX.md` is good, but it is not at the root and it indexes only `docs/`.

## Solution

Fix the drift and its detector first, as a correctness bug. Then adopt the harness grammar shared across all three repos (this one, `plus-uno`, `agentic-service-blueprinting`), so an agent that has read one arrives at any of them already knowing where things are.

The grammar: five root files that each answer one question (`README` · `SETUP` · `CONTEXT` · `INDEX` · `AGENTS`); `docs/` holding authored protocol only; folder names carrying the content class; `overview.md` authored and `index.md` generated; frontmatter carrying each doc's summary. Design material becomes `docs/guidelines/` with foundations / components / composition, matching the Figma and Atlassian conventions the model already has priors for.

## User Stories

1. As the in-app assistant, I want the skill text I execute to be identical to the plugin's, so that a fix authored once takes effect everywhere.
2. As a maintainer, I want `sync-agent-skill.mjs --check` to fail when it cannot reach the canonical source, so that a passing check means something.
3. As a maintainer, I want that check to run in CI, so that drift turns a build red instead of aging silently.
4. As a maintainer authoring a skill, I want an unambiguous canonical home, so that I never wonder which copy to edit.
5. As a developer cloning this repo for the first time, I want a `SETUP.md` at the root, so that I can get running without reading the whole doc tree.
6. As any agent starting a session here, I want `INDEX.md` at the root routing by task, so that I consult one map rather than guessing between folders.
7. As any agent, I want `CONTEXT.md` to define scenario, path, phase, step, cell, lane, line of visibility, trigger, need, slice, and finding, so that I never invent a synonym for a term the codebase already fixes.
8. As a reader of `CONTEXT.md`, I want it to contain definitions and nothing else, so that it stays a glossary rather than drifting into a spec.
9. As a designer, I want the design docs under `docs/guidelines/` split into foundations, components, and composition, so that a new doc has exactly one correct slot.
10. As an agent building UI, I want token, color, typography, spacing, motion, elevation, iconography, and data-viz rules each in their own foundation file, so that I load only what the task needs.
11. As a developer, I want `architecture.md` folded into `codebase-guide.md`, so that one doc answers "where does this live and how does it connect".
12. As a developer, I want anything surprising or hard to reverse recorded as an ADR under `docs/adr/`, so that a future reader learns why rather than inferring it.
13. As a contributor, I want the queue in GitHub Issues rather than `todos/`, so that assignment, closing, and cross-repo linking work.
14. As a maintainer, I want finished plans to remain as dated history with `status` frontmatter, so that decision-era snapshots are never mistaken for current truth.
15. As a generic Claude Code session, I want `AGENTS.md` to state that `/sb:map`, `/sb:audit`, `/sb:whatif`, and `/sb:slice` come from the installed plugin, so that I do not go looking for skills in this repo.
16. As a generic Claude Code session, I want `AGENTS.md` to state that `src/lib/agent/skill/` is a vendored copy for the in-app agent, so that I never edit it expecting the change to stick.
17. As a maintainer of the open-source package, I want this repo's uno coupling confined to a named instance integration, so that the package inherits nothing PLUS-specific.
18. As an agent writing to the database, I want the security lines to remain in `AGENTS.md` rather than behind a pointer, so that they are in force before I can reach a wrapper.
19. As a reader of any generated file, I want its name to tell me it is generated, so that I never hand-edit something a script will overwrite.
20. As a documentation maintainer, I want the root index generated from frontmatter, so that adding a doc updates the map without a second edit.
21. As an agent, I want every doc's frontmatter to carry a one-line summary, so that the index tells me whether to open it.
22. As a maintainer, I want the numbered product docs to keep their narrative role after definitions are extracted, so that the how-to-read guide survives without duplicating the glossary.

## Implementation Decisions

**Sync module.** The skill-sync module keeps its current interface (`--check` exits non-zero on drift) and gains two behaviours: it resolves the canonical source from a git remote by default, with a local-path override retained for authoring; and a source it cannot reach is a failure, not a skip. This is the seam the whole contract rests on, and it is an existing one — no new seam is introduced for it.

**Canonical direction is unchanged.** Skills and references are authored in `agentic-service-blueprinting` and vendored here. Editing a vendored file remains a mistake the next sync erases. The reference-name assertion at module init stays as the second guard.

**CI.** The drift check joins the existing workflow surface beside the bot-contract probe. Same pattern: a cross-repo invariant that turns red where the breaking change ships.

**Documentation tree.** `docs/design/` becomes `docs/guidelines/` restructured into `foundations/`, `components/`, `composition/`. `docs/product/03-reading-a-blueprint.md` splits — definitions to root `CONTEXT.md`, the how-to-read narrative stays as a product doc pointing at the glossary. `docs/engineering/architecture.md` folds into `codebase-guide.md`. `docs/INDEX.md` moves to the root, keeps its generator, and gains role-based reading paths. `docs/connectors/` holds supabase, the plus-uno bot-contract probe, and netlify.

**Naming laws.** `overview.md` is authored; `index.md` is generated. Every doc carries frontmatter with a summary. These apply repo-wide, not only to new files.

**Queue.** Open `todos/` entries become GitHub Issues; completed ones are deleted with the folder. Open plans become issues; finished plans stay as dated history.

**No new module boundaries.** This spec changes documentation, one script's source resolution, and one CI workflow. No application code seams move.

## Testing Decisions

A good test here asserts external behaviour at an existing seam: what the check script *reports*, not how it walks the tree.

- **Sync check.** Cover three cases through the script's exit code and output: identical trees pass; a deliberately altered vendored file fails and names that file; an unreachable canonical source fails rather than passing. Prior art: the existing `--check` path and the `scripts/tests/**/*.test.mjs` suite that `npm test` already collects without registration.
- **Reference-name assertion.** The existing module-init assertion that the reference record matches the name list stays and remains the fastest failure for a missed addition.
- **Docs.** Link integrity after the move is verified by regenerating the index and confirming every doc appears with a summary; a doc with no frontmatter summary is a failure, not a blank cell.
- **No snapshot tests of doc content.** Prose changes constantly; asserting on it produces tests that fail for the wrong reason.

## Out of Scope

- The skills and uno-bot harness sweep — two faces per skill, line budgets, routing-table duplication. Its own phase, with its own eval run.
- Rewriting the four vendored `sb` skills' content; this spec only makes the copies identical.
- The in-app agent's tool surface, roster, or provider adapters.
- `plus-uno`'s own migration, tracked in its repo.
- Any change to RLS, write wrappers, or the deployed site's read-only stance.

## Further Notes

The audit that produced this spec found the same failure mode three times across the estate: a mechanism shipped and its guard did not. The drift check is the sharpest instance — it exists, it is correct, and it has never been able to fail. Preferring existing seams and making them honest is worth more here than adding new ones.

Full audit, findings, and the decided IA for all three repos: the harness-audit artifact dated 2026-08-23, with the executable half in `docs/plans/2026-08-23-001-refactor-agent-harness-ia-plan.md`.

---
title: Documentation revamp — information architecture for humans and agents
type: docs
status: draft-for-review (rev 2 — three persona reviews incorporated)
date: 2026-08-08
---

# Documentation Revamp — Information Architecture (rev 2)

> **For review before execution.** Rev 2 incorporates three persona wayfinding reviews (designer / developer+agent / non-technical team member) run against rev 1. Their consensus: skeleton right, routing table is the real product, rev 1 was doc-shaped where it must be task-shaped. Changes from rev 1 are marked ◆.

## Diagnosis — unchanged from rev 1

`README` = setup only; `AGENTS.md` = conventions without pointers; the durable knowledge is trapped in 20 chronological plan files, loose docs at mixed altitudes, and the assistant's private memory. No living reference layer exists.

## Principles

1. **Three layers, never mixed:** *Reference* (living, updated in the PR that changes the fact) / *History* (plans, ideation — content-immutable) / *Queue* (todos). ◆ Amendment: history allows exactly one class of edit — **frontmatter only**: `status: superseded|distilled` + `distilled-into: docs/...`. Without it, grep-driven readers (agents especially) keep loading stale plans as truth.
2. **Code owns facts; docs own intent.** No value duplication that can rot.
3. **Dual consumption.** Humans browse, agents load. Frontmatter contract on every reference doc: `audience`, `summary`, `sources`, `last-reviewed`. ◆ `INDEX.md` is **generated from frontmatter by a script** — rev 1 already drifted its own numbering internally; hand-maintained duplication is how maps rot.
4. **Task-shaped routing.** ◆ The routing table is a **phase-1 deliverable with a row per task, not per doc** — all three reviewers' failures traced to missing task rows, not wrong folders.
5. **Single owner per fact.** ◆ Every topic named in two docs gets one owner and one link (rev 1 violated this for drawer postures, breakpoints, env handling, the write path).

## Proposed structure (rev 2)

```
README.md                 Front door: what this is, 5-min quickstart, map into docs/.
AGENTS.md                 Agent boot file — see boot protocol below. ◆ Keeps the
                          non-negotiable write invariants VERBATIM inline (never the
                          service key; writes through wrapper functions; deletes are
                          human-only) — a narrowly-prompted subagent that skips boot
                          reading must still be unable to miss them.
docs/
  INDEX.md                Generated map: one line per doc + the task-routing table.
                          ◆ Header carries a plans/-staleness warning ("history, not
                          truth — check distilled-into").
  product/                                     [ordered for the least-technical reader ◆]
    01-overview.md              What this is, for whom, in plain words. Defines
                                "service blueprint" and "surface" in its first
                                paragraph ◆. The user-type table in PLAIN language:
                                who can look, who can edit, how you get invited —
                                zero enforcement vocabulary ◆ (the enforcement view
                                moved to engineering/access-and-security).
    02-team-guide.md            ◆ PROMOTED to position 2. Zero-background: find a
                                scenario, read the journey (desktop + phone), what
                                you can/can't do on a phone (owns the lay answer ◆),
                                ask the assistant, share deep links, and a named
                                "Presenting and sharing" section (slices,
                                presentation mode, what exports cleanly) ◆.
    03-reading-a-blueprint.md   The vocabulary doc: phases, lanes, line of
                                visibility, steps, cells, triggers vs needs,
                                slices, findings.
    04-the-assistant-and-audits.md  ◆ NEW (both non-dev dead-ends): what the in-app
                                agent and the audit skills produce, under whose
                                permissions they act, how results are verified
                                (fingerprint dedupe, eval harness — in plain words),
                                how to challenge/dismiss a finding, why to trust a
                                citation. Lay companion to engineering/agent-system.
    05-service-design-practice.md  Running SB work: mapping, audits, what-if,
                                slicing, compare, findings triage. PLUS practice
                                provenance ◆: the textbook-grounded practices are
                                encoded in the skill references (in-app:
                                src/lib/agent/skill/references/; plugin repo:
                                references/) — this doc maps practice → where
                                specified → which skill applies it.
    06-product-design-on-blueprints.md  For designers grounding product work:
                                slices → specs, citing cells as evidence,
                                touchpoint reasoning. (Stakeholder-presentation
                                content lives in 02, linked ◆.)
  design/                                      [DESIGN audience]
    README.md                   The point of view (restraint, where boldness is
                                spent, Supabase benchmark) + how the folder is
                                organized + ◆ three sections rev 1 lacked:
                                "Surface anatomy" (what each surface looks like,
                                with links per surface — the designer's №1 task),
                                "Deviating" (can I break a rule, who decides),
                                and "Design tooling" (the source of truth is code;
                                no Figma library — stated explicitly, not implied).
    foundations/
      color.md                  Palette philosophy, semantic tiers, dark mode,
                                forced-colors stance. ◆ Ends with "adding a token"
                                process linking engineering/standards.
      typography.md             Type roles & scale; the time-marker register — ◆
                                naming the UI elements it governs (phase badges,
                                reader eyebrows), not only the register jargon.
      motion.md                 Motion vocabulary, the pinning test, reduced motion.
      iconography.md            Icon set, sizing, glyph-vs-hit-area rule.
      elevation.md              ◆ Split out of layout (shadows/z — conventional
                                foundation; nobody searches "layout" for shadows).
      data-viz.md               ◆ NEW: encodings for compare bands/ledger/strips,
                                severity colors, semantic-zoom tiers.
      layout.md                 Spacing, radius, width tokens (layoutTokens.ts ↔
                                theme.css split). ◆ Breakpoints move OUT (responsive
                                owns them; layout links).
    components.md               Which primitive for what; ◆ single owner of
                                drawer/sheet postures (engineering side links here);
                                ◆ empty/error-state visual recipes (copy stance
                                stays in content-voice, cross-linked).
    interaction.md              Click grammar, canvas modes, panel-as-selection,
                                camera, the touch contract.
    responsive.md               ◆ Owns the breakpoint contract. Mobile shell
                                view-only, reader⇄map, semantic zoom, non-goals.
    content-voice.md            Copy rules, agent voice, naming conventions.
    accessibility.md            Forced-colors, reduced motion, focus, aria state,
                                touch targets, SR naming.
  engineering/                                 [DEV audience — subject-named]
    architecture.md             Provider stack, module stores, canvas stack
                                (◆ + performance constraints/budgets — the 325MB
                                decode lesson lives here), data flow, ERD. ◆ Canvas
                                section links design/interaction for INTENDED
                                gesture behavior.
    codebase-guide.md           ◆ (renamed from "patterns" — too vague) Where
                                things live and what to copy: component
                                conventions, module-store idiom, render-time
                                reset, error boundaries. Links, not owns, postures.
    access-and-security.md      ◆ (renamed from data-and-security; absorbs the
                                enforcement half of rev 1's product/02) OPENS with
                                the user-type × enforcement matrix (UI gate vs RPC
                                tier vs RLS vs roster) — "which user am I?" links
                                product/01 for the lay table. Then: schema tour,
                                RLS + RPC tier + is_service_account, migrations
                                workflow, environments (single owner ◆), auth &
                                service accounts. ◆ Names ONE owner for the write
                                path: the "authoring writes" section (WriteFn
                                union, zero-row-is-failure, invalidateStructure,
                                identity-keyed inverses) lives HERE;
                                codebase-guide links it.
    agent-system.md             ◆ Pre-split in two (rev 1's single doc covered 7
                                subsystems — would blow the length budget):
      agent-system.md             Loop, rounds/batches, rosters & tiers, ui bridge,
                                  skills & the dual-home sync contract.
      agent-tools.md              The tool surface: specs/dispatch split,
                                  node-loadability boundary, adding a tool, the
                                  eval harness + parity tests.
    standards.md                Supabase benchmark concretely, token discipline,
                                comment philosophy, ◆ testing how-to (run/write,
                                incl. scripts/tests/*.mjs) alongside testing
                                philosophy, TOOLING TRAPS, review workflow.
    operations.md               Deploy, envs & keys (linked from
                                access-and-security, owned here ◆... no — owned in
                                access-and-security per single-owner; operations
                                covers deploy/rollback/monitoring/invite mechanics
                                and ◆ a troubleshooting section (Docker/supabase
                                start failures).
  decisions/                    ~10 ADRs, one page each; ◆ each is the
                                `distilled-into` target of the plan(s) it distills.
  reference/                    erd.mmd, seed-verification.sql, authored-fields.json,
                                ui-inventory.md, warm-up-happy-path-ids.md.
  plans/ · ideation/            History layer, unchanged paths.
```

◆ **Dropped: standalone surface-tours doc.** Two of three reviewers flagged screenshot maintenance as silent-failure risk; tours fold into 02-team-guide (user-facing walkthroughs) and design/README's surface-anatomy section (designer-facing), each owning only what its audience needs.

◆ **Numbering: product/ only** (real reading order). design/ and engineering/ use bare slugs — rev 1 couldn't keep its own numbers straight across two sections, and INDEX generation makes ordering metadata anyway.

◆ **Orphan dispositions** (every existing file gets one): `supabase/DATABASE.md` → superseded by access-and-security (deleted after distillation, pointer left one release); `docs/generalization-audit.md`, `docs/scenario-steps-design.md` → history (move to ideation/ with frontmatter status); `src/lib/agent/skill/references/*` + `src/lib/agent/role.md` → stay with code (runtime-loaded), documented in agent-system; `docs/agent/ui-inventory.md` → reference/.

## Routing table — now task-shaped ◆ (excerpt; full table is a phase-1 deliverable)

| Task | Route (in order) |
|---|---|
| "What is this / can I edit / how do I get access?" | product/01 |
| "Find scenario X / read it / phone / present to leadership" | product/02 |
| "Someone mentioned an audit finding — what is it, is it trustworthy?" | product/04 ◆ |
| "Add a field to cells end-to-end" | access-and-security (schema+RPC) → codebase-guide (wrapper+ledger) → design/components (panel UI) ◆ |
| "Which credentials does my agent session use; what's forbidden?" | AGENTS.md invariants → access-and-security ◆ |
| "Canvas gesture misbehaving — intended vs implemented" | design/interaction + engineering/architecture ◆ |
| "Match an existing surface's visual style" | design/README (surface anatomy) → components + foundations ◆ |
| "Empty-state: visuals / words" | design/components / design/content-voice ◆ |
| "Set up local dev" / "deploy, rollback, envs" | README / operations ◆ |
| "Add an agent tool / trust the eval numbers" | engineering/agent-tools ◆ |
| "Is this plan file still true?" | its frontmatter `status` + `distilled-into` ◆ |

## Context engineering — boot protocol (hardened ◆)

1. AGENTS.md auto-carries: the verbatim write invariants, tooling traps, protected paths, "code is newer than docs", and ◆ the ambiguity default ("unsure → engineering/architecture first").
2. Read `docs/INDEX.md`; route by task rows.
3. Any write task: read engineering/access-and-security's opening matrix first.
4. Per-role reading paths for HUMANS too ◆ ("New designer? product/01→03→06, design/README, foundations" — rev 1 gave agents a boot path and humans nothing).

## Execution phasing (unchanged shape; routing table promoted into phase 1)

| Phase | Deliverable | Size |
|---|---|---|
| 1 | Skeleton + INDEX generator + full task-routing table + orphan dispositions + README/AGENTS.md rewrite | M ◆ |
| 2 | engineering/ (6 docs) | L |
| 3 | design/ (README + 7 foundations/ + 5) | M–L |
| 4 | product/ (6 docs) | M |
| 5 | decisions/ backfill + history frontmatter stamping ◆ | M |

Phase gate ◆: phase 2 does not start until the routing table is complete — all three reviewers converged on it being the actual product.

## Resolved review questions

- **Audience-first vs topic-first**: audience-first stands, but honesty note: it survives only because the routing table glues cross-audience tasks — hence the phase gate.
- **ADRs**: yes, scoped to the ~10 named, doubling as `distilled-into` targets.
- **Surface tours**: folded (see above).
- **Numbering**: product/ only.
- **product/02 dual-audience protocol doc (rev 1)**: split ◆ — plain table in product/01, enforcement matrix opens engineering/access-and-security. A doc an instructor reads to learn "can I fix a typo" and a doc a dev-agent must read before writes have opposite failure modes; fusing failed both.
- Ecoeled/plugin docs: stay in the plugin repo; agent-system documents the sync contract.

---
title: Documentation revamp — information architecture for humans and agents
type: docs
status: draft-for-review
date: 2026-08-08
---

# Documentation Revamp — Information Architecture

> **For review before execution.** This plans the structure and what goes where; no docs are written yet. The explicit goal is context engineering: a future human or agent picking up this project should be able to load the right context in minutes, by audience, without spelunking through 20 chronological plan files.

## Diagnosis — what exists today

| Artifact | State |
|---|---|
| `README.md` (82 lines) | Setup only. No product story, no map into anything else. |
| `AGENTS.md` (54 lines) | Coding conventions. No pointers to deeper context. |
| `docs/plans/` (20 files) | The real knowledge base — but chronological, decision-era snapshots, partially stale, unnavigable by topic. |
| `docs/ideation/`, `docs/agent/ui-inventory.md`, `erd.mmd`, `seed-verification.sql`, one-off design docs | Scattered loose files at mixed altitudes. |
| `todos/` (20 files) | Work queue; fine as-is. |
| `src/lib/agent/skill/references/` | The *in-app agent's* rulebook (layer-roles, canvas-adapter…). Load-bearing runtime docs — must stay where code imports them. |
| My assistant memory files | Cross-session context that only I can read — exactly the knowledge this revamp should make public. |

**The gap:** there is no *living reference* layer at all. Everything durable is trapped in either historical plans or private memory.

## Principles (the part to agree on before structure)

1. **Three layers, never mixed:** *Reference* (living, always-true, updated in the PR that changes the fact) / *History* (plans, ideation — append-only, never edited, snapshots of decisions) / *Queue* (todos). A reference doc may cite history; history is never "fixed up."
2. **Code is the source of truth for facts; docs are the source of truth for intent.** The design-system doc does not restate token values (theme.css owns those) — it explains the tiers, the naming contract, and where each kind of value lives. Anything a doc duplicates from code will rot; anything code can't express (why, when, for whom) is the docs' job.
3. **Dual consumption: humans browse, agents load.** Every reference doc carries frontmatter (`audience`, `summary`, `sources`) and a strict length budget; `docs/INDEX.md` is the one map both read first; `AGENTS.md` becomes the agent boot sequence pointing into it.
4. **Audience-first top level.** product / design / engineering / decisions — matching your four groups, because "who is asking" is the first routing question.

## Proposed structure

```
README.md                 ← front door: what this is, 5-min quickstart, map into docs/
AGENTS.md                 ← agent boot file: conventions, tooling traps, "read INDEX.md,
                            then the docs tagged for your task" — the context-engineering entry
docs/
  INDEX.md                ← THE map. One line per doc: path · audience · what it answers.
  product/                                                [USER audiences]
    01-product-overview.md        What uno-blueprint is; the three personas (visitor /
                                  signed-in viewer / service account); mobile = view-only
    02-reading-a-blueprint.md     Service-blueprint literacy: lifecycle→phase→scenario→path,
                                  lanes & the line of visibility, steps, cells, triggers vs
                                  needs, slices, findings. THE shared vocabulary doc.
    03-service-design-practice.md How to run SB work here: mapping (sb:map), auditing
                                  (sb:audit), what-if (sb:whatif), slicing (sb:slice),
                                  compare workflow, findings triage. For practitioners.
    04-product-design-on-blueprints.md  Grounding product/UI/UX work on the blueprints:
                                  slices → specs, citing cells as evidence, touchpoint
                                  reasoning, presenting to stakeholders.
    05-team-guide.md              Non-designers: find a scenario, read the journey (desktop
                                  + phone reader), ask the agent, share deep links. Shortest
                                  doc; assumes zero design background.
    06-surface-tours.md           Guided tour per surface: board/overview, scenario detail,
                                  compare cockpit, slices & presentation, mobile shell, the
                                  agent. Screenshots. (Replaces "watch someone use it.")
  design/                                                 [DESIGN audience]
    01-design-language.md         The point of view: restraint stance, type roles, the
                                  time-marker register (mono/uppercase/ordinal), color
                                  philosophy, where boldness is spent (per-surface signatures).
    02-design-system.md           Token architecture (tiers 1–4 + where each lives), motion
                                  vocabulary + the test that pins it, radius/spacing/width
                                  tokens, component recipes (Sheet/Drawer postures, badges,
                                  segmented controls). Points at css files, never restates values.
    03-interaction-grammar.md     The click grammar (⌘-click opens, pick vs read), canvas
                                  modes (view/design), panel-as-selection ownership, camera
                                  behavior, touch contract (tap/slop/pan/pinch/ghost rules).
    04-responsive-behavior.md     The breakpoint contract (<768 = mobile shell, view-only for
                                  every tier; ≥768 desktop incl. tablets), reader⇄map fold,
                                  semantic zoom tiers, what is deliberately NOT responsive.
    05-content-voice.md           UI copy rules (active voice, sentence case, one job per
                                  element, error/empty-state stance), the agent's voice
                                  (honest verification, "the panel is NOT open"), naming
                                  conventions (Merged/Stacked, Journey/Map...).
    06-accessibility.md           The bar and how it's held: forced-colors restatements,
                                  reduced motion, focus-visible catch-all, aria state on
                                  toggles, 44px touch targets, screen-reader naming rules.
  engineering/                                            [DEV audience]
    01-architecture.md            App shape: provider stack, module stores
                                  (useSyncExternalStore pattern & why), canvas stack
                                  (viewport→transform→artboards→cells), data flow
                                  (useSupabaseQuery cache + invalidation contract), ERD
                                  (embeds docs/reference/erd.mmd).
    02-frontend-guide.md          Where things live and the patterns to copy: component
                                  library usage (shadcn + base-ui, which primitive for what),
                                  drawer/sheet postures, one-surface-two-postures precedent,
                                  render-time state reset idiom, ledger/authoring invariants.
    03-backend-supabase.md        Schema tour, the security model (RLS restrictive + RPC tier
                                  enforcement + is_service_account, WHY UI gating is not the
                                  wall), migrations workflow, seed/verification, environments
                                  (local/hosted project ids), auth & service accounts.
    04-agent-system.md            The in-app agent: loop rounds & batch etiquette, tool
                                  registry/specs split (and the node-loadability boundary),
                                  rosters (tier + mobile), ui bridge/commands/context
                                  contributors, skills & references, the eval harness +
                                  parity tests.
    05-standards.md               Coding standards & dos/don'ts: the Supabase benchmark and
                                  what it means concretely, token discipline rules, comment
                                  philosophy (constraints not narration), testing philosophy
                                  (what earns a test), TOOLING TRAPS (bare tsc no-op, zsh
                                  globs, base-ui defaultSnapPoint...), review workflow.
    06-operations.md              Deploy (Netlify from main), envs & keys handling (what
                                  never gets committed), Supabase dashboards, monitoring
                                  (ErrorBoundary channel), access/invite flow, rollback.
  decisions/                                              [ALL — the "why" log]
    README.md + ADR-NNN-*.md      One page each, immutable: view-only mobile for all tiers;
                                  panel-as-selection single owner; canvas agent = full parity;
                                  writes via guarded RPCs only; deletes are human-only;
                                  compare v3 model; semantic zoom; sidebar float-pill...
                                  Each links the plan(s) it distills.
  reference/                                              [machine-adjacent artifacts]
    erd.mmd, seed-verification.sql, authored-fields.json, ui-inventory.md (moved from
    docs/agent/), warm-up-happy-path-ids.md
  plans/        (UNCHANGED — pipeline writes here; history layer)
  ideation/     (UNCHANGED — history layer)
  brainstorms/  (if/when created by ce:brainstorm)
  solutions/    (if/when created by ce:compound)
```

`todos/` stays at repo root (pipeline convention). `src/lib/agent/skill/references/` stays with the code that imports it; `engineering/04` explains its role and links it.

## What goes where — the routing table

| Question | Doc |
|---|---|
| "What is this product / who is it for?" | product/01 |
| "What's a lane / line of visibility / slice?" | product/02 (everyone's prerequisite) |
| "How do I run an audit / make a slice?" | product/03 |
| "How do I use blueprints for product decisions?" | product/04 |
| "I'm an engineer/PM — where's the context for scenario X?" | product/05 → 06 |
| "Why does it look/feel like this?" | design/01 |
| "What token/component do I use?" | design/02 (+ code) |
| "What does click/tap X do, and why?" | design/03 |
| "What happens on a phone/tablet?" | design/04 |
| "How do I write UI copy here?" | design/05 |
| "How does data flow / where do I add a feature?" | engineering/01–02 |
| "How is write access actually enforced?" | engineering/03 |
| "How do agent tools work / how do I add one?" | engineering/04 |
| "What are the standards / traps / benchmark?" | engineering/05 + AGENTS.md |
| "Why was X decided?" | decisions/ (then the linked plan for full context) |

## Context engineering — the agent path

`AGENTS.md` gains a **boot protocol** section:
1. Read `docs/INDEX.md` (the map, ~60 lines).
2. Load by task type: UI work → design/02+03 + engineering/02; data/auth → engineering/03; agent tools → engineering/04; product questions → product/01–02. INDEX.md carries these task→doc mappings.
3. Standing rules (tooling traps, commit conventions, protected paths) stay in AGENTS.md itself — the only file guaranteed auto-loaded.

Frontmatter contract on every reference doc: `audience`, `summary` (one line, shown in INDEX), `sources` (the plans/code it distills — so an agent can go deeper), `last-reviewed`. A doc whose code-sources changed in a PR is expected to change in that PR — enforced socially via the review checklist in engineering/05.

## Sources — no doc starts blank

Every doc distills material that already exists: the 20 plans, 2 ideation docs, the loose design docs, AGENTS.md, README, my assistant memory (access model, infra ids, invariants — this revamp makes that knowledge public and survivable), and the code itself. The plan-to-doc mapping is per-doc in the tree above; nothing requires new research.

## Execution phasing (after your review)

| Phase | Deliverable | Size |
|---|---|---|
| 1 | Skeleton dirs + `INDEX.md` + move loose files → `reference/` + rewrite `README.md` + `AGENTS.md` boot protocol | S |
| 2 | `engineering/` 01–06 (highest agent value; most is distillation) | L |
| 3 | `design/` 01–06 | M |
| 4 | `product/` 01–06 (06 needs screenshots) | M–L |
| 5 | `decisions/` backfill (~10 ADRs from plans) | M |

Each phase is a reviewable PR. Phases 2–4 parallelize across subagents (one doc each, INDEX as contract).

## Open questions for your review

1. **Audience-first (proposed) vs topic-first** top level? Audience-first optimizes routing; topic-first optimizes cross-linking. I recommend audience-first with the routing table gluing.
2. **ADR layer** — worth the backfill, or do plan files + INDEX suffice as the "why" record?
3. **product/06 surface tours with screenshots** — maintenance-heavy; keep, or fold thin tours into product/03–05?
4. **Numbered filenames** (stable reading order, as proposed) vs bare slugs?
5. Anything to add for the **Ecoeled dogfood / publishable sb: plugin** — document here, or keep that in the plugin repo when it splits out?

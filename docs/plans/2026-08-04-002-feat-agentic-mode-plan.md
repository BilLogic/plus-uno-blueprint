---
title: 'feat: agentic mode — sidebar-native agent, Figma-style nav shell'
type: feat
status: active
date: 2026-08-04
revised: 2026-08-04 (v2 — sidebar IA pivot, skills-first priority)
---

# Agentic mode — a sidebar-native agent in a Figma-style shell

## Overview

View reads. Edit writes. **The agent converses** — from a panel docked in
the left sidebar, holding the same pen the human holds: it authors through
the same RPCs, its changes land in the same session sheet, each row
individually revertible, all of it behind the same Save gate. The agent
proposes by *doing*, and the human keeps the veto.

**v2 revisions** (this rewrite):

1. The agent is **not a floating window and not a third canvas mode** — it
   is a sidebar surface. The whole sidebar moves to Figma's IA: a vertical
   icon rail with the content panel to its right.
2. The top nav takes **full window width**; the sidebar starts below it.
3. Collapsed sidebar becomes a **floating pill** over the canvas (Figma's
   collapsed-file-pill pattern), not a docked 48px rail.
4. **Skills before UI.** The system prompt was a sketch in v1; it is now
   the centerpiece, assembled from the domain rulebook already written for
   the `agentic-service-blueprinting` plugin, and iterated in a CLI harness
   *before* any panel is built.

Build order (locked): **① lo-fi wireframes (this doc) → ② agent skills +
harness iteration → ③ UI prototype.**

## Problem statement

Blueprinting is transcription-heavy: interview notes, board sweeps and
transcripts become cells one click at a time. The Ecoeled dogfood showed the
bottleneck is not deciding what the blueprint says — it is typing it in.
An agent that drafts structure from prose, fills specs, proposes slices and
answers "where do tutors touch PLUS App?" turns hours of transcription into
minutes of review.

Secondary problem this revision absorbs: the sidebar's horizontal
`Blueprints | Slices` tab strip ([SlideModeView.tsx:104](../../src/components/editor/SlideModeView.tsx))
doesn't scale to a third surface. A horizontal segmented control with three
labels eats the sidebar's width; Figma's vertical rail is the proven shape
for "several tools share one dock."

---

## Part 1 — The shell, before the agent

### 1.1 Full-width top nav

Today the tab strip lives inside `<main>`, so the sidebar runs the full
window height beside it. Revised: the top nav spans the window; everything
else — rail, panel, canvas — sits under it.

```
BEFORE                                AFTER
┌─────┬────────────────────────┐      ┌──────────────────────────────────┐
│ side│ ⌂ tabstrip             │      │ ⌂  tabstrip …………………………………  ✕ ▢  │  ← full width
│ bar │────────────────────────│      ├──┬─────────────┬─────────────────┤
│     │                        │      │r │  content    │                 │
│     │        canvas          │      │a │  panel      │     canvas      │
│     │                        │      │i │             │                 │
│     │                        │      │l │             │                 │
└─────┴────────────────────────┘      └──┴─────────────┴─────────────────┘
```

`EditorShell` restructures from `[aside | main(TabStrip, canvas)]` to
`[TabStrip, row(rail, panel, canvas)]`. The workspace-title header that
currently tops the sidebar moves into the top nav's left end (it becomes
the collapsed pill's contents too — see 1.3).

### 1.2 The rail — vertical tabs, Figma's setup

A fixed ~48px icon rail. Each icon is a *surface*, not a mode: it decides
what the content panel shows, never what a canvas click does.

```
┌──┬──────────────────────────┐
│▦ │  PHASES                  │   ▦  Blueprints — phases/scenarios/paths
│  │   ▸ Discovery            │       (today's SlideModeSidebarNav content)
│◇ │   ▾ Warm-Up              │
│  │      Happy Path          │   ◇  Slices — the slice type groups
│✦ │      Call-off Request    │       (today's SlicesSidebarSection)
│  │  PATHS                   │
│  │   ◉ Happy Path           │   ✦  Agent — sessions + conversation
│  │   ○ Set Goals            │       (new; Part 2)
│  │                          │
│⚙ │                          │   ⚙  Settings — pinned to rail bottom
└──┴──────────────────────────┘       (provider keys live here)
```

- Active rail icon: filled square, same selected vocabulary as sidebar rows.
- Naming: the third tab is **Agent** — not "Sessions" (collides with the
  change-ledger's "session sheet" vocabulary) and not "Convos" (register
  mismatch with Blueprints/Slices). Sessions are what you see *inside* the
  Agent tab.
- Auto-switch survives: activating a slice tab still flips the rail to ◇,
  exactly as the horizontal tabs auto-switch today.
- The content panel is 240px for ▦/◇ and **320px for ✦** — transcripts
  need more line length than a nav tree; the width eases on the same
  320ms structural curve as collapse.

### 1.3 Collapse — the floating pill

Collapsing hides rail *and* panel. What remains is a floating pill over the
canvas (Figma's collapsed-file-chip), top-left, workspace name + expand:

```
expanded                              collapsed
┌──┬────────────┬──────────────┐      ┌──────────────────────────────────┐
│▦ │ PHASES     │              │      │ ┌──────────────────────┐         │
│◇ │  Discovery │    canvas    │  ⇄   │ │ ⬒ Uno Blueprint  ▣  │ canvas  │
│✦ │  Warm-Up   │              │      │ └──────────────────────┘         │
└──┴────────────┴──────────────┘      │   ↑ floats over canvas, z-raised │
                                      └──────────────────────────────────┘
```

- The pill is the workspace header relocated: title + expand affordance.
  One control, one home, whether docked or floating.
- Hover-peek survives: hovering the pill slides the full rail+panel out as
  an overlay (today's `railHovered` behavior generalizes — the canvas never
  resizes during a peek).
- Presentation mode uses the same collapsed state it uses today; the pill
  hides during presentation (Return is the way back).

### 1.4 Canvas mode toggle — back to two squares

v1 proposed a third ✦ square on the View/Edit toggle. Retired: with the
agent as a rail surface, a canvas mode named "Agent" would be a category
error — the toggle answers "what does clicking the canvas do," and the
agent changes nothing about that. View and Edit remain the only postures;
the agent panel is available in either (its *writes* require the
authenticated session, same as Edit's).

---

## Part 2 — The agent surface (lo-fi, priority ①)

### 2.1 The panel — two-step progressive disclosure

The ✦ surface is **two views, one at a time** — session info never
crowds the conversation. Step 1 picks (or creates) a session; step 2 is
the chat, full-height. Same pattern as Figma's Pages panel header: title
row with 🔍 and ＋ at the right.

**Step 1 — sessions view** (what ✦ opens onto):

```
┌──┬───────────────────────────────┬───────────────────────┬──────────┐
│▦ │ Sessions              🔍  ＋  │                       │          │
│  ├───────────────────────────────┤        canvas         │ (cell    │
│◇ │ TODAY                         │                       │  detail  │
│  │  ✦ Draft the Warm-Up   12 chg │  ← click = enter chat │  drawer, │
│✦●│  ✦ Fill tech specs      4 chg │                       │  as      │
│  │ EARLIER                       │                       │  today)  │
│  │  ✦ Q&A about Discovery  0 chg │                       │          │
│  │                               │                       │          │
│  │  (right-click a row:          │ ┌───────────────────┐ │          │
│  │   Rename / Delete)            │ │▷ ✋ ◇│⏺ Save (9)│👁 ✎│ │          │
│⚙ │                               │ └───────────────────┘ │          │
└──┴───────────────────────────────┴───────────────────────┴──────────┘
```

- 🔍 expands in place into a filter Input (fuzzy match over titles —
  OwnerTagSelect's filter-as-you-type pattern); Esc restores the header.
- ＋ starts a session and drops straight into step 2.
- Groups (Today / Earlier) are Accordion sections (DS `accordion.tsx`).
- Row context menu: Rename / Delete — right-click, consistent with the
  rest of the sidebar.

**Step 2 — chat view** (after selecting a session):

```
┌──┬───────────────────────────────┬───────────────────────┬──────────┐
│▦ │ ‹  Draft the Warm-Up   12 chg │                       │          │
│  ├───────────────────────────────┤        canvas         │          │
│◇ │ You: turn these interview     │                       │          │
│  │ notes into a Help Request     │   ┌╌╌╌╌╌╌╌┐           │          │
│✦●│ scenario …                    │   │ cell  │← agent-   │          │
│  │                               │   └╌╌╌╌╌╌╌┘  touched  │          │
│  │ ✦ I'll add 6 steps and fill   │              cells    │          │
│  │   3 lanes. Working…           │              pulse    │          │
│  │   ├─ ✔ Added step "Reach out" │                       │          │
│  │   ├─ ✔ Added a cell      [↺]  │                       │          │
│  │   └─ ⋯ Adding a cell          │                       │          │
│  │                               │ ┌───────────────────┐ │          │
│  │                               │ │▷ ✋ ◇│⏺ Save (9)│👁 ✎│ │          │
│⚙ │ ⏹ Stop  [ message……… ]  [➤]  │ └───────────────────┘ │          │
└──┴───────────────────────────────┴───────────────────────┴──────────┘
                                     ↑ bottom toolbar floats INSIDE the
                                       canvas region — it never spans
                                       under the rail or agent panel
```

- Header: `‹` back to sessions view + session title + change count.
  Nothing else — the transcript owns the rest of the height.
- Re-tapping ✦ on the rail returns to whichever view was last open.

**Shared rules:**

- **Bottom toolbar lives on the canvas side.** It is canvas chrome
  (tools, Save gate, View/Edit) and docks at the canvas region's bottom
  edge, right of the sidebar — never a window-wide bar.
- **DS-native components only.** Every agent-UX element composes
  existing `src/components/ui/` primitives (Accordion, Input, Collapsible,
  Badge, DropdownMenu, Popover, ContextMenu, Dialog, Skeleton, Spinner) —
  nothing hand-rolled. Need→primitive map:
  [2026-08-04-003 §ui-inventory](./2026-08-04-003-feat-agent-harness-and-skills-plan.md).
- Tool calls render as change rows — the same `describeChange` vocabulary
  as the session sheet, with per-row ↺ revert inline in the transcript.
- Stop aborts via `AbortSignal`; whatever landed stays, revertible.
- Cell drawer on the right unchanged — "look at this cell" while the agent
  talks about it is the normal case, and the two panels are on opposite
  edges by construction now.

### 2.2 The agent flow (end to end)

```
   user picks ✦ on rail              (no key yet? panel shows settings
        │                             prompt → ⚙ provider + key first)
        ▼
   types instruction ──────────────► provider.chat(system, messages, TOOLS)
                                          │ streams
        ┌─────────────────────────────────┤
        ▼ text deltas                     ▼ tool_use
   transcript grows              dispatch(tool, args)
                                     ├─ read tools → compact snapshots
                                     └─ write tools → SAME wrappers UI calls
                                          → recordChange(author:'agent',
                                                         session_id)
                                          → invalidateQueries
                                          → canvas updates live + pulse
        ◄─────────────────────────────────┘ tool result loops back
        │
        ▼
   human reviews: ledger rows wear ✦, revert any row, ⌘Z works,
   Save changes gate unchanged. Deletes: not offered to the agent, v1.
```

### 2.3 The shared ledger — one change sheet, two authors

```
┌ Save changes (9) ────────────────────────────┐
│ HELP REQUEST · HAPPY PATH                    │
│   ✦ Added step "Reach out"            ⌖  ↺  │
│   ✦ Added a cell                      ⌖  ↺  │
│      Added lane "QA"                  ⌖  ↺  │  ← human row, no badge
├──────────────────────────────────────────────┤
│                            [ ✔ Keep all ]    │
└──────────────────────────────────────────────┘
```

Unchanged from v1 — this is the entire safety model and it is already
built. New parts: the ✦ badge (`recordChange` gains
`author: 'human' | 'agent'` + `agentSessionId`).

---

## Part 3 — Skills, system prompt, harness (priority ②)

v1 waved at "a system prompt sketch." Wrong order. The prompt *is* the
product for authoring quality, and most of it is already written — the
`agentic-service-blueprinting` plugin (github.com/BilLogic/agentic-service-blueprinting)
carries a reviewed domain rulebook. We lift, adapt, and iterate it in a
harness before the panel exists.

### 3.1 Prompt architecture — one plugin-shaped skill

Deepened in its own doc:
[2026-08-04-003 harness & skills IA](./2026-08-04-003-feat-agent-harness-and-skills-plan.md).
**No new skill.** The canvas agent consumes the plugin's four-skill
roadmap — `blueprint` (→ `map`), `slice`, `audit`, `whatif`
(agentic-service-blueprinting plan 2026-07-29-004) — one skill active
per task via a thin intent router, plus ONE new plugin reference,
`canvas-adapter.md`, translating the workspace dialect (IR files,
validators, sign-off) to the app's tool surface (live RPCs, revertible
ledger, human Save gate). v1 wires blueprint(map) + slice; audit and
whatif drop in when 004 Phases 2–3 land. Humans manage the same four
skills from the IDE; the app vendors the same files and serves
`references/` through a `read_reference` tool — one
progressive-disclosure mechanism, two consumers.

Assembled at session start: SKILL.md + inject a live context snapshot
(current phase/scenario/paths, selection, owner-tag vocabulary, step/lane
names — labels and ids, not full contents; the agent reads details through
tools). The snapshot design carries over from the earlier inline-agent plan
([2026-07-31-003](./2026-07-31-003-feat-inline-agent-chat-plan.md)), which
already settled: labels+ids only, contents on request.

### 3.2 House rules to lift (source: plugin references/, verbatim where possible)

From `lane-roles.md` / `lane-vocabulary.md`:
- "Never infer semantics from the display name."
- Actor vs system: "A person doing work is `*_actions`, not a `*_tech`
  pill." Keep tech lanes as pills; prose in a pill lane reads badly.
- Same actor group → byte-identical lane label everywhere; never bake a
  role word into a label.
- One spine actor per path at most; ask "whose journey is the spine?"
  rather than assuming.

From `elicitation-protocol.md` / playbooks:
- 5–15 named steps; merge micro-steps, split epics.
- Empty cells are normal — don't fish for filler; volunteered detail goes
  in description/summary, not bloated labels.
- Arrows only where they add information; same path only.
- Propose structure as plain text FIRST and get a nod — "structure
  mistakes are cheap here, expensive later."
- Never fabricate: low confidence = flag it, don't guess. "Cells that read
  like system capabilities rather than journey moments" is the fabrication
  signature (reviewer heuristic → self-check).

App-specific additions (not in the plugin):
- Owner and perceived-owner are **tag vocabularies** — read existing tags
  before inventing one.
- Cells are born with text; summary is the tl;dr of the detailed fields.
- `needs` vs `trigger` on dependencies — define both, with an example.
- Every write lands immediately and revertibly — say what you're about to
  do in one line before a batch, then do it.

### 3.3 The elicitation protocol → conversation playbook

The plugin's Q0–Q9 elicitation script (right-sizing → lifecycle → phases →
spine → steps → lanes → cells → paths → triggers) becomes the agent's
*co-creation* playbook for "turn these notes into a scenario" requests —
the exact task the Ecoeled dogfood proved is the bottleneck.

### 3.4 The harness — iterate prompts before pixels

A CLI harness so skill iteration doesn't wait on (or get polluted by) UI:

```
scripts/agent-harness/
  run.mjs         REPL: pick provider+model, loads skills + a scenario
                  snapshot, streams chat, executes READ tools live
                  (dev-auth Supabase), prints WRITE tool calls as a dry-run
                  plan by default; --apply executes them through the same
                  wrappers (revertible, so cheap to undo)
  cases/          scripted eval prompts with expected-behavior notes:
                  "add a QA lane to Warm-Up", "notes → Help Request
                  scenario", "where do tutors touch PLUS App?",
                  "rename owner tag consistently", an injection probe
                  (cell text containing instructions — must be ignored)
```

Exit condition for priority ② (deterministic, per the plugin's own rule
that phases end on evidence, not vibes): all cases produce correct tool
plans on Gemini + one other provider, zero fabricated structure, zero
delete attempts, injection probe ignored.

### 3.5 Providers — unchanged from v1

Google / Anthropic / OpenAI adapters behind one interface; browser CORS
(Anthropic via `anthropic-dangerous-direct-browser-access: true`); keys in
localStorage via the ⚙ rail settings, never repo/bundle/Netlify; defaults
`gemini-2.5-pro` / `claude-sonnet-4-5` / `gpt-4o`. Deliberately no fourth
provider — the adapter interface is the extension point.

### 3.6 Tools — unchanged from v1

- Write tools = the existing wrappers (`addStep/addLane/upsertCell/
  updateCellContent/updateCellSpec/setCellDependency/createSlice/
  renamePath/duplicatePath…`) → `recordChange(author:'agent')`. RLS,
  validation, logging, revert come free. **No delete tools, v1.**
- Read tools = compact snapshots: `list_scenarios()`, `get_blueprint(
  scenario)` (steps × lanes × cell text), `get_cell(id)`, `list_slices()`,
  `list_owner_tags()`.
- Static allow-list (`agentTools.ts` per the 07-31 plan): no dynamic
  dispatch, no table names as arguments, no free SQL. Off-list request =
  refusal, not attempt.

### 3.7 Persistence — unchanged from v1

`agent_sessions` / `agent_messages` tables, RLS authenticated-only, anon
none. Reopening a session restores the transcript; "N changes" counts
ledger entries stamped with the session id.

---

## Implementation units (in the locked priority order)

**① Wireframes** — this document. Exit: Bill nods at Parts 1–2.

**② Skills + harness** (detailed units in
[2026-08-04-003](./2026-08-04-003-feat-agent-harness-and-skills-plan.md))
1. AGENTS.md + `docs/agent/ui-inventory.md` in this repo.
2. `references/canvas-adapter.md` in the plugin repo (the four skills
   stay untouched).
3. Vendor + assemble: sync script, `prompt.ts`, tool registry with
   `read_reference`, provider adapters. UI-free.
4. `scripts/agent-harness/run.mjs` + cases; iterate until the exit
   condition holds.

**③ UI prototype**
5. Shell restructure: full-width top nav, rail + content panel, floating
   collapse pill, ✦ tab; bottom toolbar docks inside the canvas region.
   (Own commit — it reshapes navigation for everything, agent aside.)
6. Agent panel, DS-native throughout: sessions accordion with fuzzy
   filter input, transcript with tool rows (`describeChange` reuse),
   Stop, composer; ⚙ settings popover with key entry.
7. Sessions persistence migration + restore.
8. Ledger ✦ badges + per-session counts + agent-touched cell pulse.
9. Live e2e with Bill's Gemini key (pasted into ⚙ in-app, never chat/repo):
   "add a QA lane to Warm-Up and describe it" → lane appears, sheet shows
   ✦ rows, revert works, reload restores the session.

## Scope boundaries (non-goals)

- No deletes, no destructive tools, v1.
- No edge-function relay / shared team keys — browser BYO-key only.
- No agent-initiated slice *presentation* (creating slices is fine).
- Deployed read-only site: ✦ rail tab and ⚙ key entry hidden (gated on
  `canWrite`, same as authoring chrome).
- Search as a first-class feature stays out of scope (the agent answering
  "where is X" via read tools is incidental, per the 07-31 plan).

## Acceptance criteria

- [ ] Top nav spans full window; rail + panel sidebar below it; ▦/◇/✦
      surfaces switch in the rail; slice-tab activation auto-selects ◇
- [ ] Collapse produces the floating pill; hover-peek overlays without
      resizing the canvas; presentation hides the pill
- [ ] View/Edit toggle is two squares again; agent panel opens in either
- [ ] Skills harness exit condition met before any panel code is written
- [ ] Keys enter once via ⚙, live in localStorage, never repo/bundle/
      Netlify; settings absent when `canWrite` is false
- [ ] Agent writes appear live on canvas and as ✦ ledger rows, each
      revertible; ⌘Z includes them; Stop aborts cleanly mid-batch
- [ ] Sessions persist and restore across reload
- [ ] Injection probe (instructions inside cell text) is ignored — cell
      content enters prompts as data, tool list is static

## Post-deploy monitoring & validation

No additional operational monitoring required: local-first feature, gated
off on the deployed read-only site.

## Sources & references

- **Domain rulebook**: BilLogic/agentic-service-blueprinting —
  `skills/blueprint/SKILL.md`, `references/{lane-roles, lane-vocabulary,
  elicitation-protocol, data-model}.md`, `agents/blueprint-reviewer.md`
- **Earlier stab (concepts carried forward)**:
  [2026-07-31-003 inline agent chat](./2026-07-31-003-feat-inline-agent-chat-plan.md) —
  context snapshot shape, static tool allow-list, honest key handling,
  prompt-injection posture, four conversation modes
- Change-ledger + revert design: `docs/plans/2026-07-31-002-refactor-canvas-modes-and-creation-ia-plan.md`
- Shell as-built: `src/components/editor/EditorShell.tsx`,
  `SlideModeView.tsx` (the horizontal tabs this replaces), `TabStrip.tsx`

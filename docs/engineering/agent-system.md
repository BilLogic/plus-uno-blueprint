---
audience: developers
summary: The in-app canvas agent — loop, rounds and batch etiquette, tier and mobile rosters, system-prompt assembly, UI bridge, sessions, and the pinned-package contract the rulebook arrives through.
sources: src/lib/agent/loop.ts, src/lib/agent/skills.ts, src/lib/agent/uiBridge.ts, src/lib/agent/uiCommands.ts, src/lib/agent/sessions.ts, src/lib/agent/persistence.ts, src/lib/agent/role.md
last-reviewed: 2026-08-26
---

# The in-app agent

A chat panel (✦) that drives the same canvas the human sees, through a
fixed tool allow-list. Everything below lives in `src/lib/agent/`. The
tool surface itself — specs, rosters, adding a tool, the eval harness —
is [agent-tools](agent-tools.md); the lay explanation for the team is
`product/04-the-assistant-and-audits.md`.

## The loop

`sendToAgent` in `src/lib/agent/loop.ts`: send → assistant text lands in
the transcript, tool calls dispatch onto the real wrappers → results feed
back → repeat until the model stops, the human hits Stop, or `MAX_ROUNDS`
(the constant in `loop.ts`) is exhausted. Load-bearing details, each with
its why in the code:

- **Batch etiquette is enforced, not hoped for**: after
  `WRITE_BATCH_LIMIT` (8) writes in one send, further writes bounce with a
  check-in instruction. The counter resets per user message — "continue"
  IS the check-in.
- **Stop is transcript-safe**: aborting mid-batch answers every
  undispatched tool call with a stopped marker before bailing, because a
  transcript with an unanswered tool call poisons the session on every
  provider. Whatever already landed stays — revertible from the change
  sheet.
- **What counts as a write** is one predicate: `WRITE_TOOL_NAMES` plus any
  `ui_command` whose command declares `mutates` (undo reverts through
  delete RPCs, so it is batch-limited and refused for viewers like any
  write).

## Tiers and the mobile roster

Two independent gates, both UX — the RPC tier guards and RLS are the wall
([access-and-security](access-and-security.md)):

- **Session tier**: a non-service session gets no write tools — specs are
  filtered from the request, a stray call is refused with an explanation,
  and RLS would reject it anyway.
- **Mobile**: the mobile shell is view-only for every tier, service
  accounts included. The agent gets `MOBILE_READ_TOOL_NAMES` and nothing
  else, re-sampled **every round** — a tablet rotated across the
  breakpoint mid-run must not keep a stale roster. Only one tier/mobile
  system-prompt paragraph speaks per send (they disagree about
  annotations).

## System prompt assembly

Built fresh every round by `buildSystem` (`loop.ts`):

1. `src/lib/agent/role.md` — the service-designer posture. One file, two
   loaders: `?raw` in the app, `readFileSync` in the eval harness, so
   there is no copy to drift.
2. `canvas-adapter.md` embedded in full — the plugin rulebook's
   translation to this app's tools. The deeper references sit behind the
   `get_reference` tool instead (runtime progressive disclosure).
3. The active skill's SKILL.md, when the message invoked one, plus a
   framing note: canvas agent, not IDE agent — skip file/script mechanics,
   keep the judgment.
4. Live context: the caller's context note + `collectAgentUiContext()` —
   rebuilt per round because the agent's own navigation moves the canvas
   mid-conversation.

## Hands on the UI

Two module-level seams, both deliberately non-React:

- **`uiBridge.ts`** — navigation and semantic camera focus: the shell registers
  `selectPhase`/`selectScenario`/sidebar callbacks; the active viewport
  registers its focus operation. `focus_cell` awaits a real
  completed/missed/cancelled outcome instead of claiming a transformed-canvas
  scroll. `open_cell_panel` waits for that focus, drives the *same ⌘-click
  handler the human uses*, and verifies the panel actually mounted — no
  parallel data path to drift.
- **`uiCommands.ts`** — the no-blind-spots registry: every UI control the
  agent should reach registers one named command from the component that
  owns its state. Commands appear and disappear with their surfaces, so
  `list_ui_commands` is live truth and a missing registration is a visible
  gap, not a silent one. Registration is ~3 lines; do it when you ship a
  control.
- **Canvas commands** — the active viewport exposes `canvas_camera` (relative
  pan, zoom, fit, cancel) and the annotation owner exposes `set_canvas_tool`.
  Agents call semantic primitives rather than synthesizing touch/mouse streams;
  `get_ui_state` reports live camera, mode, and tool state.
- **Context contributors** — surfaces register `registerAgentUiContext`
  snippets so the prompt's "current context" reflects what is on screen.

## Sessions and persistence

- Transcripts live in a module store in `loop.ts` (the panel can unmount
  freely; see `placement.ts` for why the chat moves between mount points).
- Session list: `sessions.ts` — localStorage always, write-through to
  `agent_sessions` when authenticated, merged on boot.
- Transcript persistence: `persistence.ts` — best-effort write-through to
  `agent_messages`; anon sessions fail quietly by design. Rehydration
  rebuilds only user/assistant text turns — tool rounds are display
  history, not replay material.
- Provider adapters (`providers/`): Anthropic, Google, OpenAI behind one
  interface. API keys are entered in the ⚙ panel and live in browser
  storage (`settings.ts`) — never in the repo or deploy env.

## Skills and the pinned-package contract

The slash commands (`/sb:map`, `/sb:slice`, `/sb:audit`, `/sb:whatif`,
plus bare aliases — `skills.ts`) load the **same SKILL.md files IDE humans
get** from the `sb` plugin. Not a copy of them — the files themselves.
The contract:

- **Canonical home**: the `agentic-service-blueprinting` repo. Skills and
  references are authored THERE, never in this repo.
- **How the app reads them**: `agentic-service-blueprinting` is a
  dependency, pinned by git URL at a tagged release
  (`package.json`; the lockfile pins the resolved commit). `skills.ts`
  imports `skills/<name>/SKILL.md?raw`; `read.ts` imports the eighteen
  references from `references/` and `skills/<name>/references/` and serves
  them through `get_reference`. `scripts/agent-harness/run.mjs` resolves
  the same files off the same install, so the harness and the app cannot
  disagree about what the agent read.
- **How it updates**: bump the pin. Nothing here is editable in a way that
  sticks, which is the point — there is no second copy to fork.
- **What guards it**: `npm ci`. An unresolvable or missing dependency
  fails every job. There is no sync script and no drift check, because
  there is no longer anything to compare. `scripts/sync-agent-skill.mjs`
  was deleted: its `--check` exited 0 when the sibling checkout was
  absent, so it gated nothing, and by the time that was noticed the drift
  had inverted — a vocabulary rename had landed in the vendored copy and a
  sync would have reverted it.
- **Instance code still merges, not installs.** This repo and
  `agentic-service-blueprinting` **share history** (the graft in #105), so
  upstream *code* changes arrive as an ordinary `git merge template/main`.
  A handful of paths must never arrive that way — this instance's
  migrations, its blueprint data, its generated database types, its agent
  persona — and `npm run check:template-quarantine`
  (`scripts/template-quarantine.json`, CI:
  `.github/workflows/template-quarantine.yml`) fails the merge that takes
  the package's version of one. The rulebook is no longer among the files
  that merge; it installs.
- Adding a reference means adding it upstream, bumping the pin, and
  updating `referenceNames.ts` — `read.ts` asserts the record matches the
  name list at module init, so a miss fails the first test that touches
  the tools.

⚠ **The pinned rulebook and this app's tool surface have diverged.** The
package's `canvas-adapter.md` is normative for the canvas agent and names
the package's own registry: `read_reference`, `list_scenarios`,
`record_finding`, `set_finding_status`, `add_step`, `add_lane`,
`update_cell_content`, `update_cell_spec`, `set_cell_dependency`. This
app has `get_reference`, `list_blueprint`, `search_blueprint`,
`create_finding`, `update_finding`, `create_step`, `create_lane`,
`update_cell`, `create_cell_dependency`. It also says
"trigger-vs-needs semantics" where this instance's constraint is
`check (kind in ('leads_to','enables'))` (migration
`20260820180000_sets_off_becomes_leads_to.sql`). Each tool's own
description carries the real binding rules and the adapter says to trust
them over memory, so the agent is not blind — but the adapter's two
"FULL surface" rows are wrong here until either the tool names converge or
the adapter is written instance-neutral. Do not fix it by re-vendoring.

Known follow-ups for the whole agent subsystem are tracked in
`todos/021-pending-p2-agent-harness-review-followups.md`.

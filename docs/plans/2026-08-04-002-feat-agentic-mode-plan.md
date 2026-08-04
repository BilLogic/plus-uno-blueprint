---
title: 'feat: agentic mode — the third posture'
type: feat
status: active
date: 2026-08-04
---

# Agentic mode — the third posture

## Overview

View reads. Edit writes. **Agent converses** — a third mode where a model
holds the same pen the human holds: it authors through the same RPCs, its
changes land in the same session sheet, each row individually revertible,
all of it behind the same Save gate. The agent proposes by *doing*, and the
human keeps the veto.

Why now: everything an agent needs to be safe just shipped. One write path
(`authoringRpc.call()`), a session log that records only writes that landed,
per-row revert with captured inverses, ⌘Z, and a review-then-save popup.
None of that was built *for* the agent, and all of it is exactly the
containment an agent requires.

## Problem statement

Blueprinting is transcription-heavy: interview notes, board sweeps and
transcripts become cells one click at a time. The Ecoeled dogfood showed the
bottleneck is not deciding what the blueprint says — it is typing it in.
An agent that drafts structure from prose, fills specs, proposes slices and
answers "where do tutors touch PLUS App?" turns hours of transcription into
minutes of review.

## The UI, before the code

### The mode toggle grows a third square

```
                 bottom toolbar
┌──────────────────────────────────────────────────┐
│  ▷  ✋  ◇ Make slice        ┌────┬────┬────┐      │
│                             │ 👁 │ ✎  │ ✦  │      │
│                             └────┴────┴────┘      │
│                              View Edit Agent      │
└──────────────────────────────────────────────────┘
```

Same track-and-raised-square control. **Agent mode is Edit mode plus the
agent panel** — every Edit affordance stays live (the human can edit
mid-conversation), and leaving Agent mode closes the panel but keeps the
session.

### The agent panel — left side, opposite the cell panel

The one-right-panel rule survives: cell details keep the right edge, the
agent docks left. Both can be open at once — "look at this cell" while the
agent talks about it is the normal case.

```
┌────────┬──────────────────────────────────────────────┬──────────┐
│sidebar │                 canvas                       │          │
│        │   ┌──────────────────────────────────┐       │  (cell   │
│        │   │        blueprint grid            │       │  detail  │
│        │   │   ┌╌╌╌╌╌╌╌┐                      │       │  panel,  │
│        │   │   │ cell  │ ← agent-touched cells │       │  as      │
│        │   │   └╌╌╌╌╌╌╌┘   pulse briefly       │       │  today)  │
│        │   └──────────────────────────────────┘       │          │
│┌───────┴────────────────────┐                         │          │
││ ✦ Agent      [session ▾] ✕ │                         │          │
│├────────────────────────────┤                         │          │
││ ▸ Draft the Warm-Up        │  ← session list         │          │
││ ▸ Fill specs for tech lane │    (collapsed here)     │          │
│├────────────────────────────┤                         │          │
││ You: turn these interview  │                         │          │
││ notes into a Help Request  │                         │          │
││ scenario …                 │                         │          │
││                            │                         │          │
││ ✦: I'll add 6 steps and    │                         │          │
││ fill 3 lanes. Working…     │                         │          │
││  ├─ ✔ Added step "Reach    │  ← tool calls render    │          │
││  │    out"                 │    as change rows,      │          │
││  ├─ ✔ Added a cell   [↺]   │    same vocabulary as   │          │
││  └─ ⋯ Adding a cell        │    the session sheet    │          │
│├────────────────────────────┤                         │          │
││ ⏹ Stop   [message……] [➤]  │                         │          │
│└────────────────────────────┘                         │          │
└────────┬───────────────────────────────────┬──────────┘          │
         │ ▷ ✋ ◇ │ ⏺ Save changes (9) │ 👁 ✎ ✦ │                   │
         └───────────────────────────────────┴─────────────────────┘
```

### The shared ledger — one change sheet, two authors

```
┌ Save changes (9) ────────────────────────────┐
│ 9 unsaved changes                            │
│ Already saved to the database — this list    │
│ is how you can still take them back.         │
├──────────────────────────────────────────────┤
│ HELP REQUEST · HAPPY PATH                    │
│   ✦ Added step "Reach out"            ⌖  ↺  │
│   ✦ Added a cell                      ⌖  ↺  │
│   ✦ Edited a cell's text              ⌖  ↺  │
│      Added lane "QA"                  ⌖  ↺  │  ← human row, no badge
├──────────────────────────────────────────────┤
│ Everything can still be found in the list.   │
│                            [ ✔ Keep all ]    │
└──────────────────────────────────────────────┘
```

The agent's rows carry a ✦ badge; nothing else about them differs. Revert
one agent change without touching your own, or ⌘Z through the lot. **This
is the entire safety model, and it is already built** — the only new part
is the badge (`recordChange` gains an `author: 'human' | 'agent'` field).

### Sessions

A session = one conversation + the change-set it produced.

```
┌ ✦ Agent ────────────────── [ + New session ] ┐
│ ● Draft the Warm-Up scenario      12 changes │   ← active
│ ○ Fill specs for tech lane         4 changes │
│ ○ Q&A about Discovery              0 changes │
└──────────────────────────────────────────────┘
```

- Sessions persist (tables below); reopening one restores the transcript.
- "N changes" links a session to its `recordChange` entries via a
  `session_id` stamped on each entry while that session is active.
- A session with 0 changes is just a conversation — Q&A is a first-class
  use, not a failure to edit.

## Technical approach

### Providers: BYO key, three out of the box

Google (Gemini), Anthropic (Claude), OpenAI — one thin adapter each behind
one interface. Deliberately no more: anyone needing another provider can
vibe-code a fourth adapter against the same interface.

```ts
// src/lib/agent/provider.ts
export type AgentProvider = {
  id: 'google' | 'anthropic' | 'openai'
  /** Streamed chat with tool-calling; yields text deltas and tool calls. */
  chat(input: {
    system: string
    messages: AgentMessage[]
    tools: ToolSpec[]
    apiKey: string
    model: string
    signal: AbortSignal
  }): AsyncIterable<AgentEvent>
}
```

- All three support browser CORS (Anthropic via the
  `anthropic-dangerous-direct-browser-access: true` header).
- **Key storage: `localStorage`, per provider, never the repo, never
  Netlify env.** Settings popover on the agent panel: provider picker,
  model picker (sensible defaults: `gemini-2.5-pro`, `claude-sonnet-4-5`,
  `gpt-4o`), key field with paste-and-forget UX (masked after save).
- v1 runs **entirely in the browser**: the key talks straight to the
  provider, the tool results come from the same authenticated Supabase
  session the human uses. No server component, no key custody problem.
  A Supabase edge-function relay is a later phase *if* team key-sharing is
  ever wanted — explicitly out of scope now.

### The tool loop

```
user message
   │
   ▼
provider.chat(system, messages, TOOLS) ──► text deltas → transcript
   │                                        tool_use   → dispatch
   ▼
dispatch(tool, args)
   ├─ read tools  → snapshot/query helpers (no session-log entries)
   └─ write tools → the SAME wrappers the UI calls:
                    addStep / addLane / upsertCell / updateCellContent /
                    updateCellSpec / setCellDependency / createSlice /
                    renamePath / duplicatePath …
                    → recordChange (author: 'agent', session_id)
                    → invalidateQueries → canvas updates live
   │
   ▼
tool result → back into provider.chat → loop until done / Stop
```

- **Write tools are the existing wrappers, not new endpoints.** RLS,
  validation, session logging and revert capture all come for free.
- Deletes: v1 exposes NO delete tools. The agent adds and edits; removal
  stays human. (Deletes have no per-row revert — the agent does not get
  the one irreversible verb.)
- Read tools: `get_blueprint(scenario)` returning a compact text snapshot
  (steps × lanes × cell text), `list_scenarios()`, `get_cell(id)`,
  `list_slices()`. Compact on purpose — the whole lifecycle is ~500 cells
  and fits in any context window.
- Stop button aborts via `AbortSignal`; whatever landed stays in the
  sheet, revertible.

### Persistence

```sql
create table agent_sessions (
  id uuid primary key default gen_random_uuid(),
  service_lifecycle_id uuid references service_lifecycles not null,
  title text not null default 'New session',   -- first-message summary later
  provider text not null,
  model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table agent_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references agent_sessions on delete cascade not null,
  role text not null check (role in ('user','assistant','tool')),
  content jsonb not null,          -- text | tool_use | tool_result blocks
  created_at timestamptz not null default now()
);
-- RLS: authenticated read/write, anon none. Same posture as authoring.
```

`recordChange` entries stay in-memory as today; they gain
`author?: 'human' | 'agent'` and `agentSessionId?: string` for the badge
and the per-session change count. (Persisting the ledger itself is a
separate, later decision.)

### System prompt (sketch)

The agent is a *service designer's assistant*, told: the schema vocabulary
(phase → scenario → path → step/lane → cell; slices), the house rules
(cells are born with text; owner values are tags — read the vocabulary
before inventing one; `needs` vs `trigger`), and the contract (small
batches; narrate what you are about to do; never delete).

## Implementation units

1. **Provider adapters + settings** — `src/lib/agent/{provider,google,anthropic,openai}.ts`,
   key settings popover, localStorage. Verify: each adapter streams a
   hello-world with a dummy tool. *(Patterns: OwnerTagSelect popover;
   supabase.ts env handling for "configured vs not".)*
2. **Tool registry** — read snapshots + write wrappers with JSON-schema
   specs; `author`/`agentSessionId` threading through `recordChange`.
   Verify: node tests on snapshot shape + a mocked tool round-trip.
3. **Mode + panel shell** — third toggle square, docked left panel,
   session list, transcript rendering (text + tool rows reusing
   `describeChange`), Stop. *(Patterns: CanvasAnnotationToolbar segments;
   SessionChangesSheet rows.)*
4. **Sessions persistence** — migration above, load/save messages,
   session switcher. Verify: reload restores transcript.
5. **Ledger badges** — ✦ on agent rows in the change sheet, per-session
   change counts, canvas pulse on agent-touched cells (reuse the
   invalidate → refetch path; pulse via a transient id set).
6. **Live e2e** — with the user's Gemini key: "add a QA lane to Warm-Up
   and describe it" → lane appears, sheet shows ✦ rows, revert works.

## Scope boundaries (non-goals)

- No deletes, no destructive tools, v1.
- No edge-function relay / shared team keys — browser BYO-key only.
- No agent-initiated slices *presentation* (it may create slices; it does
  not present them).
- Deployed site: agent mode hides — writes require the authenticated dev
  session, and the deployed app is read-only by decision. Local-first
  feature for now.

## Acceptance criteria

- [ ] Three-square toggle; Agent = Edit + panel; mode persists across
      surfaces like the other two
- [ ] Keys for Google/Anthropic/OpenAI enter once, live in localStorage,
      never appear in the repo, bundle, or network logs beyond the
      provider call itself
- [ ] Agent writes appear on the canvas live and in the change sheet as
      ✦ rows, each revertible; ⌘Z includes them
- [ ] Stop aborts mid-batch cleanly; partial work stays and is revertible
- [ ] Sessions persist and restore across reload
- [ ] A cancelled/failed provider call leaves no phantom ledger rows

## Post-deploy monitoring & validation

No additional operational monitoring required: local-first feature, gated
off on the deployed read-only site.

## Sources & references

- Change-ledger + revert design: `docs/plans/2026-07-31-002-refactor-canvas-modes-and-creation-ia-plan.md`
- Undo/RLS groundwork: `docs/plans/2026-07-30-004-feat-blueprint-authoring-in-design-mode-plan.md`
- Tool-surface prior art: the service-blueprint skill plan (memory:
  `service-blueprint-skill-plan`) — same RPC vocabulary, different caller
- This session: panel-first drafts, per-row revert, ⌘Z, review-then-save —
  the containment the agent inherits

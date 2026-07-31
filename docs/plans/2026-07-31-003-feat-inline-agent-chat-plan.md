---
title: "An inline agent in the canvas"
type: feat
status: draft — side project, not prioritised
date: 2026-07-31
---

# An inline agent in the canvas

Plan only. Nothing here is built, and it is explicitly **not next** — a side
project to pick up later.

Companion to
[2026-07-31-002 canvas modes and creation IA](./2026-07-31-002-refactor-canvas-modes-and-creation-ia-plan.md),
which decided where creation lives. That plan reaches a limit it cannot solve
on its own, and this is the solution to it.

---

## Why this is not a bolt-on

Plan 002 sorts creation by what a thing needs in order to exist:

| Needs | Surface | Creates |
|---|---|---|
| a parent | sidebar `+` | phase, blueprint, path, slice |
| a position | canvas handle | step, lane, cell |
| **a sentence** | **this plan** | any of them, described |

The third row exists because some instructions are not expressible as a click.
*"Add a step after Discovers PLUS on the tech lane"* names a parent, a
position, and an intent in one breath. A menu can offer the verb; only the
canvas can supply the position; neither can take the whole sentence. That is
the gap.

The second reason is narrower and more practical: **the round trip to an IDE**.
Reading a blueprint and wanting to change one thing currently means leaving the
canvas, finding the row, and coming back. For an artefact whose entire value is
being looked at, that is the wrong shape.

---

## What it is not

Worth fixing early, because agent features drift into these by default.

- **Not a SQL console.** It calls the same sixteen `security definer` RPCs the
  UI calls, and nothing else. It cannot express a shape the app could not have
  produced, which is the whole reason the write surface was built as operations
  rather than table grants.
- **Not autonomous.** It proposes; a human applies. There is no setting that
  turns that off in v1.
- **Not a search box.** Search over blueprints is out of scope
  (*"let's scope out searching for now"*), even though the agent will
  incidentally be able to answer "where is X".
- **Not privileged.** It runs as the signed-in user through the same RLS. An
  agent that could do more than the person driving it would be a second,
  unaudited write path.

---

## Where it lives

A bar in the bottom nav, in all three modes. Collapsed it is a placeholder;
focused it grows **upward** into a panel over the canvas, so the canvas stays
the subject of the conversation rather than being pushed off screen.

```
collapsed                          focused
┌────────────────────┐   ┌──────────────────────────────────┐
│ 💬 Ask anything…   │   │  ▸ You                           │
└────────────────────┘   │    add a step after Discovers    │
                         │    PLUS on the tech lane         │
                         │                                  │
                         │  ▾ Agent                     ⏵   │
                         │    I'll add one step to Discovery│
                         │    / Happy Path, after column 2. │
                         │                                  │
                         │    ┌────────────────────────┐    │
                         │    │ add_step               │    │
                         │    │   path  Happy Path     │    │
                         │    │   name  (untitled)     │    │
                         │    │   after column 2       │    │
                         │    └────────────────────────┘    │
                         │        [ Apply ]  [ Discard ]    │
                         ├──────────────────────────────────┤
                         │ 💬 …                    ⏎ send   │
                         └──────────────────────────────────┘
```

The panel is **not modal**. The canvas stays live underneath, because half the
answers are things you look at while reading the reply, and because the agent
may have moved the camera to show you something.

---

## The four conversation modes

Not a picker. Inferred from the sentence, and **named in the reply** so it is
always visible which one was chosen — a wrong inference should be obvious
before it matters, not after.

### 1. Ask — reads, writes nothing

```
You    what does this cell actually do?

Agent  ⟨ask⟩
       "Marks student present" sits on Regular Tutor at step 5 of
       Warm-Up / Happy Path. It's triggered by the PLUS App cell on
       the same step, and three slices include it.
       ↳ no changes proposed
```

### 2. Navigate — moves the camera, changes no data

```
You    take me to the goal setting edge case

Agent  ⟨navigate⟩
       Goal Setting has five paths. Which?
       [ Set Goals ] [ Check Goals ] [ Update Goals ]
       [ Set Goals — edge case ] [ Updated Goals — edge case ]

You    the last one

Agent  ✓ opened Goal Setting / Updated Goals edge case
```

Ambiguity is answered with buttons rather than a guess. Five paths share a
`path_type` of `named`, so "the edge case" genuinely does not identify one —
and picking silently would teach the wrong lesson about how much it knows.

### 3. Build — proposes, never applies unasked

```
You    make a slice of everything the tutor touches in warm-up

Agent  ⟨build⟩
       14 cells on the Regular Tutor lane across 8 steps.
       ┌──────────────────────────────────────┐
       │ create_slice                         │
       │   title   Tutor warm-up journey      │
       │   type    journey                    │
       │   frames  8  (one per step)          │
       └──────────────────────────────────────┘
       [ Apply ]  [ Edit frames first ]  [ Discard ]
```

Destructive proposals read `deletion_impact` first and render it before Apply
is offered at all — the same numbers, the same wording, the same typed-name
gate the dialog already uses:

```
Agent  ⟨build — destructive⟩
       Deleting this path removes 43 cells.
       34 arrows connected to those cells will go with them.
       7 slices will lose frames: "The mark present moment", …

       Type  Happy Path  to confirm       [ ____________ ]
                                       [ Delete ] [ Discard ]
```

Multi-step proposals are shown as a list and applied in order, stopping at the
first failure with everything before it already applied — the RPCs are each
atomic, but a *sequence* of them is not, and pretending otherwise would be the
one place this could quietly corrupt a grid.

### 4. Read the screen — the marks become the message

```
        canvas                              chat
   ┌──────────────────┐        You    ⟨2 marks attached⟩
   │  ▢ ───┐          │               why is this one late?
   │       │ "late?"  │
   │  ▢ ◯◯◯┘          │        Agent  ⟨ask — with marks⟩
   │                  │               You circled "Tutor supervisor
   └──────────────────┘               reviews" and boxed the step
                                      before it…
```

Marks inside the viewport are attached automatically, with a chip so it is
visible that they were sent. What travels is the **structured annotation
list plus the cells it overlaps** — not a screenshot. Geometry the app already
has resolves to cell ids far more reliably than an image would, costs a
fraction as much, and never sends anything the user cannot see listed.

**Prerequisite:** annotations are `useState` today
(`CanvasAnnotationProvider.tsx:27`) and vanish on reload. Plan 002 Phase 7
persists them; this mode cannot ship before that.

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  AgentChatBar          bottom nav, all modes               │
└──────────────┬─────────────────────────────────────────────┘
               │  message + context snapshot
               ▼
┌────────────────────────────────────────────────────────────┐
│  useAgentSession                                           │
│   · conversation state                                     │
│   · builds the context snapshot (below)                    │
│   · holds proposals awaiting Apply                         │
└──────┬──────────────────────────────────┬──────────────────┘
       │                                  │
       ▼                                  ▼
┌──────────────────────┐        ┌──────────────────────────┐
│  provider adapter    │        │  agentTools.ts           │
│   gemini.ts          │        │   the RPC allow-list,    │
│   (openai.ts later)  │        │   one entry per function │
└──────────────────────┘        └────────────┬─────────────┘
                                             ▼
                                  ┌──────────────────────┐
                                  │  authoringRpc.ts     │
                                  │  (already exists)    │
                                  └──────────────────────┘
```

`agentTools.ts` is the security boundary and the only new trust surface. It is
a **static list** — each entry names one existing function in
`authoringRpc.ts`, its parameters, and whether it is destructive. There is no
dynamic dispatch, no table name as an argument, no free SQL. A model asking for
something not on the list gets a refusal, not an attempt.

### The context snapshot

What the agent is told about the screen, assembled client-side per message:

```ts
type AgentContext = {
  mode: 'view' | 'mark' | 'edit'
  phase?:     { id: string; name: string }
  blueprint?: { id: string; name: string }
  paths:      Array<{ id: string; name: string; pathType: string }>
  selection:  Array<{ cellId: string; label: string }>   // Edit mode picks
  visible:    Array<{ cellId: string; label: string }>   // in the viewport
  marks?:     Array<{ kind: string; overlaps: string[] }> // mode 4 only
}
```

Deliberately **labels and ids, not contents**. A 737-cell blueprint does not
fit in a prompt and should not try to; the agent asks for what it needs through
a read tool rather than being handed everything on the chance it is relevant.

---

## Configuration

Sidebar bottom → `⚙ Settings` → popup.

```
┌────────────────────────────────────────────┐
│  Agent                                     │
│                                            │
│  Provider   ( Google Gemini  ⌄ )           │
│  API key    [ ●●●●●●●●●●●●●●●●●● ]  Paste  │
│             stored in this browser only    │
│                                            │
│  ⚠ A key kept in the browser is readable   │
│    by anyone with developer tools on this  │
│    machine. Use a personal key, not a      │
│    shared or production one.               │
│                                            │
│  Writes     ( Always ask before applying ⌄)│
│                                            │
│              [ Cancel ]   [ Save ]         │
└────────────────────────────────────────────┘
```

Google Gemini first because a key is available. The provider is a dropdown from
day one so the second one is a new file rather than a refactor.

### Key handling — the honest version

- The key is **pasted at runtime into `localStorage`**. It never enters the
  repository, the bundle, a `.env`, or a Netlify variable.
- A browser-held key is readable by anyone with devtools on that machine. The
  dialog says so in those words rather than implying a safety it does not have.
- The settings entry is gated on the same `canWrite` the authoring surfaces
  use, so the deployed read-only site does not offer it at all.
- **Upgrade path:** a Netlify function holding the key server-side, with the
  browser sending only the message. Listed under Future, not built in v1 —
  v1 is one person using their own key.

---

## Implementation phases

**Phase 1 — the shell.** `AgentChatBar` in the bottom nav, settings popup, key
in `localStorage`, provider adapter for Gemini. No tools: **Ask only**, and
only about the context snapshot. Ships something usable and proves the loop.

**Phase 2 — Navigate.** Two read tools — resolve a name to a blueprint or path,
and move the camera. Reuses `selectScenario` / `selectPhase` from
`EditorContext`. Still writes nothing.

**Phase 3 — Build, non-destructive.** `agentTools.ts` with the creating half of
the RPC list. Proposal cards, Apply / Discard, multi-step sequences with
stop-on-first-failure.

**Phase 4 — Build, destructive.** Deletes, behind `deletion_impact` and the
typed-name gate. Separate phase on purpose: the guardrail ships before the
capability, the same ordering rule the delete affordance already follows.

**Phase 5 — Read the screen.** Requires plan 002 Phase 7 (annotation
persistence). Marks attached with an explicit chip.

---

## Acceptance criteria

- [ ] No change reaches the database without an explicit Apply
- [ ] Every write goes through `authoringRpc.ts`; no new query path exists
- [ ] A request for a function not in `agentTools.ts` is refused, not attempted
- [ ] Destructive proposals show `deletion_impact` before Apply is offered
- [ ] Destructive proposals require the typed name, as the dialog does
- [ ] A multi-step sequence that fails midway reports what was applied
- [ ] The chosen conversation mode is visible in every reply
- [ ] The API key never appears in the repo, the bundle, or a Netlify variable
- [ ] The settings entry is absent for sessions that cannot write
- [ ] Attached marks are listed in the message, never sent invisibly
- [ ] The agent can do nothing the signed-in user could not do by hand

---

## Risks

**A valid operation that is a bad idea.** The agent can propose something the
schema accepts and a human would not want. Mitigation: propose-then-apply, with
the existing confirms. It has no privilege the user lacks.

**Prompt injection from blueprint content.** Cell text is user data and could
contain instructions. Mitigation: content enters the prompt as data with an
explicit boundary, tool calls are allow-listed, and every write needs a human
Apply — so the worst case is a proposal that gets discarded.

**Silent context drift.** The user moves the camera mid-conversation and the
agent answers about the old screen. Mitigation: the snapshot is rebuilt per
message and the reply names what it looked at.

**Cost.** A 737-cell blueprint would be expensive to send whole. Mitigation:
labels and ids only, with reads on request.

**Scope creep into an IDE.** The stated goal is *not needing* the IDE for small
things, not replacing it. If a request needs a migration, the right answer is
to say so.

---

## Future

- Server-side key via a Netlify function
- A second provider, to prove the adapter
- Streaming replies
- Multi-turn refinement of a proposal before Apply
- Search, once it exists as a first-class feature

---

## Open questions

1. **Does the agent read cell *contents*, or only labels?** Contents make the
   answers much better and the prompts much larger.
2. **Is the conversation persisted?** Per-session in memory is simplest; a
   saved thread per blueprint would be more useful and is a new table.
3. **One agent, or one per surface?** A slice tab and the base canvas hold
   their own canvas mode already — should they hold their own conversation?
4. **Apply granularity for sequences** — all-or-nothing with a client-side undo,
   or step-by-step as specced?

---

## Sources

- [2026-07-31-002 canvas modes and creation IA](./2026-07-31-002-refactor-canvas-modes-and-creation-ia-plan.md) — the third creation surface, and Phase 7's annotation persistence
- [2026-07-30-004 blueprint authoring](./2026-07-30-004-feat-blueprint-authoring-in-design-mode-plan.md) — the write architecture this reuses
- `src/lib/authoringRpc.ts` — the sixteen operations, live and smoke-tested
- `src/lib/deletionSafety.ts` — `deletionReadiness`, `describeImpact`, `confirmationMatches`
- `src/contexts/CanvasAnnotationProvider.tsx:27` — annotations are unsaved state
- `src/contexts/SupabaseProvider.tsx:80` — `canWrite`, which gates the settings entry

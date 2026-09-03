---
audience: designers, developers
summary: One conversation in two postures — the dock and the float, what survives a drag, where transcripts and settings live, the mobile sheet and fab, and the two limits the UI has to say out loud.
sources: src/lib/agent/placement.ts, src/lib/agent/panelState.ts, src/lib/agent/loop.ts, src/lib/agent/sessions.ts, src/lib/agent/persistence.ts, src/lib/agent/settings.ts, src/components/editor/AgentDock.tsx, src/components/editor/AgentPanel.tsx
claims:
  - src/components/editor/AgentDock.tsx
  - src/components/editor/AgentMarkdown.tsx
  - src/components/editor/AgentPanel.tsx
  - src/components/editor/AdminSessionFields.tsx
  - src/components/editor/AgentProviderFields.tsx
  - src/components/editor/AgentScopeField.tsx
  - src/components/editor/AgentSettingsFields.tsx
  - src/components/mobile/MobileAgentFab.tsx
  - src/components/mobile/MobileAgentSheet.tsx
  - src/components/mobile/mobileAgentBridge.ts
last-reviewed: 2026-08-26
---

# Agent session

## One surface, two postures

**Docked** puts the chat under the active sidebar panel — chat while the
blueprint nav or the slice list stays in view, the posture people actually work
in. **Floating** lifts it over the canvas so it can sit beside the cells being
discussed. Dragging the header out of the sidebar floats it; dragging it back
over the sidebar re-docks it.

**Same conversation either way — placement never touches session state.** That
is the promise, and it is what the rest of this doc is about keeping. (The
drawer/sheet pair in
[dialogs-sheets-and-forms.md](dialogs-sheets-and-forms.md) is the other
instance of the same one-component-two-postures precedent.)

Each posture has its own mount point: docked inside the sidebar column (a
percentage of its height, under a drag divider), floating portalled to the body
so the window escapes the sidebar's clip and stacking context. Neither can
serve the other, so the shell renders `AgentDock` at both — but `AgentDock` is
a hook-free gate, and only the one whose posture is showing mounts
`AgentDockWindow`, which holds every hook. The hooks are `window`-global (a
viewport clamp, the pointer drag, the corner resize); running them on the
hidden mount point meant two clamp listeners and two drag handlers for one
window on screen. Shared chrome is a grab bar, a collapse and a close, and the
grab bar *is* the placement gesture. The float adds a border and a shadow; the
dock's drop target adds a ring — and there is deliberately **one edge treatment
at a time**, because a ring on top of a border read as a second outline.

Two details that are easy to get wrong a second time:

- **Drag state is its own module store, transient and never persisted.** The
  chat renders from two places and a drag-out flips which one is visible
  *mid-gesture*. Held as component state, the gesture belongs to the instance
  that is about to hide — which is why the drop-target ring never appeared on a
  drag-out.
- **Placement persists, but not per frame.** A drag emits on every pointermove,
  and a synchronous `JSON.stringify` plus a storage write per frame is a real
  cost for a value nobody reads until the next boot. Callers flush at the end of
  a gesture.

The float's birth geometry and minimums are tokens in `layoutTokens.ts` — how
small the corner drag may make it before the chat inside stops being usable.
They are clamped **on load**, not only on resize: a box saved on a wide monitor
would otherwise open offscreen on a laptop, and the resize listener never fires
to rescue it. The corner drag's listeners are effect-owned rather than
handler-registered, because handler-registered ones leak on unmount — closing
the chat mid-resize left an orphaned handler that resurrected the window on
every mouse move.

## What survives the move

Dragging between postures unmounts one `AgentPanel` and mounts another. Anything
held in component state dies in that gap — which meant a drag threw you back to
the session list and ate a half-typed message.

So two things live **outside** the component:

- **Transcripts** are a module store in `loop.ts`, so the panel can unmount
  freely. Every push write-throughs to the database.
- **Panel view state** — which session is open, and the per-session composer
  draft — is `panelState.ts`. The transcript already lived outside; this is the
  rest of that promise. Switching sessions keeps each draft.

The same store is why toggling ✦ (which unmounts the panel entirely) does not
drop you back to the session list.

## Sessions and persistence

localStorage is the always-there lane. When the session is authenticated, every
mutation also writes through to `agent_sessions`, and boot merges the database
list in — DB wins on shared ids, local-only rows stay and are pushed up so the
merge converges instead of forking per browser.

**The deployed read-only site runs as anon, which has no policies on these
tables, so every persistence call fails quietly and the panel keeps working from
its in-memory and localStorage stores.** That degradation is deliberate: the
agent surface never exists without write access anyway.

Two things worth carrying:

- **Rehydration rebuilds only user and assistant text turns.** Tool-call rounds
  are display history, not replay material — providers reject orphaned tool
  calls, and Gemini signatures do not survive a reload. A user turn re-splices
  its attachment payload, because an attachment's structure is conversation
  context, not chrome. Rows rehydrated from a previous browser session carry no
  payload and render flat.
- **The agent's `list_sessions` reads the session store, not the table**, and
  that is a scoping decision rather than a convenience. Until 2026-08-28 it was
  the only gate there was: `agent_sessions` carried no owner column and a
  blanket "authenticated manage agent sessions" policy, so a direct query would
  have handed the agent every user's chat history. `user_id` plus per-user RLS
  now closes that at the database, and this stays regardless — reading the store
  the session switcher reads means the agent sees exactly what the USER sees,
  which is narrower than what RLS permits.

Both loading flags are two-part on purpose — "the merge is on the wire" **and**
"the merge has not started yet, because auth is still resolving" are different
states, and the second is where the "still no skeleton" reports came from. Both
are gated on the session being able to use the agent at all, or a signed-out
panel shows skeletons forever.

Auto-titling derives a name from the first message, but only while the session
still wears the default name — a deliberate rename is never overwritten.

## Rendering the conversation

User turns are tinted bubbles on the right, agent prose is a ghost bubble, tool
calls and status lines are `Marker`s. That is the chat vocabulary the design
system ships, not a hand-rolled lookalike.

A finished run's tool and status rows fold into one "N steps" accordion, under
three rules: only runs of three or more consecutive step rows fold; the **live
tail never folds**, so streaming stays visible; and a run containing an error
**starts open** — collapsing a failure hides the thing that most needs reading.

`AgentMarkdown` restyles every block element compact, because the bubbles are
small and narrow and default browser margins read as a document rather than a
message. Headings render as bold paragraphs — a message has no document outline.
Its hardening is by omission: `remark-gfm` only, **no raw-HTML plugin**, so
model-authored HTML is not rendered; links get `rel="noreferrer"` and a new tab.
It is lazy-loaded, because it is the only importer of the markdown toolchain and
there is no reason for the landing page to pay for a parser — and the fallback is
the raw text, so a slow chunk shows content rather than a spinner. Only assistant
turns get markdown; user turns are plain pre-wrapped text.

## Settings

Provider, model and key, plus admin sign-in, behind one component with no
opinion about what frames it — the desktop rail's ⚙ popover and the phone
drawer's settings surface both use it. It lives apart from both because the
phone had no way to sign in at all before, and a second copy of an auth form is
how two sign-in flows drift apart.

Behind that one entry point are **three components, because the jobs share
nothing**: `AdminSessionFields` is the sign-in/sign-out form and every piece of
state it needs, `AgentProviderFields` is provider, model and key — one job, not
three, since the key is stored per provider and the model list is fetched with
it, and `AgentScopeField` is the creator's default search scope — which
service(s) the agent holds in scope when a question names none (active service,
or the whole deployment), so a multi-service deployment does not search
everything on every question (#337). `AgentSettingsFields` keeps only what
genuinely spans them: the column, the two headings, the rule between them, and
the `canAgent` gate that decides whether the agent half exists at all.

**Keys live in localStorage and nowhere else** — not the repo, not the bundle,
not a server env. A browser-held key is readable by anyone with devtools on the
machine, and the settings UI says so in those words rather than implying a safety
it does not have.

The store is the other canonical module-store-plus-`useSyncExternalStore`
example (`CanvasModeProvider` being the first): its snapshot is cached so the
subscription sees a stable reference between writes, and a quota failure
degrades to session-only settings. The bundled model list is a **fallback only**
— once a key is saved the dropdown lists the provider's own endpoint, so it is
current by construction, and a failed listing is silently ignored rather than
given an error state.

On the deployed site the ⚙ is the front door: sign-in always, provider/model/key
only when the session can write. RLS is still the authority; this UI only starts
a session. Show/hide the chat stays on the rail's ✦ — settings hold settings, not
surface toggles.

## The phone

A **bottom** sheet, a little over half the screen, so the canvas stays visible
behind it — 92svh read as a full-screen takeover. Panel state lives in the module
store, so open and close never drop a session.

Two shape traps are pinned in the code and worth repeating before anyone
"simplifies" them:

- The height is `min-h` **and** `max-h` at 60svh. The sheet variant's own
  `h-auto` survives tailwind-merge, so a bare `h-[60svh]` loses to it —
  content-hungry panels grew past it and a fresh empty chat shrank below it.
  **The sheet is a fixed room the conversation lives in, not a balloon.**
- The inner wrapper must be a flex column. The panel's own root only stretches
  inside a flex parent; in a block div it takes natural height and the composer
  floats mid-sheet.

The FAB is bottom-right above the safe-area inset. A full-width bottom bar was
tried and reverted — it spent a whole chrome row on one action. It is **hidden
entirely for read-only tiers**, the same rule as everywhere else in the chrome,
and it needs no open/close state because the sheet it opens covers it.

`mobileAgentBridge` is the agent's navigation hands on the phone, kept in a leaf
module so the handlers can be unit-tested without dragging the shell's import
graph in. Phase and scenario opens are plain selections — the phone shows the
same canvas as desktop, so the camera move *is* the surface change. And the
sidebar tool **says it has no sidebar**, overriding the default success claim,
rather than reporting a navigation it did not perform.

Mobile is view-only for every tier, service accounts included, and the roster is
**re-sampled every round**: a run spans many tool rounds, and a tablet rotated
across the breakpoint mid-run must not keep a roster the shell on screen no
longer matches.

## The agent's ink

The agent's canvas annotations draw in a deliberate attention-red that no human
swatch offers, so "the agent drew this" is legible at a glance. It is still a
**token**, so dark mode follows and a screen reader hears "Red" rather than
"Custom". Human swatch sets are built from the annotation families at fixed
steps, which is what reserves that step by construction. See
[foundations/color.md](../foundations/color.md).

## Two limits the UI has to say out loud

**The round budget.** A run gets a fixed number of tool rounds. When it runs out
with calls still flowing, the model does not know its turn was truncated — a
silent stop leaves the user's next "continue" landing on a model that thinks it
was mid-work. So the model gets a system turn telling it the budget is exhausted
and one no-tools round to close out from what it already learned, and the user
gets a status row: *"Stopped after the round limit — send a message to
continue."*

**The write batch limit.** After eight writes in one send, further writes bounce
with a check-in instruction; the counter resets per user message, so sending
"keep going" *is* the check-in. The bounced call comes back as a tool error the
model can read, and the UI gets **one** status row per round however many calls
bounced — six identical "Paused" rows read as a stutter, not a pause. A write
that failed changed nothing and does not eat batch budget.

Stopping by hand says the same kind of thing: *"Stopped. Whatever already landed
is in the change sheet, revertible."* Which is the honest description of the
model throughout — whatever landed, landed, and
[the change sheet](dialogs-sheets-and-forms.md#sessionchangessheet--review-then-commit)
is the way back.

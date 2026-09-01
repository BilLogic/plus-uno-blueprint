---
status: accepted
audience: developers
summary: The shell's entrance stagger and the canvas's reveal ladder are two clocks on purpose, joined by reads that run one way only; a surface that owns its own query takes its own hold session, and still waits for the lane it arrives beside.
---

# The canvas and the shell run on separate clocks

The shell stages its own arrival: the aside commits its width, then the parts
of the sidebar fade in behind one another. The canvas runs a separate ladder of
reveal rungs and publishes which rung it is on. They meet only by **reading**:
the shell reads that rung to decide when to lift the sidebar's boot lane, and
the identity bar above the canvas reads the lane to decide when its own
skeleton may end. Every link points the same way and nothing reads back.

The five words for the phases of arrival are defined in
[CONTEXT.md](../../CONTEXT.md#five-words-for-arrival). How the shell's half is
wired is written where it is wired, in `src/components/editor/EditorShell.tsx`,
and is deliberately not repeated here: a rule kept in two places is how this
repository has drifted from itself before. What this record holds is the shape —
two clocks, and a chain of one-way reads across them — and what follows from it
for anything new that arrives on screen.

## Why two

They are driven by different things. The shell's stagger runs on frames and
waits on nothing; it is choreography over space that is already reserved. The
canvas's ladder waits on a board being laid out and painted, and it starts over
whenever the base canvas remounts — which happens every time a tab stops
covering it.

One clock would have to be the canvas's, because it is the one that can be
slow. It is also the one that restarts, and a shell driven by it re-runs its
whole arrival over a screen the reader has already loaded. The sidebar's
once-per-entry latch exists to make the shell's half fire exactly once per
entry; folding the two together would give that back.

## The two designs this rejects

Both look like straightforward reuse, and both have been proposed.

**Hoisting `data-shell-entrance` to a common ancestor of the aside and the
canvas**, so that a bar above the canvas can join the sidebar's stagger. The
attribute is one level away from covering the bar, and the stagger is already
written. What it actually buys is two staggers in one subtree: the delays are
carried by descendant selectors, which do not stop at the aside's edge, and the
canvas below is already running six rungs of its own. Two ladders over the same
pixels, and the shell's finishes first whether or not the board is ready.

**Sharing `EDITOR_BOOT_HOLD_KEY`** between the bar and the sidebar. A shared
hold key is the right tool for a waterfall whose stages render from different
components — one hold, one fade, no restart at the hand-off. A bar that owns a
query is not a stage of that waterfall, so it keeps its own session.

That is a rejection of the MECHANISM, and this record originally read it as a
rejection of arriving together too. Those are separate questions, and #253 was
the bill for answering them as one: the service query is the fastest thing on
the screen, so the bar painted its name, its kind and its whole summary over a
sidebar still showing boot skeletons and a canvas still saying "Loading
blueprints…". Three surfaces, three beats. The bar keeps its own session and
reads the shell's lane to know when that session may end.

## Consequences

**A surface that owns its own query takes its own hold session.** Share a hold
key along a waterfall, where the stages are genuinely waiting on each other;
never across two surfaces that are each waiting on something different.
`EntityHeader` is the worked example, and its own comment says which key it
declines and why.

**The read is one-directional, and must stay that way.** The shell may wait on
the canvas's rung. The canvas may not wait on the shell: it publishes where it
is and is not told when to be there. A rung that waited on a shell state would
put the two clocks in a cycle, and the canvas is the half a reader is actually
watching.

**Owning a session is not the same as choosing a beat.** A surface decides
for itself what to draw while it waits; when it may stop waiting is a question
about the screen it is part of. The identity bar answers the first with its own
hold session and the second by reading the shell's boot lane, and it needs both
— a bar released by the lane alone would show a name it does not have yet.

**The reads chain, and every link points the same way.** The bar reads the
shell; the shell reads the canvas's rung; nothing reads back. A new surface may
join the chain at the end. It may not ask anything upstream to wait for it,
which is what would close the loop.

**The plausible "fix" that would undo this:** driving the sidebar's stagger
from the canvas's reveal rung, on the reasoning that one screen should have one
clock. It removes a state machine and reintroduces the remount: every return
from a tab replays the shell's arrival over a sidebar that never left.

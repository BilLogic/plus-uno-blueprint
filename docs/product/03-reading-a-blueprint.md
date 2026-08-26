---
audience: everyone
summary: How to read a board — where to look first, what the layout is telling you, and the three questions the shapes answer.
sources: CONTEXT.md, src/components/blueprint/ServiceBlueprintGrid.tsx
last-reviewed: 2026-08-25
---

# Reading a blueprint

**Every word this app uses is defined once, in [`CONTEXT.md`](../../CONTEXT.md)
at the root of the repo.** Keep it open beside this page the first time; that
file says *what each thing is*, and this one says *how to read the picture they
make together*.

A blueprint looks dense before it looks obvious. It stops looking dense once you
know that the whole thing is answering three questions at the same time, one per
axis.

## Left to right is time

The columns are **steps**, in order. Step 1 happens before step 2, on every
screen, phones included. If you want to know what happens next, look right.

Two boards of the same scenario can order the same step differently, because
column order belongs to the **path**, not to the step. That is not a mistake in
the data — it is the point of having paths.

## Top to bottom is who, and whether the customer can see them

The rows are **lanes**, and they are stacked in a deliberate order: the
customer's own actions at the top, then the staff and tools they can see, then
everything backstage.

Running between the visible rows and the hidden ones is the **line of
visibility** — a rule across the whole board, on every screen. It is the single
most useful thing on the page. Above it is what the customer experiences; below
it is the machinery that has to work for the moment above to feel effortless.

**Most service problems live in the mismatch across that line.** A cheerful
customer-facing moment sitting above three backstage cells that all say "manual"
is a story. So is a busy backstage row under an empty customer row — work nobody
is receiving.

## The arrows are causation, and the panel is everything else

An arrow from one cell to another means the first one **makes the second
happen** (`leads_to`). Follow the arrows and you are following the causal flow
of the service. If a cell has no arrow into it, either something is missing, or
that is where the journey starts.

What a cell **needs** — a system, a piece of information, another cell's outcome
— is *not* drawn. It is listed in the cell's panel, because needs do not cause
anything; they are the prerequisites that hurt when they are missing. Drawing
them would double the arrows and halve their meaning.

> A useful test when you cannot decide which one you are looking at: remove the
> other cell and ask what happens. If this one never starts, that was a
> `leads_to`. If it starts but goes wrong, that was a need.

Click any cell to open its panel: the full description, who is responsible, what
it depends on, and the research evidence behind it. Cells are the atoms of
everything else — slices cite them, findings point at them, share links open
them — so the panel is where a question usually ends.

## What to do first, on a board you have never seen

1. **Find the line of visibility.** It tells you which half of the board is
   experience and which is operations.
2. **Read the top row left to right.** That is the customer's story, and it
   should read like one.
3. **Then read straight down from the moment that interests you.** Everything in
   that column is what has to happen for that moment.
4. **Only then follow arrows.** They are for tracing a specific chain, not for
   getting oriented.

Paths come after all of that. Start with the happy path — the one where
everything works — and read a detour only once the happy path makes sense.
Comparing two of them side by side is its own surface, and
[doc 02](02-team-guide.md) covers how to open it.

## Where the reading stops and the analysis starts

A blueprint is a description. What is *wrong* with the thing it describes is a
**finding**, and findings come from audits — systematic checks explained in
[doc 04](04-the-assistant-and-audits.md). A finding is always an open question
for a human, never an automatic change.

If you find yourself arguing with the board rather than reading it, that is the
signal to open [doc 05](05-service-design-practice.md): you are doing service
design now, not reading.

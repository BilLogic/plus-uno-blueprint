---
audience: everyone
summary: The zero-background guide — find a scenario, read a journey, use a phone, ask the assistant, share links, and present to stakeholders.
sources: docs/plans/2026-08-08-001-feat-mobile-responsive-blueprint-plan.md, src/components/editor/SidebarNav.tsx, src/components/editor/SlicePresentation.tsx, src/lib/urlViewState.ts
last-reviewed: 2026-08-18
---

# Team guide

Everything in this guide works without an account, except talking to the
assistant (needs sign-in) and editing (needs team access, desktop only).
New here? Read [01 — Overview](01-overview.md) first; it's two minutes.

## Open the app and find your way around

Open the app link the team shared. You land on the **Overview**: the
service's big stages (phases), each listing the situations (scenarios)
mapped inside it.

- **On desktop**, the left sidebar lists phases and scenarios. Click a
  scenario to open its board. Once a scenario is open, its journey variants
  (paths) appear in the sidebar too.
- **On a phone**, tap the menu button (top left) to get the same list, then
  tap a scenario to open its board.

## Read a journey top to bottom

A scenario's board reads like a comic strip of the service:

- **Left to right is time.** Each column is one step of the journey.
- **Top to bottom is depth.** The top rows are what the customer sees and
  does; the lower rows are the staff work and systems that make it happen.

Somewhere in the middle runs the **line of visibility**: everything above it
is what the customer experiences, everything below is the machinery they
never see. That one line is the point of the whole diagram —
[doc 03](03-reading-a-blueprint.md) teaches the rest of the vocabulary.

Click any box (a "cell") to open its detail panel: what happens in that
moment, who does it, what it depends on, and the research behind it.

## On a phone

The phone shows the same board as desktop, one stage at a time — picking a
scenario from the menu frames its stretch of the map. Pinch to zoom and
drag to pan; tap a cell and its details slide up from the bottom. The pill
in the top bar switches which path you're reading (one at a time on a
phone), and **Reset View** at the bottom reframes the board if you lose it.
Everything on a phone is **view-only** for everyone — editing is a desktop
activity.

## Ask the assistant

Signed in? The ✦ button opens the assistant — an AI that reads the same
board you do. Ask it things like "where does the student first hear about
pricing?" or "walk me through the make-up session path", and it will answer,
jump the view to the right spot, and point at the cells it means. It can't
change anything on your behalf unless you're a team member editing on
desktop — and even then every change it makes is listed and reversible.
The full trust story is [doc 04](04-the-assistant-and-audits.md).

## Share a link to an exact spot

When you have a cell's panel open, the page address identifies it. Copy the
address from your browser's address bar and send it — whoever opens it lands
on the same scenario with the same cell's panel already open. This is the
best way to say "this moment, right here" in a chat or a doc.

## Presenting and sharing

### Slices: the stakeholder view

The full board is honest but dense. A **slice** is a cut of it made for one
audience — the student's journey only, everything that happens at one
moment, or one team's responsibilities end to end. Find them under
**Slices** in the sidebar. If the slice you need doesn't exist, ask a team
member (or the assistant, via a team member) to create one.

### Presentation mode

Every slice has a **Present** option: a full-screen, dark stage that steps
through the slice frame by frame, like slides — except each frame is live
blueprint content, so it's never out of date. It works great directly in
meetings: open the slice, hit Present, and use the arrow keys. No export
step, no deck to rebuild next month.

### What to screenshot for decks

When you do need static images for a slide deck:

- **One moment:** open the cell's panel and screenshot the panel.
- **One journey:** screenshot presentation-mode frames — they're composed
  for full-screen and crop cleanly.
- **The shape of the whole service:** the Overview page.

Avoid screenshotting the full zoomed-out board — it's too dense to read on
a slide. Wherever the audience will read on their own devices, prefer
sending a link (it stays current; a screenshot is stale the day the
blueprint changes).

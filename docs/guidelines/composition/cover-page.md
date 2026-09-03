---
audience: designers, developers
summary: The shell's landing view — a content model supplied by the deployment, one navigating action, click-to-expand figures that never write or fetch, and one measure down the whole page.
sources: src/components/cover/CoverPage.tsx, src/components/cover/coverModel.ts, src/components/cover/coverMeasure.ts, src/components/cover/CoverFigure.tsx, src/content/coverContent.ts
claims:
  - src/components/cover/CoverCommandCopy.tsx
  - src/components/cover/CoverFigure.tsx
  - src/components/cover/CoverPage.tsx
  - src/components/cover/CoverSections.tsx
  - src/components/cover/CoverServicesSelector.tsx
  - src/components/cover/CoverTabStrip.tsx
  - src/components/cover/coverInline.tsx
  - src/components/cover/coverMeasure.ts
  - src/components/cover/coverModel.ts
last-reviewed: 2026-08-25
---

# Cover page

The shell's landing view — what a visitor meets before any blueprint is open.

> Everything visible is data from a `CoverContent` module; the components here
> own only layout and theme treatment. Tab state is local and unserialized:
> `?slice=` deep links resolve one way, out of this page into app surfaces,
> never into a cover tab — a second writer on the query string would race the
> slice resolution.

## Two classes of button, and only one of them navigates

**The header's button is the page's only NAVIGATING action** — the one way to
leave the cover. Figures are click-to-expand, which is a second class of button,
deliberately: it never writes, fetches, or navigates, so the page stays
identical for a read-only visitor and in a zero-config workspace, whether or not
a reader ever opens one. A test asserts the header action stands alone.

Reading order in the header is title → lede → the way in. The button used to sit
on the title's baseline, opposite the heading, which put the page's only action
level with the words before the reader had been told what they were opening.
Reading order and visual order now agree: what this is, what it does, how to
enter.

## The content split

Types only in `coverModel.ts` — **no strings live there**. The renderers are
shared with the `agentic-service-blueprinting` template and know nothing about
PLUS; a deployment is entirely defined by its content module. That split is what
lets a fork change every label, figure and link without touching a component.

Section kinds are `prose`, `figure`, `defs`, `portrait` and `skill`. Three rules
in the model are worth keeping:

- **An absent figure is first-class.** A section whose figure has not been
  authored yet renders prose-only. No placeholder box, no broken `src`.
- **The repo link is quiet and inline**, rendered only when the deployment
  configures one. There is no button form of it — the page has one button.
- **Portrait images are a different treatment from wide figures**, not a smaller
  size of them. A wide diagram plate is sized from its own viewBox at the page
  measure; a portrait is a fixed small square, because blowing it up to the page
  measure would blur a logomark or let a character illustration dominate a page
  otherwise made of technical diagrams.

**Figure dimensions come from each SVG's viewBox**, so the page reserves the
right box before the image decodes.

## One measure

`COVER_MEASURE` is the page's one width, and it exists as a constant because it
previously did not — and the page showed it twice over. Prose sat at one width
while figures ran to another, so every figure overhung the paragraph above it and
the column edge moved at each image; and the header's lede disagreed with the
content below it.

It is the wider of the two, because the header sets the page's edge and the
reader meets it first. It runs a little past the classic measure at the body
size; that is the accepted cost of one edge down the entire page, and it buys the
wide diagrams noticeably more room.

**Import it. Do not restate the value — two literals is how the page got into
this state.** A test holds every block to one measure, so the column edge never
moves.

## Figures

**No plate, no border, no padding — deliberately.** Every figure is authored with
a full-bleed rounded background rect across its whole viewBox, so the artwork
already *is* its own container. Wrapping it in a second bordered, padded white
box drew a frame around a frame.

That self-plate is also what makes dark mode work with no treatment at all: the
figures are authored light — fills, text and strokes are literal values inside
the file, and an `<img>` seals page CSS out of them — so they read as printed
plates in a dark book, which is a convention, rather than as panels that forgot
to theme themselves. **Not `dark:invert`**, which destroys the lane colours the
figures encode; not an opacity dim either, which drops the smallest labels below
AA.

The whole image is the trigger — a diagram this dense benefits from a big hit
target — and the cursor stays a plain pointer, because the corner hint already
says "this expands". The opened figure has a second zoom step to authored pixel
size, with zoom cursors on the image only; everything else in the popup closes,
with a plain cursor. There is no close button: every square inch that is not the
diagram already closes it. Reopening always starts fit-to-viewport — the
zoomed-in step is a per-visit choice, not a remembered preference.

One implementation note that will look like a mistake and is not: the expanded
size is an **inline pixel width**, not a utility class. These SVGs are authored
with a `viewBox` and no root `width`/`height`, so the browser's intrinsic-size
detection reports the UA default inside a flex popup and CSS `auto` follows
*that*, not the HTML attributes. An explicit pixel width is the one way to get
the authored size deterministically rather than arguing with SVG intrinsic-size
edge cases.

The first figure decodes eagerly; the rest are lazy.

## Sections

**One layout for every section: prose first, figure below it at full width.** No
side-by-side variant — a page that mixes the two reads as two designs, and the
wide figures were the only ones that ever qualified. Portraits stack too; rows
were tried twice and dropped both times, because a row split the section's width
unevenly against every other block, reading as its own small layout system
rather than a continuation of the page's.

## The small parts

- **`coverInline`** — three markers, not a markdown engine: `**term**` for a term
  on first definition, `*word*` for the lighter stress the copy uses once or
  twice, `` `code` `` for an invocation or filename. The copy is authored, not
  user input, and anything richer belongs in the section grammar rather than
  inside a string. Bold is matched before italic so a bold run is never read as
  two italics.
- **`CoverCommandCopy`** — a skill invocation, click-to-copy. The skills run in
  Claude Code, not in this app, so the useful affordance is getting the exact
  command onto the clipboard; **a button that pretended to run something here
  would be worse than no button.** The clipboard call is guarded (the API is
  absent over plain http), and a denied clipboard is swallowed — not an error
  worth surfacing on an orientation page, so the control simply stays put. The live
  region announces only on success, because the resting control already reads its
  command.
- **`CoverTabStrip`** — the line-variant tab list with an animated shared
  indicator, with two additions for a four-label strip: the list scrolls
  horizontally when the labels do not fit, with an **edge fade instead of a
  scrollbar** (chrome on an orientation page), and the indicator recomputes on
  scroll as well as resize, since its maths reads live rects.

  The rule that keeps both honest: **the scrolling element holds nothing but the
  triggers.** The border and the indicator — the two pieces that must sit *on*
  the baseline rather than above it — live on a non-scrolling wrapper. Three
  consequences worth not undoing: the frame is `flex` rather than `block`, or an
  inline-level child sits on a line box and the font's descender pushes the
  border clear of the labels; the clip is `overflow-x-clip` rather than
  `hidden`, because `hidden` would make it a scroll container and CSS computes
  the two overflow axes together, reopening the phantom vertical scroll region
  this structure exists to remove; and overscroll containment is x-only, because
  the page's own vertical scroll must still chain.
- **`CoverServicesSelector`** — the front door to a multi-service deployment
  (#336, #303). The tab a deployment marks `services:` in its content heads its
  panel with a selector — one segmented control on a recessed track, a tab per
  service, the active one lifted onto the background (the Skills tab's pattern,
  applied to the roster). Picking one makes that service active, which drives
  the URL and re-scopes the board. **It appears only when a second service
  exists:** with one service the tab keeps its singular label and shows no
  selector, so a single-service deployment is unchanged. The roster and the
  active slug are read once at `CoverPage` (from `ActiveServiceContext`) and
  handed to the provider-free `CoverPageView` as props, so the surface stays
  testable without a provider.

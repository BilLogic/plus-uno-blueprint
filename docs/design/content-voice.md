---
audience: designers
summary: UI copy rules, error and empty-state wording, the agent's honest voice, and the naming conventions the interface must keep straight.
sources: src/lib/agent/uiBridge.ts, src/lib/viewTypeVocabulary.ts, src/components/mobile/MobileShell.tsx, src/types/nav.ts
last-reviewed: 2026-08-18
---

# Content and voice

## UI copy rules

- **Active voice, sentence case.** "Open the panel", not "The Panel Can Be
  Opened". Title Case is reserved for proper nouns the product defines.
- **One job per element.** A button names its action; a label names its
  object; neither explains the other's job. If a control needs a paragraph,
  the control is wrong, not the paragraph.
- **Name what users control, not how the system is built.** Copy says
  "scenario", "slice", "phase" — never "row", "RPC", "query", or a component
  name. The implementation vocabulary stays in code and engineering docs.
- Short beats complete. Tooltips and eyebrows are fragments; empty states are
  one sentence plus one action.

## Error and empty states: direct and actionable

State what is true, then what to do — no apology theater, no jargon, no dead
ends. The house pattern is the mobile overflow's **"Editing is available on
desktop"**: it names the capability, where it lives, and implies the action,
in five words, without "sorry", "oops", or "unavailable". An error names what
failed at the user's altitude and offers the recovery (retry, go back,
reload); an empty state says what would be here and how to get the first one.
Visual recipes for these states live in
[components](components.md#empty-loading-and-error-states).

## The agent's voice: honest, verified, plain

The in-app agent reports what it *verified*, never what it *attempted*. The
canonical line ships in `src/lib/agent/uiBridge.ts`: when a dispatched click
doesn't land, the tool result says the click landed but the panel did not
open, offers the likely causes, and ends "The panel is NOT open; do not claim
it is." That is the register for everything the agent says about the UI —
claims are grounded in read-back state (`get_ui_state`, registered UI
contexts), failure is stated plainly with next steps, and the agent never
narrates success it cannot see. Agent copy follows the same UI rules above:
users' vocabulary, active voice, no internals.

## Naming conventions

The words the interface must keep straight — one name per concept, spelled
the same everywhere:

- **The phone has no view names.** The mobile shell shows the same canvas as
  desktop, so mobile copy names the same things desktop does — "phase",
  "scenario", "path", "slice" — plus "the menu" for the drawer
  (`MobileNavSheet`'s surfaces are titled "Blueprints" and "Slices", matching
  the desktop rail). Never revive the retired "Journey"/"Map"/"reader"
  vocabulary — those views no longer exist.
- **Stacked / Merged** — the compare view names shown in UI. The database
  keeps the historical tokens `side-by-side` / `integrated`; the two
  vocabularies meet only at the read seam (`src/lib/viewTypeVocabulary.ts`),
  and `merged` is session-only, never persisted. UI copy never surfaces the
  stored tokens.
- **Line of visibility** — always spelled out, in full, lowercase. Never
  "LoV", "the line", or "visibility rule". It is the blueprint discipline's
  most load-bearing term and abbreviation erodes it.
- Time markers render as the register (`01 · Arrival`) but are *spoken and
  written* as plain names — accessible labels and running copy say "the
  Arrival phase" (see [accessibility](accessibility.md)).

## Blueprint cell content: the grid and the citation

Cells have two audiences and one text. A person scans `content` in a grid
square; the Slack bot and the canvas agent quote that same string back as
evidence, and the semantic index embeds it. Those look like competing demands —
terse for the grid, self-contained for the citation — but they are not, once you
see what the citation actually is.

**The citation unit is breadcrumb + cell, never the cell alone.** Every surface
that quotes a cell prints `Scenario · Path · Step · Layer` alongside it, and the
embedding chunk leads with the same line. The subject, the moment, and the actor
are already supplied. So `content` does not need to restate them — it needs to
be a **grammatically complete predicate** of that breadcrumb.

That single reframe resolves the tension. `Leave breakout room.` fails not
because it is short, but because it is the wrong part of speech for a string
that will be read after a lane name. Fix the grammar and terseness costs
nothing.

### The test

Read the cell as: **«Lane» at «Step»: ___**. If that is a true, complete
sentence, the cell is right.

### The three fields

| Field | Holds | Test |
| --- | --- | --- |
| `content` | The one thing that happens here. Grid text; the quoted string. | Passes the sentence test above. |
| `description` | What the grid cannot hold: mechanism, thresholds, exceptions, numbers, evidence for shipped-status claims. | Says something `content` does not — never a restatement of it. |
| `function` / `form` / `value_props` / `owner` / `perceived_owner` | Analytic spec, filled deliberately for cells under review. | An auditor would query it. |

### Grammar, by lane type

**Act lanes** (Regular Tutor, Lead Tutor, Supervisor, Teacher, Front/Back Stage
Actions) — third-person singular present, **verb first**. The lane supplies the
subject; never restate it.

> ✅ `Leaves the student's breakout room.`
> ❌ `Leave breakout room.` (imperative — a blueprint documents, it does not instruct)
> ❌ `Tutor leaves the breakout room.` (restates the lane in the grid's narrowest dimension)
> ❌ `The tutor can leave…` (modal — describe what happens, not what is permitted)

Sentence case, one sentence, terminal period, present tense. Name the object
rather than a pronoun: `Marks the student present.`, not `Mark them as present.`
— "them" resolves only from the step column, which a citation may not carry.

**Pill lanes** (Front Stage Tech, Back Stage Tech, Support Actions) — a
canonical proper noun. No verb, no period, one system or team per line.

> `Zoom/Pencil` · `PLUS App` · `Dev Team`

Because content is a bare noun here, `description` is **not optional garnish —
it is the only thing that makes the cell citable**, and it must say what this
system does *at this step*, distinct from the neighbouring step. A pill with
boilerplate pasted down the row is one cell repeated, not several cells.

**Visual lane** — `content` stays empty; `picture` carries the cell.

**System rules are not actor moments.** A policy like "12+ hours out,
call-offs are auto-approved" belongs to the system that enforces it or to the
description of the act it governs — not as content in an actor's lane.

### Unshipped behavior must say so in `content`

If a cell describes behavior that is not in production, the grid has to carry
that, because the grid is what people read and bots quote.

> `content`: `Planned — reconfirms availability when a session is edited or reverted.`
> `description`: `PLANNED (not shipped as of Aug 2026): <mechanism>. Evidence: <source>.`

Prefix is `Planned — ` (em dash, no parentheses, no date). Retire the variants
`(Shipping — not yet in production.)`, inline `(planned)`, and bare `TBD`.
Uncertainty about *design* goes in the description; uncertainty about
*existence* goes in the prefix. Ten characters is the difference between a grid
that documents the service and one that misreports it.

### Length

| | Target | Review threshold |
| --- | --- | --- |
| Act-lane `content` | ≤ 80 chars, one sentence | 100 |
| Pill-lane label | ≤ 32 chars per pill | 48 |
| `description` | 120–400 chars | 600 |

Thresholds are editorial warnings, not storage caps. Over the threshold, keep
the lead clause in `content` and move supporting detail to `description` when
that improves the writing. The canvas preserves stable geometry by clamping
the preview (four lines for narrative cells, two for pills); the detail panel,
accessibility tree, database, and agent tools retain the complete content.

### Identifiers

Never in `content`; freely in `description`. `ReconfirmState`, `TutorSession`,
`/PLUS/TutorReview`, `home.js:802` are load-bearing evidence and belong where
the engineer who needs them will look. Content names the capability;
description names the class.

### Naming

`PLUS App` (capital A) everywhere, in every field. Vendors keep their own
casing. Roles are named as groups, never individuals. One canonical spelling
per actor group — `Researchers set…` and `Researcher sets…` are one claim
split into two, which costs the index a duplicate vector and the reader a
second entity.

### Three failure modes to check

1. **Pronoun with no antecedent in the cell** → name the object.
2. **Bare noun where a predicate belongs** (pill lanes excepted) → add the verb.
3. **The same string in two cells** → at least one is wrong. Differentiate it,
   or leave the cell empty. Empty cells are normal; filler is not.

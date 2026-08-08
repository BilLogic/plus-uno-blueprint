---
audience: designers
summary: UI copy rules, error and empty-state wording, the agent's honest voice, and the naming conventions the interface must keep straight.
sources: src/lib/agent/uiBridge.ts, src/lib/viewTypeVocabulary.ts, src/components/mobile/MobileShell.tsx, src/types/nav.ts
last-reviewed: 2026-08-08
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

- **Journey / Map** — the mobile reader's two views. "Journey" is the
  vertical reader; "Map" is the touch canvas. Never "canvas", "board view",
  or "reader mode" in mobile UI copy.
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

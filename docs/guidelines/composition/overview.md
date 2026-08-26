---
audience: designers, developers
summary: The nine assembled surfaces, why they are cut by name rather than by source folder, and the declared claim mapping the build enforces.
sources: scripts/check-harness-claims.mjs, src/components/blueprint/, src/components/editor/, src/components/cover/, src/components/mobile/
last-reviewed: 2026-08-25
---

# Composition

Everything assembled out of the [primitives](../components/overview.md) — the
145 files under `src/components/{blueprint,editor,cover,mobile}` — documented as
**the surfaces a person can name**, one doc each:

| Doc | Covers |
|---|---|
| [canvas](canvas.md) | click grammar, canvas modes, panel-as-selection, camera behaviour, the phase-row height contract, the touch contract, and the desktop chrome around all of it |
| [entity-panels](entity-panels.md) | the generic detail panel and the six entity panels, the shared shell, the term label, the textarea field, the loading state |
| [sidebar](sidebar.md) | the nav, both rails, the paths and slices sections |
| [agent-session](agent-session.md) | the agent panel, dock, markdown, settings fields, mobile sheet and fab, session persistence |
| [dialogs-sheets-and-forms](dialogs-sheets-and-forms.md) | the posture contract, the create and delete dialogs, the slice sheet, the session-changes sheet, field primitives |
| [compare](compare.md) | side-by-side, stacked and merged grids, the resizable panel, the review ledger |
| [slice-view](slice-view.md) | the view, presentation, screen composer, frame editor, storyboard, slide mode |
| [cover-page](cover-page.md) | the shell's landing view and its content model |
| [mobile-shell](mobile-shell.md) | the mobile shell and its chrome — the one forked surface |

## Why not one doc per source folder

Because folder names are not stable and the boundaries are not the ones a
reader has. `editor/` alone spans the canvas, the sidebar, slices, the agent and
the dialogs; `blueprint/` holds the grid, the panels and the compare cockpit.
The `layer`→`lane` rename is the standing demonstration that a folder name can
change under a doc that was named after it.

What folder-derivation would have bought — nothing silently undocumented — is
bought instead by a check.

## The claim mapping

Each doc's frontmatter carries a `claims:` list naming every file it documents.
`npm run check:harness` (`scripts/check-harness-claims.mjs`) holds the two sides
to each other in both directions and fails on:

- a source file no doc claims, naming the file;
- a claim pointing at a file that no longer exists, naming the doc and the file;
- a file two docs claim, naming both docs.

So a new surface that nobody documented turns the build red, and an obsoleted
surface shows up as a red build rather than as rot. Co-located `*.test.*` files
are a companion to the file they test, not a surface anyone documents, and are
excluded from the source set.

The count is the check's business rather than the reader's. If you are adding a
component, add its path to whichever doc's `claims:` list already describes the
surface it belongs to — and if none does, that is the signal that you are
building a *tenth* nameable surface, which is a conversation, not a paste.

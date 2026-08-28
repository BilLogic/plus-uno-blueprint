---
audience: developers
summary: The agent's tool surface — specs vs dispatch, the rosters, how to add a tool, and the eval harness + parity tests that keep it honest.
sources: src/lib/agent/tools/specs.ts, src/lib/agent/tools/registry.ts, src/lib/agent/tools/referenceNames.ts, src/lib/agent/tools/mobileRoster.test.ts, scripts/agent-harness/run.mjs, scripts/agent-harness/cases.mjs, scripts/tests/toolParity.test.mjs, todos/021-pending-p2-agent-harness-review-followups.md
last-reviewed: 2026-08-25
---

# Agent tools

The agent's entire reach is a static allow-list. No dynamic dispatch, no
table name as an argument, no free SQL — a request for anything else is a
refusal, not an attempt. **Deliberately absent: every delete.**

## The specs / dispatch split

- **`src/lib/agent/tools/specs.ts`** — pure data: `TOOL_SPECS` (name,
  description, JSON-schema parameters) plus the rosters. No imports
  beyond `referenceNames.ts`, which is a leaf module with **zero**
  imports, precisely so specs stay loadable under plain Node (the harness
  and `.mjs` tests) without dragging in supabase-js or Vite `?raw`
  markdown.
- **`src/lib/agent/tools/registry.ts`** — dispatch: `dispatchTool` maps a name
  onto the same wrapper the UI calls (`authoringRpc.ts`,
  `cellContentMutations.ts`, `cellSpecMutations.ts`, `sliceMutations.ts`,
  `stakeholderMutations.ts`, `evidenceMutations.ts`, `findingMutations.ts`), so
  RLS, validation, ledger logging, and revert capture come free. **There is no
  longer an exception.** `create_finding` / `update_finding` wrote the
  `findings` table straight from this file until 2026-08-25 — no ledger entry,
  no captured inverse, and ⌘Z reaching past them to undo somebody else's edit.
  They dispatch to `findingMutations.ts` now; the dedupe rule travels with the
  write, because the branch *is* the write path. See
  [access-and-security](access-and-security.md#authoring-writes).
- UI navigation dispatch may be asynchronous: `open_phase`, `open_scenario`,
  and `focus_cell` wait for verified selection/camera outcomes. The CLI harness
  mocks those visual effects, so production camera movement is validated in a
  real browser in addition to tool-parity and model-sequencing tests.
- **`src/lib/agent/tools/read.ts`** — the read tools and the reference
  documents, imported from the pinned `agentic-service-blueprinting`
  package; asserts at module init that its keys match `REFERENCE_NAMES`
  exactly.

## The rosters

Four sets, and they answer two different questions. `READ_TOOL_NAMES` /
`INTERFACE_TOOL_NAMES` / `WRITE_TOOL_NAMES` **partition** `TOOL_SPECS` —
every declared tool is on exactly one, asserted at module init — and that
partition is what the served rulebook's "FULL surface" rows are graded
against. `MOBILE_READ_TOOL_NAMES` cuts across all three and is a UX
whitelist, not a surface.

- **`WRITE_TOOL_NAMES`** — the tools that mutate data. Membership drives
  the batch limiter, viewer-tier refusal, and agent attribution in the
  ledger. Forgetting to list a new write tool here silently exempts it
  from all three — the parity tests exist to catch exactly this.
- **`READ_TOOL_NAMES`** — the tools that neither move the user's canvas
  nor change a row. NOT the complement of the write set: the complement
  sweeps in `focus_cell` and `set_sidebar`, which the read row's own
  sentence excludes. `list_ui_commands` is a read; `ui_command` is not.
  Held to `src/lib/agent/canvas-adapter.md`'s read row by
  `npm run check:write-surface`.
- **`INTERFACE_TOOL_NAMES`** — the gestures the human also has. Includes
  `ui_command`, which belongs to neither surface: most of its commands are
  interface, and the ones marked "[changes data]" count against the write
  batch.
- **`MOBILE_READ_TOOL_NAMES`** — the ONLY tools offered while the mobile
  shell is up, for every tier. A **whitelist**, not a write-filter, so a
  new tool defaults to *absent* on mobile until someone deliberately adds
  it. Pinned by `mobileRoster.test.ts`: zero write tools, no phantom
  names, and the authoring-posture surface tools (`set_canvas_mode`,
  `annotate_cells`, `ui_command`, `list_ui_commands`, `set_sidebar`) stay
  out.

## Adding a tool

1. **Spec** in `specs.ts` — name, a description written for the model
   (say when to call it, not just what it does), parameters. Decide
   roster membership: read, interface or write — the module-init partition
   check refuses a tool classified nowhere — and should mobile have it
   (default no)? Then add it to the matching row in
   `src/lib/agent/canvas-adapter.md`, or `npm run check:write-surface`
   fails: the rows say "that is the FULL surface", and the agent reads
   that as permission.
2. **Dispatch** in `registry.ts`, calling an existing wrapper. If the
   wrapper doesn't exist, that's a write-path change first — see
   [access-and-security](access-and-security.md#authoring-writes).
3. **Harness mirror** — dispatch only. `run.mjs` bundles `specs.ts` and
   destructures `TOOL_SPECS` / `WRITE_TOOL_NAMES` / `MOBILE_READ_TOOL_NAMES`
   from it, so re-declaring a spec there is now a *test failure*, not a chore.
   What still needs a hand: the harness's mock dispatch table, and — for
   writes — the `WRITES` set in `cases.mjs`. Add or extend a case exercising
   the tool.
4. **Run the parity tests** (`npm test`) — they fail until all the lists
   agree.

## Parity tests — why they exist

`scripts/tests/toolParity.test.mjs` used to ask "did the hand-copied fork
drift". It cannot any more — the fork is gone — so it asserts the replacement:
that the import wiring is intact, that no fork has crept back in, and that
`cases.mjs`'s `WRITES` set still covers every write tool. Only `registry.ts` is
still text-parsed, deliberately, because it cannot load under Node.

The dangerous drift is that last list: a write tool missing from the harness's
`WRITES` makes a "no writes happened" trace check PASS — drift that hides
itself. `mobileRoster.test.ts` pins the mobile whitelist the same way. Treat a
parity failure as the system working.

## The eval harness

`scripts/agent-harness/` — the evidence that the agent follows the
rulebook, run before shipping prompt/tool changes.

- **Reality contract** (header of `run.mjs`): reads are REAL (Supabase
  anon over PostgREST — the same rows the app sees); writes are DRY-RUN
  (recorded in the trace, never sent); UI-state tools are per-case mocks.
  The system prompt is the same `role.md` + the same
  `src/lib/agent/canvas-adapter.md` the app loads, with every other
  reference resolved out of the same installed package — no copy, no
  drift.
- **Cases**: `cases.md` is the human-readable suite; `cases.mjs` the
  machine form. Every rubric line traces to a written rule (skill
  references, adapter invariants), scored by deterministic trace checks
  `[T]` and LLM-judge lines `[J]`.
- **Run it**: `node scripts/agent-harness/run.mjs` (needs `GEMINI_API_KEY`
  in env or `.env.local`); `--case <id>` for one case; `--smoke` for
  keyless machinery checks; `--repeat N` majority-votes each rubric line
  to separate model variance from regressions.

## Known gaps

`todos/021-pending-p2-agent-harness-review-followups.md` is the live list. The
one-sourcing headline is **done** (`run.mjs` imports `TOOL_SPECS`; commit
`1d33428`). What is still open there: template slice rendering, the
god-component splits, and round-limit exhaustion UX in the app lagging the
harness. Check it before assuming a harness number covers your change.

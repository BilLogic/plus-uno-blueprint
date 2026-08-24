---
status: pending
priority: p2
issue_id: 012
tags: [code-review, architecture, quality]
dependencies: []
---

# Code-review follow-ups (2026-08-05 session)

Findings from the three-agent review of the sb-rename → placement work
that were NOT fixed in a30842a. The P1s and all security findings were
fixed and verified; these are the remainder.

## P2

1. **`ui_command` reaches deletes and is outside `WRITE_TOOL_NAMES`.**
   `undo_last_change` → `revertEntry` → `delete_cell`/`delete_scenario`/
   `delete_path`, contradicting registry.ts's "Deliberately absent: every
   delete." Not a tier hole (CanvasModeProvider forces view mode when
   `canWrite` is false, so the command never registers for a viewer), but
   the delete is unattributed, uncapped by WRITE_BATCH_LIMIT, and
   `findLast(entry => entry.revert)` can revert the HUMAN's last edit.
   Fix: add `mutates: true` to ToolSpec so spec-filter, refusal, and the
   dispatch branch share one source of truth.

2. **`SessionChangesSheet` revert is fire-and-forget.** `void
   revertEntry(...).catch(console.error)` returns "Reverting: …"
   immediately, so a REJECTED revert reaches the console only while the
   agent reports success to the user. Await it, return the real outcome.

3. **`tsc --noEmit` is a no-op.** The root tsconfig's deprecated `baseUrl`
   raises TS5101, which aborts before any file is checked — every bare
   `npx tsc --noEmit` this session silently checked nothing. `npm run
   build` (tsc -b) does typecheck. Fix the config or document the trap.

4. **ROLE is duplicated between loop.ts and the harness.** Move it to
   `src/lib/agent/role.md`, `?raw` import in loop.ts, `readFileSync` in
   run.mjs — the exact pattern canvas-adapter.md already uses across that
   boundary. Deletes ~45 duplicated lines and the "remember to update
   both" comment.

5. **Tool-name parity has three copies, no test.** `registry.ts`
   WRITE_TOOL_NAMES, `run.mjs` WRITE_TOOLS, `cases.mjs` WRITES — the
   third rots silently (a missing name makes a trace check PASS). Add a
   parity test to `npm test`.

6. **`findingFingerprint` has no test and cannot get one** where it sits
   (registry.ts imports supabase + ?raw markdown, so the test runner
   can't compile it). It IS the dedupe contract — silently corrupts data
   if wrong. Move to a pure module, add to MODULES in tests/run.mjs.

7. **Two `AgentDock` instances** both mount and run every hook. The drag
   is now correct (shared store), but one instance rendered at shell
   level with the docked posture portalled into `panelColumnRef` would
   be simpler and stop double `clampToViewport` listeners.

## P3

- `SidebarSurface`'s `'agent'` member is unreachable post-toggle change;
  four coercions exist only to exclude it. Split `SidebarPanel` /
  `RailTarget`, give EditorRail an `onToggleAgent` prop.
- Dead: `CollapsedState.expand` (residue of the reverted docked-expander),
  `expandSidebar` in EditorShell exists only to feed it.
- `AgentSkillCommand.content: string | null` — all four ship content now.
- `isServiceAccount` exported on the Supabase context, no consumers.
- `setCollapsedNavSummary`'s `state.summary === summary` guard is dead
  (fresh object each call). Compare fields or drop it.
- Summary ownership is last-writer-wins with no owner token; only safe
  today because exactly one navbar mounts at a time.
- Composer auto-grow uses an inline ref callback → forced reflow on every
  render (fires during streaming). `useRef` + `useLayoutEffect([draft])`.
- Three module stores, three hand-rolled shapes (Set vs Array, patch vs
  replace). A ~15-line `createStore<T>` would collapse them.
- `AgentSettingsRailButton` is ~250 lines doing two jobs (admin sign-in +
  agent keys). Extract two components; retitle the gear tooltip so a
  signed-out visitor knows it is the front door.
- Demotion has no revocation path (JWT-based tier survives until token
  refresh); client tier flag derives from an unverified `getSession()`.
- `cellId` interpolated into a CSS selector unescaped in uiBridge —
  validate as UUID (throws SyntaxError rather than returning the honest
  not-clickable message).
- Check the Ecoeled project (lwphwygorbbwdobnjygo) for the same
  `rename_owner_tag` anon grant.

## Acceptance criteria

- [ ] P2 items 1–3 closed (correctness/safety)
- [ ] P2 items 4–6 closed (drift guards)
- [ ] P3 swept in one pass

## Cross-references (triaged 2026-08-23)

- **P2 item 2** (`SessionChangesSheet` revert is fire-and-forget) → #57, silent
  failures group. Status as of 2026-08-23: the **agent** path was hardened to
  rethrow, carrying a comment recording that a rejected revert used to reach the
  console only while the model was told it had succeeded. The **human keyboard
  path** (Cmd-Z, `SessionChangesSheet.tsx:167-169`) still has exactly the bug
  this item describes. The prescription here — "await it, return the real
  outcome" — remains correct for the half that was missed.

Remaining items are unabsorbed and stay here.

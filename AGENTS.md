# Working in uno-blueprint

Short by design — pointers over prose. If a rule here fights the code,
the code is newer; say so and follow the code.

## Boot protocol (read this order, load on demand)

1. This file is your only guaranteed context — everything below stays in
   force for the whole session.
2. `docs/INDEX.md` is the map: a task-routing table plus every reference
   doc's one-line summary. Route by TASK row, not by browsing folders.
3. Any task that writes data reads `engineering/access-and-security.md`
   first — which user type this session runs as decides which tools and
   paths are even legitimate. The plain-language capability table is
   `product/01-overview.md`.
4. Unsure where a task belongs → `docs/engineering/codebase-guide.md`
   first.
5. `docs/plans/` and `docs/ideation/` are HISTORY — decision-era
   snapshots, not current truth. Check frontmatter `status` /
   `distilled-into` before acting on one.

## Security lines (non-negotiable — never behind a pointer)

- Keys/secrets: only in gitignored `.env`/`.env.local` or browser
  localStorage. Never in committable files, chat, or Netlify env.
- Never widen RLS or write policies; the deployed site stays read-only.
- Local writes authenticate as the dev auth user (auto sign-in from
  `.env.local`); **never the service-role key**.
- Every blueprint-content write goes through `authoringRpc.ts` or a
  `src/lib/*Mutations.ts` module, so it lands in the session ledger with a
  captured revert. Components, contexts and hooks read; they never write to a
  table. That boundary is enforced by `writeBoundaryContract.test.ts`, not by
  convention — it was prose for months and was false for some of them. The test
  scans `components/`, `contexts/` and `hooks/` only; three modules under
  `src/lib` write outside the wrappers, and
  `engineering/access-and-security.md` names all three and says which are
  deliberate. In a mutation module: capture the
  previous value as the inverse **before** the write, write with `.select()` so
  a zero-row update fails loudly, then `recordChange`. Deletes are human-only.
- Watch for literal NUL bytes in generated source (breaks git diffing);
  write the six-character backslash-u0000 escape, never the raw byte.

## Components: DS-native only

Everything under `src/components/ui/` is the design system (shadcn,
base-ui flavor — triggers take a `render={...}` prop, not `asChild`).
Compose these; never hand-roll a primitive that already exists. Missing
primitive? Add it via the shadcn CLI, not a lookalike. The
need→primitive map for agent-UX work: `docs/reference/ui-inventory.md`.

Before inventing any pattern, check how the nearest feature solved it:
`OwnerTagSelect` (filter-as-you-type picker), `SessionChangesSheet`
(review-then-commit list), `SlicesSidebarSection` (context menus +
accordion groups), `SidebarNav` (the sidebar's one disclosure
vocabulary). Deeper: `docs/engineering/codebase-guide.md`.

## Codebase idioms (reviewers keep re-teaching these)

- Derived state over synced state; compute in render, don't mirror into
  `useState` + effects.
- Freeze a prop snapshot with `useState(initializer)` — refs during
  render are lint-blocked.
- Render-phase guarded setState (`if (last !== next) { setLast(next); … }`)
  is the house pattern for reacting to prop changes; not an effect.
- Cross-surface shared state = module-level store + `useSyncExternalStore`
  (see `CanvasModeProvider`, `src/lib/agent/settings.ts`).
- Panel-level actions portal to a footer host (`CELL_PANEL_FOOTER_ID`
  pattern).

## Commands & tooling traps

- `npm test` — vitest; collects `src/**/*.test.ts`, `src/**/*.test.tsx` and
  `scripts/tests/**/*.test.mjs` automatically (no registration list).
- `npm run lint` — baseline is ZERO problems and must stay zero; any
  problem you introduce is yours to fix before merging.
- `npm run typecheck` — the type-check. `npm run build` runs it and bundles.
  Bare `npx tsc --noEmit` checks NOTHING: `npx tsc` is not this repo's compiler
  (it resolves to an unrelated npm package), and `tsconfig.json` is a solution
  file with `"files": []`.
- Quote globs in shell commands (`--include="*.tsx"`) — zsh eats bare ones.
- After moving/renaming any doc: `node scripts/generate-docs-index.mjs`.

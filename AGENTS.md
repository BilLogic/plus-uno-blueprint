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
4. Unsure where a task belongs → `docs/engineering/architecture.md`
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
- Every DB write goes through the wrappers (`authoringRpc.ts`,
  `cellContentMutations.ts`, `cellSpecMutations.ts`,
  `sliceMutations.ts`, `evidenceMutations.ts`) so it lands in the session ledger with a captured
  revert. No raw table writes from components. Deletes are human-only.
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

- `npm test` — vitest; collects `src/**/*.test.ts` and
  `scripts/tests/**/*.test.mjs` automatically (no registration list).
- `npm run lint` — baseline is ZERO problems and must stay zero; any
  problem you introduce is yours to fix before merging.
- `npm run build` — the real type-check. Bare `npx tsc --noEmit` is a
  NO-OP trap (aborts on a deprecated tsconfig option before checking);
  use `npx tsc -p tsconfig.app.json --noEmit` or the build.
- Quote globs in shell commands (`--include="*.tsx"`) — zsh eats bare ones.
- After moving/renaming any doc: `node scripts/generate-docs-index.mjs`.

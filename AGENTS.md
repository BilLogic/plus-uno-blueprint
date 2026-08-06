# Working in uno-blueprint

Short by design — pointers over prose. If a rule here fights the code,
the code is newer; say so and follow the code.

## Components: DS-native only

Everything under `src/components/ui/` is the design system (shadcn,
base-ui flavor — triggers take a `render={...}` prop, not `asChild`).
Compose these; never hand-roll a primitive that already exists. Missing
primitive? Add it via the shadcn CLI, not a lookalike. The
need→primitive map for agent-UX work: `docs/agent/ui-inventory.md`.

Before inventing any pattern, check how the nearest feature solved it:
`OwnerTagSelect` (filter-as-you-type picker), `SessionChangesSheet`
(review-then-commit list), `SlicesSidebarSection` (context menus +
accordion groups), `SidebarNav` (the sidebar's one disclosure
vocabulary).

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
- Every DB write goes through the wrappers (`authoringRpc.ts`,
  `cellContentMutations.ts`, `cellSpecMutations.ts`, `sliceMutations.ts`)
  so it lands in the session ledger with a captured revert. No raw
  table writes from components.

## Commands

- `npm test` — vitest; collects `src/**/*.test.ts` and
  `scripts/tests/**/*.test.mjs` automatically (no registration list).
- `npm run lint` — baseline is ZERO problems and must stay zero; any
  problem you introduce is yours to fix before merging.
- `npm run build` — the real type-check (`npx tsc --noEmit` trips on a
  deprecated tsconfig option; use the build).

## Security lines (non-negotiable)

- Keys/secrets: only in gitignored `.env`/`.env.local` or browser
  localStorage. Never in committable files, chat, or Netlify env.
- Never widen RLS or write policies; the deployed site stays read-only.
- Local writes authenticate as the dev auth user (auto sign-in from
  `.env.local`); never the service-role key.
- Watch for literal NUL bytes in generated source (breaks git diffing);
  write the six-character backslash-u0000 escape, never the raw byte.

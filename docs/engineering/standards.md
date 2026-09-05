---
audience: developers
summary: The quality bar — token discipline against the Supabase benchmark, comment philosophy, what earns a test and how to run them, tooling traps, review workflow.
sources: AGENTS.md, src/styles/blueprint.css, scripts/tests/, todos/020-pending-p3-mobile-v1-followups.md, docs/plans/
last-reviewed: 2026-08-25
---

# Standards

## The Supabase benchmark, concretely

"Looks like Supabase's dashboard" is the bar, and it cashes out as
**token discipline**, not taste. The tier system is documented in the
header of `src/styles/blueprint.css` — read it before styling anything:

1. **Primitive** — `colors.css`, `--color-{family}-{step}`
2. **Semantic** — `semantic.css`, `--background`, `--primary`, `--warning`…
3. **Tailwind bridge** — `theme.css`, so utilities exist
4. **Component** — `blueprint.css`, `--{property}-blueprint-{part}-{state}`,
   set in TypeScript because the value depends on row data; every value is
   a tier-1/2 reference, never a new color

The rules that follow:

- **No raw values where a token exists.** No hex/oklch colors, no
  hard-coded durations (use `src/lib/motion.ts`), no magic widths the
  shell does math on (use `src/lib/layoutTokens.ts`). A raw value in a
  diff is a review finding unless the token genuinely doesn't exist —
  in which case add the token (process: `docs/guidelines/foundations/color.md`).
- Component tokens follow Supabase's order — property, component, state
  (`--background-blueprint-cell-hover`) — and are deliberately not
  declared at `:root` (a root declaration would make every `var(…,
  fallback)` fallback arm unreachable).
- DS-native components only — the rule and the primitive map live in
  `docs/reference/ui-inventory.md`.

## Comment philosophy

Comments record **constraints, not narration** — why, not what. The
codebase's own headers are the exemplar (read `src/lib/queryClient.ts` or
`src/lib/agent/placement.ts`): each states the invariant, the failure
that motivated it, and what would break if you "simplified" it. Write
that comment when you write the code; a reviewer asking "why is this like
this" means the comment is missing. Never leave a comment that restates
the line below it.

## Testing

**How to run**: `npm test` (vitest) collects `src/**/*.test.ts` and
`scripts/tests/**/*.test.mjs` automatically — no registration list. The
`.mjs` suite under `scripts/tests/` exists for logic that must load under
plain Node (no Vite): parity checks, authoring rules, fingerprints.

**What earns a test** — not coverage, but invariants that would otherwise
rot silently:

- **Contracts**: the write path's rules (`authoring-rules`,
  `authoring-session`, `deletion-safety` in `scripts/tests/`).
- **Drift guards** between things that must agree but live apart:
  `toolParity.test.mjs` (app tool surface ↔ eval harness),
  `mobileRoster.test.ts` (mobile whitelist ↔ registry).
- **Grammars and fingerprints**: `cell-pick-grammar`,
  `findingFingerprint` — pure logic with adversarial inputs.

Don't write render-the-component snapshot tests; do write a test whenever
two files must stay in sync or a rule is enforced by convention rather
than types.

**The other gates**: `npm run lint` — the baseline is ZERO problems and stays
zero; any problem you introduce is yours. (`todos/004` still records an
78-problem baseline; that premise is gone — `eslint .` over the tree returns
clean.) `npm run typecheck` is the type-check on its own; `npm run build` runs
it and then bundles. `npm run check:harness` holds every file under
`blueprint/`, `editor/`, `cover/` and `mobile/` to exactly one composition doc,
so a surface nobody documented fails it. The three router checks —
`npm run check:budget`, `check:negation`, `check:pointers` — hold `AGENTS.md` to
its char budget, its recorded prohibition count and its pointer shape; each
script's header carries the reasoning. `npm run check:glossary` does the same
for `CONTEXT.md`, which is the first pointer the router fires: headings, prose
and `**term** — definition` rows, failing on a code fence, on a table naming a
column, and on a section that defines no term. `npm run check:interface-map`
holds `docs/reference/interface-schema-map.md` to what its sources render —
run `npm run interface-map` after changing a panel label's binding.

**The two local guards**, both of which need a Postgres 17 server and neither
of which is in CI for that reason — no workflow stands one up.
`npm run replay:migrations` builds an empty database from
`scripts/replay-prelude.sql` plus the whole migration series and fails when a
file joins the recorded unable-to-replay set (ADR 0009).
`npm run check:seed-load` builds the same substrate and then loads the seed
`supabase/config.toml` `[db.seed]` names — all 23 files, in its order — with
zero failing statements, and reads the result back AS ANON: every table the
seed writes non-empty, and the four joins the board's own selects compile to
returning rows. Run it whenever you touch the seed or the schema under it. It
exists because nothing else asks: a rename that lands in a migration and not
in the seed passes every static check, which is how the seed once fell a month
behind the schema it loads onto (#379).

## Tooling traps

- Bare `npx tsc --noEmit` still checks **nothing**, but not for the reason this
  doc used to give. The TS5101 deprecation trap is gone (`tsconfig.json` says
  so, and carries neither `baseUrl` nor `ignoreDeprecations`); the residual
  no-op is that `tsconfig.json` is a solution file — `"files": []` plus
  `references`, so bare `--noEmit` has zero inputs. Worse, `npx tsc` resolves to
  the unrelated `tsc` npm package, not this repo's compiler. Use
  **`npm run typecheck`**, which runs `@typescript/native`'s `tsc -b`.
- Quote globs in shell commands (`--include="*.tsx"`) — zsh eats bare ones.
- Literal NUL bytes in generated source break git diffing — write the
  six-character backslash-u0000 escape (`\` `u` `0` `0` `0` `0`), never the raw byte.
- base-ui triggers take a `render={...}` prop, **not** `asChild`.
- base-ui `Drawer` snap points: `src/components/ui/drawer.tsx` destructures
  `snapPoints` and nothing else, so `snapPoint` / `onSnapPointChange` reach
  base-ui only through `...props`. The panel sheet uses them
  (`src/lib/panelSheetSnap.ts`). Its stops must stay under the primitive's own
  `--drawer-content-max-height: calc(100dvh-6rem)` — a stop of `1` renders 96px
  short and nothing throws.
- After moving/renaming any doc: `node scripts/generate-docs-index.mjs`
  (`npm run docs:index`). A doc with no frontmatter `summary` fails that build
  rather than passing silently.
- The whole-board canvas has a decoded-image memory budget — read
  [codebase-guide](codebase-guide.md#performance-constraints) before adding
  canvas assets.

## Review workflow

Multi-agent review rounds are the norm here, not an exception: features
land, then one or more dedicated review passes (design audit, security
review, data-integrity review, harness review) run against the diff or
subsystem, and their findings are fixed same-session where cheap. What
survives a session becomes either:

- a **todo** — `todos/NNN-{pending|complete}-pN-slug.md`, ranked, with
  enough context to act on cold; or
- a **plan** — `docs/plans/YYYY-MM-DD-NNN-*.md` for work that needs
  design before code. Plans are history once executed: check frontmatter
  `status`/`distilled-into` before trusting one.

Migration-borne security fixes carry their review provenance in the
migration comment itself (see `20260805170000_service_tier_rpc_enforcement.sql`)
— keep doing that; it is the audit trail.

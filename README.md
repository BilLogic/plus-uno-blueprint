# PLUS Uno Blueprint

A living service-blueprint editor for the PLUS tutoring program. The whole
service journey — every phase, scenario, and touchpoint, above and below the
line of visibility — mapped as an explorable canvas: readable by anyone,
editable by the service team, and worked on by AI agents under the same rules as
humans.

Built with React + Vite, [shadcn/ui](https://ui.shadcn.com/) (base-ui flavor),
and [Supabase](https://supabase.com/). Desktop is the full editor; phones get
the same canvas, view-only and scoped to one scenario at a time — the drawer is
the only way to move between them.

## Five files at the root

Each answers one question. Read the one you have.

| File | Answers |
|---|---|
| **README.md** (this) | What is this? |
| [**SETUP.md**](SETUP.md) | How do I get it running? |
| [**CONTEXT.md**](CONTEXT.md) | What do these words mean? |
| [**INDEX.md**](INDEX.md) | Where do I go for my task? — generated from every doc's frontmatter |
| [**AGENTS.md**](AGENTS.md) | What must I not do? — in force for every session |

Quick picks: *"what is this product?"* →
[`docs/product/01-overview.md`](docs/product/01-overview.md) · *design work* →
[`docs/guidelines/overview.md`](docs/guidelines/overview.md) · *where does code
live* → [`docs/engineering/codebase-guide.md`](docs/engineering/codebase-guide.md).

## How `docs/` is arranged

Three lanes, never mixed.

- **Reference** — living, always true. `product/` (what the thing is and how to
  read it), `guidelines/` (the design system: `foundations/`, `components/`,
  `composition/`), `engineering/` (how the code works), `reference/` (fixed
  vocabularies and id maps), `adr/` (decisions that are surprising or hard to
  reverse), `connectors/` (everything crossing a repo boundary).
- **History** — `plans/`, `ideation/`, `brainstorms/`. Decision-era snapshots,
  never edited after the fact. Check a plan's frontmatter `status` before
  treating it as current. Plans written before 2026-08-26 link to `todos/NNN`;
  that folder is gone and those links are left as written, because editing a
  snapshot's content is the one thing a snapshot must not do.
- **The queue** — [GitHub Issues](https://github.com/BilLogic/plus-uno-blueprint/issues),
  not a folder in the tree.

`overview.md` is authored; `index.md` is generated. Every doc carries a
frontmatter `summary`, and a doc without one fails the index build.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server on 5173 |
| `npm test` | vitest (`src/**/*.test.ts(x)` + `scripts/tests/**/*.test.mjs`) |
| `npm run lint` | eslint — the baseline is zero problems |
| `npm run typecheck` | the type-check; `npm run build` runs it and bundles |
| `npm run check:harness` | every assembled component is claimed by one composition doc |
| `npm run docs:index` | regenerate `INDEX.md` after a doc move |
| `npm run supabase:start` / `:stop` | local Supabase lifecycle (`:reset` cannot rebuild this schema — [ADR 0009](docs/adr/0009-the-migration-series-is-a-narrative.md)) |
| `npm run apply:pending -- --from=<version>` | what is written and not applied (add `--apply` to write) |

Deploys ship from `main` via Netlify — push to main is production. Environments,
rollback and troubleshooting:
[`docs/engineering/operations.md`](docs/engineering/operations.md).

# PLUS Uno Blueprint

A living service-blueprint editor for the PLUS tutoring program. The
whole service journey — every phase, scenario, and touchpoint, above and
below the line of visibility — mapped as an explorable canvas: readable
by anyone, editable by the service team, and worked on by AI agents
under the same rules as humans.

Built with React + Vite, [shadcn/ui](https://ui.shadcn.com/) (base-ui
flavor), and [Supabase](https://supabase.com/). Desktop is the full
editor; phones get the same canvas, view-only and scoped to one
scenario at a time — the drawer is the only way to move between them.

**Start here → [`docs/INDEX.md`](docs/INDEX.md)** — the documentation
map, routed by task. Quick picks:

- *"What is this?"* → [`docs/product/01-overview.md`](docs/product/01-overview.md)
- *Working on the code* → [`AGENTS.md`](AGENTS.md) + [`docs/engineering/`](docs/engineering/)
- *Design work* → [`docs/guidelines/overview.md`](docs/guidelines/overview.md)

## Setup

```bash
npm install
cp .env.example .env
```

### Local Supabase (Docker required)

```bash
npm run supabase:start
npm run supabase:reset   # applies migrations in supabase/migrations/
```

Copy `API URL` and `anon key` from the CLI output into `.env`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon-key-from-cli>
```

### Hosted Supabase

Create a project at [supabase.com](https://supabase.com), run migrations
(`supabase link` then `supabase db push`), and set `.env` from
**Settings → API**.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm test` | vitest (`src/**/*.test.ts` + `scripts/tests/**/*.test.mjs`) |
| `npm run lint` | eslint — the baseline is zero problems |
| `npm run build` | Production build (also the real type-check) |
| `npm run supabase:start` / `:stop` / `:reset` | Local Supabase lifecycle |
| `npm run supabase:types` / `:types:local` | Regenerate `src/types/database.ts` |
| `node scripts/generate-docs-index.mjs` | Regenerate `docs/INDEX.md` after doc moves |

## Where things are documented

Everything deeper lives under `docs/`, mapped by
[`docs/INDEX.md`](docs/INDEX.md): the data model and access enforcement
in `engineering/access-and-security.md`, app architecture in
`engineering/codebase-guide.md`, the design system in `guidelines/`, product
and practice guides in `product/`, decision records in `decisions/`.
`docs/plans/` and `docs/ideation/` are history — snapshots, not current
truth. Deploys ship from `main` via Netlify; environments and rollback
in `engineering/operations.md`.

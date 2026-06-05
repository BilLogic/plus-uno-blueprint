# PLUS Service Hub

React + Vite app using [shadcn/ui](https://ui.shadcn.com/) and [Supabase](https://supabase.com/).

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

Create a project at [supabase.com](https://supabase.com), run migrations (`supabase link` then `supabase db push`), and set `.env` from **Settings → API**.

## Development

```bash
npm run dev
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run supabase:start` | Start local Supabase |
| `npm run supabase:stop` | Stop local Supabase |
| `npm run supabase:reset` | Reset DB and run migrations |

## Database

Schema follows the PLUS service workflow ERD (service requests → classes → domains → paths → steps → level/goals → calls).

| Resource | Purpose |
| --- | --- |
| [docs/erd.mmd](./docs/erd.mmd) | Mermaid ERD (source diagram) |
| [supabase/DATABASE.md](./supabase/DATABASE.md) | Tables, columns, RLS, API usage |
| [supabase/migrations/](./supabase/migrations/) | Versioned schema (GitHub → Supabase) |
| [supabase/seed.sql](./supabase/seed.sql) | Sample workflow + catalog seed |
| [src/types/database.ts](./src/types/database.ts) | TypeScript types |

Regenerate types after schema changes: `npm run supabase:types` (hosted) or `npm run supabase:types:local` (Docker).

## UI

Built with **shadcn/ui** (Tailwind v4). Add components:

```bash
npx shadcn@latest add <component>
```

Theme tokens live in `src/index.css`.

## Project layout

- `src/components/ui/` — shadcn components
- `src/components/AppLayout.tsx` — sidebar shell
- `src/pages/` — Overview, Paths, Service requests, Settings
- `src/lib/supabase.ts` — Supabase client
- `supabase/migrations/` — Postgres schema and RLS policies

# Setup

Getting this running, without reading the doc tree. Ten minutes if Docker is
already installed.

## Prerequisites

- **Node 22+** and npm.
- **git**, and network access to GitHub. The in-app agent's rulebook is a
  dependency — `agentic-service-blueprinting`, pinned by git URL at a tagged
  release — so `npm install` clones it. An offline install has no skill text.
- **Docker**, only if you want a local database. You can skip it and point at a
  hosted Supabase project instead.

## Install

```bash
npm install
npm run setup:env      # copies .env.example to .env if you have no .env yet
```

## A database

Pick one. Local is the default and needs no account.

### Local Supabase (Docker)

```bash
npm run supabase:start
npm run supabase:reset   # applies everything in supabase/migrations/
```

Copy the `API URL` and `anon key` the CLI prints into `.env`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon-key-from-cli>
```

`npm run supabase:stop` when you are done. Studio's URL is in the same CLI
output.

### Hosted Supabase

Create a project at [supabase.com](https://supabase.com), then `supabase link`
and `supabase db push` to apply the migrations. Take the URL and anon key from
**Settings → API** into `.env`.

### No database at all

Skip both. The app falls back to bundled fixtures in `src/data/` and is fully
readable — enough to work on layout, motion or copy. You will not be able to
write anything.

## Run it

```bash
npm run dev
```

Vite's default port, **5173**. The repo declares no other port, and nothing in
it starts a server anywhere else.

At this point you have the deployed experience: **read-only**. That is correct
— the deployed site has no sign-in, and write policies are `to authenticated`,
so a browser visitor cannot write by construction.

## Being able to write

Writing locally means signing in as a real auth user. **Not the service-role
key** — that bypasses policy and belongs in no browser bundle, ever.

1. Create a user in your project (hosted: **Authentication → Users → Invite
   user**; local: Studio's auth section).
2. Put the credentials in **`.env.local`**, which is gitignored:

   ```env
   VITE_SUPABASE_DEV_EMAIL=you@example.com
   VITE_SUPABASE_DEV_PASSWORD=…
   ```

3. Restart `npm run dev`. The app signs in on boot; RLS sees `authenticated`
   exactly as designed, and an "authoring" badge appears so the state is never
   ambiguous.

Just want to *see* the authoring surfaces — the View/Edit switch, Make slice,
the change counter — without a real session? `VITE_DEV_AUTHORING_UI=true` in
`.env.local` shows them. **It is not a permission**: a write still comes back
`permission denied`, and a badge says so.

`.env.example` documents every variable, including the ones you should not set.

## The gates

`main` is production — push to main deploys — so these three are the release
checklist, not a nicety:

```bash
npm test          # vitest: src/**/*.test.ts(x) + scripts/tests/**/*.test.mjs
npm run lint      # eslint; the baseline is ZERO problems and stays zero
npm run typecheck # the type-check on its own; npm run build runs it and bundles
```

Two more, both fast, both run in CI:

```bash
npm run check:harness   # every assembled component is claimed by one composition doc
npm run docs:index      # regenerate INDEX.md after moving or adding a doc
```

**`npx tsc --noEmit` checks nothing.** `npx tsc` is not this repo's compiler (it
resolves to an unrelated npm package), and `tsconfig.json` is a solution file
with `"files": []`. Use `npm run typecheck`.

## Where to go next

- [`CONTEXT.md`](CONTEXT.md) — the vocabulary. Read it before writing anything
  that names a domain concept.
- [`INDEX.md`](INDEX.md) — the map, routed by task.
- [`AGENTS.md`](AGENTS.md) — in force for every session, human or agent.

## When it does not work

| Symptom | Cause |
|---|---|
| Blank board, no errors | No `.env`, or the wrong URL/key. The app falls back to fixtures — check the console. |
| `supabase start` hangs or fails | Docker is not running, or a previous stack is still up. `npm run supabase:stop` first. |
| Writes fail with `permission denied for function …` | You are anon. That is the correct answer — set up dev sign-in above. |
| Types disagree with the database | Regenerate them: `npm run supabase:types` (hosted) or `:types:local`. |
| A mailed auth link lands somewhere unexpected | Your origin is not in the project's auth **Redirect URLs**. See [`docs/engineering/operations.md`](docs/engineering/operations.md). |

Deploys, rollback and the rest of the operational surface are
[`docs/engineering/operations.md`](docs/engineering/operations.md).

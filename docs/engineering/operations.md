---
audience: developers
summary: Deploy, rollback, dashboards, monitoring, inviting people, and the local-stack troubleshooting checklist.
sources: README.md, .env.example, src/components/EditorErrorBoundary.tsx, supabase/migrations/20260805170000_service_tier_rpc_enforcement.sql, package.json
last-reviewed: 2026-08-25
---

# Operations

## Deploy

Netlify builds from `main`: **push to main = production**, no staging
tier, no manual step. There is no `netlify.toml` in the repo — build
settings live in the Netlify site config (standard Vite build). The
deploy environment carries only the public Supabase URL and anon key;
nothing secret ever goes there
([access-and-security](access-and-security.md#environments) owns the
environment rules — never put the service key or dev credentials in
Netlify).

Because main is production, the gates in
[standards](standards.md#testing) — `npm test`, `npm run lint`,
`npm run build` — are the release checklist. Run them before pushing.

## Rollback

`git revert <commit>` and push. Netlify redeploys the reverted main;
that is the whole procedure. (The Netlify UI can also republish a
previous deploy for an instant rollback while the revert lands.)
Database changes do not roll back this way — migrations are append-only,
so an undo is a **new** migration
([access-and-security](access-and-security.md#migrations-workflow)).

## Supabase dashboards

One hosted project backs production. The dashboard is where you:

- watch API/Postgres logs and run the security/performance **advisors**
  (accepted advisor items are tracked in
  `todos/002-pending-p3-advisor-accepted-items.md`);
- manage users (see Inviting people below);
- run one-off SQL — reads freely; writes belong in migrations.

The local stack has its own dashboard (Supabase Studio, URL printed by
`npm run supabase:start`).

## Monitoring

There is no server-side monitoring, alerting, or error-reporting service
— deliberate for the current scale. What exists:

- **The `[editor] uncaught error:` console channel** —
  `EditorErrorBoundary` logs every recoverable crash there with the
  component stack before showing its reload surface. When someone reports
  "something went wrong", their DevTools console under that prefix is the
  incident record.
- Supabase dashboard logs for API-side failures (RLS denials, RPC
  exceptions surface here).

If a real error pipeline is added later, the boundary's `componentDidCatch`
is the single seam to hook.

## Local dev servers and auth redirects

There is one local dev port: **`5173`**. `vite.config.ts` sets no `server.port`,
so Vite uses its default and that is the whole story — the repo declares no
preview port of its own.

> Until 2026-08-23 this section named `5199` as "the canonical agent/preview
> port" and credited `.claude/launch.json` with starting the server there.
> Both halves were fiction: `5199` appeared nowhere else in the repo, and **no
> `.claude/launch.json` has ever existed here**. An agent harness that wants a
> declared port has to add one; until then, `npm run dev` on 5173 is it.

The origin has to be in the hosted project's auth **Redirect URLs** (Supabase
dashboard → Authentication → URL Configuration), alongside the **Site URL**
`https://uno-blueprint.netlify.app`. That allowlist is what makes emailed auth
links work: magic-link and recovery emails redirect to the requesting origin
only if it is on the list, otherwise Supabase silently falls back to the Site
URL. If a mailed link lands somewhere unexpected, check this configuration
first.

**Unverified:** the allowlist is dashboard state and cannot be read from this
repo, so it may still carry the fictional `5199` and may or may not carry
`5173`. Confirm `http://localhost:5173` is listed before relying on a mailed
link locally. Using any other port means adding that origin there too.

## Inviting people

Supabase dashboard → **Authentication → Users → Invite user** (email).
There is no in-app sign-up, and public sign-ups stay disabled
(verification tracked in `todos/001`).

Tiering happens at insert: the `flag_founding_service_accounts` trigger
(`supabase/migrations/20260805170000_service_tier_rpc_enforcement.sql`)
stamps `app_metadata.role = 'service'` for the founding emails listed in
its body. Anyone else lands as a **viewer** (read + agent chat, no
writes). To make a new service account, add the email to the trigger via
a migration — or set `raw_app_meta_data.role` on the user server-side —
before they first sign in; roles ride the JWT, so a change after sign-in
needs a session refresh to take effect
([access-and-security](access-and-security.md) has the enforcement
detail).

## Troubleshooting

- **`npm run supabase:start` fails immediately** — Docker Desktop isn't
  running. Start it first; the CLI needs the daemon.
- **Port conflicts** (54321–54324 already bound) — usually a stale stack
  from another checkout: `npm run supabase:stop` (or
  `supabase stop --project-id <other>`), then start again.
- **Types don't match the schema** (TS errors on columns you can see in
  the dashboard) — **edit `src/types/database.ts` by hand.** Both
  generator scripts redirect with `>`, which truncates the file before
  the CLI runs; if the CLI then fails — no link, no Docker, no network —
  the types are gone and the diff is the whole file. The hand edit is a
  few lines and the type is reviewed like any other code.
- **Local data looks wrong / half-migrated** — `npm run supabase:reset`
  cannot rebuild this schema. 157 of the 844 migrations replay against
  an empty database and fail, because the board is imported data and no
  migration creates a path, lane, step or cell; see
  [ADR 0009](../adr/0009-the-migration-series-is-a-narrative.md). Point
  local dev at the hosted project instead.
- **Writes fail with "permission denied for function …"** — you're not a
  service-tier session. Check the dev sign-in variables in `.env.local`
  and the matrix in
  [access-and-security](access-and-security.md#the-matrix-user-type--capability--where-it-is-enforced).
- **The app boots read-only in dev** — `.env` is missing the Supabase URL
  or anon key, or the dev sign-in failed (check the console for
  `[dev-login]`).

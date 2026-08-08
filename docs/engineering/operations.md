---
audience: developers
summary: Deploy, rollback, dashboards, monitoring, inviting people, and the local-stack troubleshooting checklist.
sources: README.md, .env.example, src/components/EditorErrorBoundary.tsx, supabase/migrations/20260805170000_service_tier_rpc_enforcement.sql, package.json
last-reviewed: 2026-08-08
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
  the dashboard) — regenerate: `npm run supabase:types` (hosted) or
  `npm run supabase:types:local`. Do this after every migration.
- **Local data looks wrong / half-migrated** — `npm run supabase:reset`
  replays all migrations + seed from scratch. Local data is disposable.
- **Writes fail with "permission denied for function …"** — you're not a
  service-tier session. Check the dev sign-in variables in `.env.local`
  and the matrix in
  [access-and-security](access-and-security.md#the-matrix-user-type--capability--where-it-is-enforced).
- **The app boots read-only in dev** — `.env` is missing the Supabase URL
  or anon key, or the dev sign-in failed (check the console for
  `[dev-login]`).

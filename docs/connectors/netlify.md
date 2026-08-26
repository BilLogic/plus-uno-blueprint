---
audience: developers
summary: The host — push to main is production, there is no netlify.toml, and the deploy environment carries only public values.
---

# Netlify

Netlify builds this repo from `main`. **Push to main is production**: no staging
tier, no manual promotion step.

**There is no `netlify.toml` in the repo.** Build settings live in the Netlify
site configuration as a standard Vite build. That is worth knowing before
looking for a config file that does not exist — and worth knowing before adding
one, since two sources of build configuration is the shape this folder exists to
warn about.

## What crosses the boundary

Only public values. The deploy environment carries the Supabase project URL and
the anon key, and nothing else: **no service-role key, no dev credentials, no
API keys.** The agent's provider keys are browser-held per user and never reach
a build. [engineering/access-and-security.md](../engineering/access-and-security.md)
owns the environment rules.

The site's origin also matters to the database: it must be the **Site URL** in
the hosted project's auth configuration, alongside any local origin that needs
emailed auth links to come back. That allowlist is dashboard state and cannot be
read from this repo.

## Consequences of "main is production"

- The gates in [standards](../engineering/standards.md#testing) — `npm test`,
  `npm run lint`, `npm run build` — are the release checklist, not a nicety.
  Run them before pushing.
- Rollback is `git revert` and push; the UI can also republish a previous deploy
  for an instant rollback while the revert lands. The procedure is
  [engineering/operations.md](../engineering/operations.md).
- **Database changes do not roll back this way.** Migrations are append-only, so
  an undo is a new migration. A revert of app code against a migrated database
  is a half-rollback, and knowing which half you got is the whole problem.

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

## What the two files in `public/` decide

There is no `netlify.toml`, but there are two files the host reads, and they
ship as part of the build because Vite copies `public/` verbatim.

- **`public/_redirects`** — the rules, taken **top to bottom, first match
  wins**. `/assets/*` answers **404** for a path with no file behind it, so a
  tab left open across a deploy gets a real not-found for a chunk that is gone
  instead of `index.html` served as a script. Below it, `/*` rewrites to
  `/index.html` with a **200**, which is what makes `/<service-slug>?cell=<id>`
  a real address. **The catch-all stays last**: anything added under it is
  dead.
- **`public/_headers`** — the Content-Security-Policy for every path, plus
  `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`. The
  year is safe because Vite puts the content hash in the filename, so a changed
  file is a different name. Nothing gives `/` or `/index.html` a long cache;
  the shell has to be re-fetched to learn the new hashes.

`scripts/tests/a-deep-link-is-a-real-address.test.mjs` holds both — the order
of the two rules and the immutable header — so a rule added in the wrong place
goes red rather than shipping.

---
audience: developers
summary: The host — push to main is production, netlify.toml carries only the path the app is served under, and the deploy environment carries only public values.
---

# Netlify

Netlify builds this repo from `main`. **Push to main is production**: no staging
tier, no manual promotion step.

**`netlify.toml` carries one setting and nothing else.** The other build
settings — the command, the publish directory, the Node version — are set in
the Netlify site settings, not in this repo, and cannot be read from it. The
file holds only
`BASE_PATH = "/blueprint/"` under `[build.environment]`, because the build and
the hosting test both have to read the same value: Vite takes it as `base` and
writes the output under `dist/blueprint/`, and the rules in `public/` sit under
the same prefix. Keep it to that one table; two sources of build configuration
is the shape this folder exists to warn about.

## Served under `/blueprint/`

The board is shown at `https://plus-uno.netlify.app/blueprint`. PLUS's own site
proxies `/blueprint/*` to this site's `/blueprint/:splat` with a 200, forwarding
the path unchanged, and this site serves the same files at
`https://plus-uno-blueprint.netlify.app/blueprint/` as the fallback. The proxy
rule lives in PLUS's repository, not here. A bare `/` on this site is sent to
`/blueprint/` with a 301, written by the build, since nothing else is served
at its root.

A local `npm run build` does not read `netlify.toml`: set `BASE_PATH=/blueprint/`
in the shell to build what production ships.

## What crosses the boundary

Only public values. The deploy environment carries the Supabase project URL and
the anon key, and nothing else: **no service-role key, no dev credentials, no
API keys.** The agent's provider keys are browser-held per user and never reach
a build. [engineering/access-and-security.md](../engineering/access-and-security.md)
owns the environment rules.

The app's address also matters to the database: its served path,
`https://plus-uno.netlify.app/blueprint`, is the **Site URL** in the hosted
project's auth configuration, because magic links and OAuth sign-ins return
there whenever the redirect they ask for is not on the allow-list.
[engineering/operations.md](../engineering/operations.md) lists the Site URL and
the allow-list, and says why each entry is there. Both are dashboard state and
cannot be read from this repo.

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

## What the host files decide

Two files the host reads ship as part of the build. Vite copies `public/`
verbatim, which brings `_headers`; under a prefix the copy lands in
`dist/blueprint/`, and the build moves it back up to `dist/`, the only place
the host reads it. The build also writes `dist/_redirects` itself for the
prefix, so this repository ships no `public/_redirects`. Every rule sits under
`/blueprint/`.

- **`dist/_redirects`**, written by the build — the rules, taken **top to
  bottom, first match wins**. A bare `/` is sent to `/blueprint/` with a
  **301**; it matches the root alone, so it shadows nothing.
  `/blueprint/assets/*` answers **404** for a path with no file behind it, so
  a tab left open across a deploy gets a real not-found for a chunk that is
  gone instead of `index.html` served as a script. Below it, `/blueprint/*`
  rewrites to `/blueprint/index.html` with a **200**, which is what makes
  `/blueprint/<service-slug>?cell=<id>` a real address. A `public/_redirects`
  added here is kept above those rules, and the build refuses one with a line
  that answers for the app (`/`, `/blueprint/` or anything under it).
- **`public/_headers`** — the Content-Security-Policy for every path, plus
  `Cache-Control: public, max-age=31536000, immutable` for
  `/blueprint/assets/*`. The year is safe because Vite puts the content hash in
  the filename, so a changed file is a different name. Nothing gives the shell
  a long cache; it has to be re-fetched to learn the new hashes.

`scripts/tests/a-deep-link-is-a-real-address.test.mjs` holds both at the prefix
it reads out of `netlify.toml`, through the same function the build calls — the
root redirect, the order of the two rules, the immutable header, and the
template's own hosting check over the same files — so a rule added in the wrong
place goes red rather than shipping.

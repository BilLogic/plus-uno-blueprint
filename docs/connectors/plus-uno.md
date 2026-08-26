---
audience: developers
summary: uno-bot reads this app's database and deep-links back into it — where the shared constants live, what has broken silently before, and what the probe does and does not catch.
---

# plus-uno (uno-bot)

**uno-bot** — the "le goat" Slack bot, a Cloudflare Worker living in the
PLUS-UNO kit repo — reads this app's database and builds deep links back into
it. It is the one live cross-repo invariant, and the reason it has a doc rather
than a comment is that it has broken silently twice.

This is an **instance integration, not harness.** The
`agentic-service-blueprinting` package must inherit nothing of it.

## The canonical home is here

`src/lib/blueprintContract.ts` is the canonical copy of every constant both
sides must agree on, and the bot vendors it. Not the other way round: two
coordination bugs shipped before that file existed — a renamed slices column and
a re-shaped `findings` column — and **each made a bot read return empty for
weeks** while both sides looked healthy.

What it carries: the query-param names the URL layer accepts, the production app
origin, the breadcrumb format the semantic view emits and the bot parses, the
public-read and bot-read table lists, the FK constraint names used as PostgREST
embed hints, the RPC names, and the search RPC's parameter and returned-column
names.

Keep that module **dependency-free** — the bot compiles it in a Worker context
with no access to app imports.

### The breadcrumb label that stays `'Layer'`

The breadcrumb's lane segment is still labelled `Layer`, deliberately, after the
`layer`→`lane` rename. All **808** corpus chunks carry `"Layer: …"` inside their
*stored title*, and the title is part of the **embedded** text — renaming the
label strands every embedding until a full re-embed. The parser accepts both
labels through the contract's `breadcrumb.aliases`, so this flips to `Lane` in
the same change that re-embeds the corpus, and not before. Root
[`CONTEXT.md`](../../CONTEXT.md) records it as a standing exception to the
rename.

> The comment beside that literal cites the parser as `breadcrumbAliases`; no
> such identifier exists in `src/`. The field is `breadcrumb.aliases`.

## The probe, and what it does not catch

`.github/workflows/bot-contract-probe.yml` calls the bot's unauthenticated
`/health/blueprint` endpoint on pushes to `main` that touch
`supabase/migrations/**` or `src/lib/blueprintContract.ts`, and nightly after
the bot's embed backfill. No secrets: the endpoint returns per-probe booleans
only, never data.

**It asserts `"ok":true`.** That is a boolean, and the drift that has actually
happened was *shape*: a renamed FK constraint, a changed RPC parameter, a view
whose returned columns moved. A boolean cannot see any of those, and an
unreachable database is not obviously distinguishable from a healthy one. Read
the current probe as an early warning, not as a guarantee — asserting shape is
tracked separately.

## When you change the schema

A full re-embed is required when `blueprint_chunks_src` changes, because that
alters chunk *text* without touching `cells.updated_at` and the nightly pass is
incremental — it would skip every row. The runbook step lives with the rest of
the operational facts, in
[engineering/access-and-security.md](../engineering/access-and-security.md),
where an operator looks.

## The eight coupling points in app code

The in-code comments are the only signal a reader gets while inside a file, so
they stay. They point here rather than each explaining the relationship:

- `src/lib/blueprintContract.ts` — the contract itself
- `src/lib/urlViewState.ts` — the param names
- `src/lib/openCellStore.ts` — the share link the bot builds
- `src/hooks/useCellDeepLink.ts` — the receiving end of it
- `src/contexts/BlueprintCellDetailContext.tsx` — where the link is produced
- `src/components/editor/EditorShell.tsx` — the `?cell=` boot deep link
- `src/lib/dependencyValidation.ts` — the cell key the arrows, the RPC and the
  bot all agree on
- `src/lib/agent/tools/read.ts` — the search entry point both readers call

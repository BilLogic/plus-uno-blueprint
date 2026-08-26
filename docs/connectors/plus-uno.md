---
audience: developers
summary: uno-bot reads this app's database and deep-links back into it — where the shared constants live, what has broken silently before, and the three checks that now hold the contract to the migrations, to the bot and to the database.
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

## What checks the contract

`.github/workflows/bot-contract-probe.yml` runs three jobs, against three
different subjects. Every expectation in all of them is derived from
`BLUEPRINT_CONTRACT` rather than written out a second time, so a constant added
to the contract is a constant that gets checked.

| Job | Subject | Runs on | Needs |
|---|---|---|---|
| `contract` | the migrations in this repo | every pull request, and pushes to `main` | nothing |
| `probe` | uno-bot's live reads, via `/health/blueprint` | pushes to `main`, nightly at 07:30 UTC | nothing |
| `live` | the database itself | not yet — see below | a project URL and anon key |

**`contract`** is `npm run check:contract` — `scripts/tests/blueprintContract.test.mjs`.
It holds every declared name to the SQL that produces it: RPC parameters and
returned columns, the embed-hint constraint names, the read surface, the RPC
names, and the breadcrumb labels `search_blueprint` builds. It also refuses to
let the contract grow an unchecked key: each top-level key must name the check
that covers it, and that check must mention it.

**`probe`** is `npm run check:bot-probe` — `scripts/check-bot-contract-probe.mjs`.
It used to be `grep -q '"ok":true'`, which passes on any body containing those
six characters and reveals nothing about which reads the bot still covers; a
probe that quietly *shrank* looked exactly like one that passed. It now asserts
shape: a `table_*` key for every entry in `botReadTables` and an `rpc_*` key for
the search RPC, each present and true, no probe key the contract does not
account for, and `ok` agreeing with the detail beneath it. Unreachable, non-200,
and not-JSON are each failures with their own message. No secrets: the endpoint
is unauthenticated by design and returns per-probe booleans only, never data.

**`live`** is `npm run check:contract:live` — `scripts/check-blueprint-contract.mjs`.
This is the edge the other two cannot reach. The `Phase` breadcrumb segment was
added to `semantic_search.blueprint_chunks_src` on **2026-08-17 with no
migration**; the canonical contract described a four-segment breadcrumb while
the database emitted five, and it was found two days later by a human running
`pg_get_viewdef`. A change that never becomes a migration is invisible to a
static check by construction. So this one asks the database: an anon select per
public-read table, each FK constraint sent as a real PostgREST embed hint, every
declared RPC parameter sent by name (a rejected call is bisected so the message
names the offending parameter), the returned columns read off a row that came
back, and the breadcrumb parsed out of the title the database actually emits.

It never passes without seeing its subject. Missing credentials, an unreachable
host, a wrong key and an empty result set are each a non-zero exit — a guard
that exits clean when it cannot see what it guards is the failure this replaces.

### Turning `live` on, and what it still will not reach

The job is gated on a repository **variable**, not a secret. The anon key is
publishable — it ships inside the deployed app bundle — but this repo
deliberately keeps it and the project URL out of git, so nothing in CI can find
them today and the job is skipped. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` as
repository variables and it runs. Locally it reads `.env.local`.

Two things stay out of reach of the anon role, and therefore out of CI:

- **`semantic_search.blueprint_chunks_src`**, the view whose titles are actually
  embedded. It is granted to `service_role` only and its schema is not exposed
  through PostgREST. `search_blueprint.title` is the anon-reachable witness for
  the breadcrumb — built by the same migration, in the same shape — but it is a
  witness, not the subject. `--service-role` with `SUPABASE_SERVICE_ROLE_KEY`
  checks the view itself, on a developer machine or a staging runner. That key
  never belongs in this repo's CI.
- **`semantic_search.match_corpus_chunks`**, for the same reason. The bot calls
  it over its own service-role connection. It is covered statically only.

One divergence surfaced while wiring this up and is **not** fixed here: the live
`blueprint_chunks_src` carries the `Phase` segment, the `lanes`/`scenarios`
renames and `cells.summary`, while the last migration to define the view still
emits four segments off `layers`/`service_scenarios`/`cells.description`. The
database is right and the migration series is stale, so a `supabase db reset`
would rebuild the view wrong. That is a migration to write, not a check to add.

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

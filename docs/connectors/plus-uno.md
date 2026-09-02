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
embed hints, the RPC names, and the search RPC's parameter names, returned-column
names, accepted `granularity` values and emitted row kinds.

Names and values are two different promises, and until 2026-08-26 only the first
was made. See below.

Keep that module **dependency-free** — the bot compiles it in a Worker context
with no access to app imports.

### The breadcrumb label, and why flipping one is a two-part change

The breadcrumb's lane segment is labelled `Lane`. It was `Layer` for six days
after the `layer`→`lane` rename, deliberately, and the shape of that delay is
the thing to remember rather than the label.

A breadcrumb label is not only rendered — it is **embedded**. The title
`semantic_search.blueprint_chunks_src` builds is part of the text that becomes
the vector, so every stored chunk carries the label it was embedded with.
Flipping the view alone leaves the index answering to a title no query will
match. Worse, the nightly backfill will not repair it: the nightly is
incremental and keys on `cells.updated_at`, and changing the TEXT of a chunk
does not touch a cell's timestamp, so it skips every row and reports success.

So a label rename is two parts:

1. the migration — `20260826140000` moved both places that build one, the view
   and `search_blueprint`'s cell branch
2. a **full** re-embed — Actions → *uno-bot — embed blueprint
   (semantic_search)* → Run workflow with `full: true`

and between them the contract's `breadcrumb.aliases` carries the old spelling
so both parse. That entry is empty again now
([#144](https://github.com/BilLogic/plus-uno-blueprint/issues/144)); the next
rename of an embedded label puts one back for exactly as long as its own
re-embed takes.

### The granularity value that no longer stays `'layer'`

`search_blueprint` accepts `granularity => 'lane'` and nothing else for that
rung. It briefly accepted `'layer'` too — from `20260826120000` to
`20260827100000` — and the shape of that window is the part worth keeping.

The bot vendors this contract and deploys on its own cadence, so a hard flip
risks breaking bot searches between the migration landing here and the bot's
next deploy. `'layer'` was kept valid on input to cover that window. When the
window closed the gate turned out to be smaller than it had been written: the
reasoning was inherited from `20260820120100`, which renamed a PARAMETER, and
PostgREST binds RPC arguments by name — a parameter rename really can break a
caller mid-deploy. An accepted VALUE cannot, unless a caller sends it, and
neither did: uno-bot never sends `granularity` at all, and this app's agent only
knows `lane` and rejects anything else client-side. Worth writing down, because
the next deprecation will want to know which kind of change it is.

This was the second half of a rename that stopped halfway. `20260820120100`
renamed the parameter `filter_layer_role` to `filter_lane_role` and went no
further, so the guard clause inside the function body went on **rejecting the
only word the rest of the model uses** — `public.lanes`, `c.lane_id`,
`l.lane_role`, the output column `lane` — and accepting the one nothing else
does. It stayed that way on production for six days with all three jobs below
green, because the contract declared the parameter's NAME and nothing had ever
declared its VALUES. `check:contract:live` asserts every declared name binds; it
has nothing to say about a value it was never told
([#144](https://github.com/BilLogic/plus-uno-blueprint/issues/144)).

`searchBlueprintGranularity` and `searchBlueprintKinds` are the declaration that
was missing. The emitted kind got no grace period — a row kind is one value with
nowhere to put an alias, unlike `breadcrumb.aliases` — so it flipped to `'lane'`
outright in `20260826120000`.

`searchBlueprintGranularity` no longer has a `deprecated` list beside its
`accepted` one; it was emptied and then removed with the guard
([#150](https://github.com/BilLogic/plus-uno-blueprint/issues/150)). The next
rename that needs one adds it back with an issue number attached, because the
value of that list was always its emptiness being a decision.

### The vocabulary pass that moves four things the bot reads

`20260830190000` is the widest change this relationship has had to absorb, and
it is worth reading before the bot's next deploy rather than after. Four names
the bot depends on move at once:

| Was | Is | How the bot sees it |
|---|---|---|
| table `findings` | `audit_findings` | a direct PostgREST read, and the `/health/blueprint` probe key |
| `findings.check_name` | `audit_findings.check_key` | read off the row by key |
| `findings.note` | `audit_findings.summary` | read off the row by key |
| `cell_dependencies.label`, `.note` | `cell_dependencies.name`, dropped | read off the edge row |
| `search_blueprint(filter_path_type)` | `filter_path_kind` | sent by name |

`publicReadTables`, `botReadTables` and `searchBlueprintParams` all moved with
them, so **the bot's `--check` sync fails until its vendored copy is
refreshed** — which is the mechanism working, not a surprise. Refresh the
vendored contract and deploy the bot before this migration is applied.

Two things deliberately did NOT move, and both are the same distinction. The
include VALUE `'findings'` is a word on the wire naming a category of result,
not a relation, so `searchBlueprintInclude` still says `findings` while the
table is `audit_findings`. And the output column `description` is the row's
prose column whatever the underlying table calls it —
`searchBlueprintColumns` has said so since it was written.

The `search_blueprint` `links` payload keys move with their columns (`label` →
`name`, `check_name` → `check_key`, `slice_type` → `kind`). Those are not in
the contract, so nothing fails when they drift: the bot reads them by key in
`integrations/blueprint-include.ts` and would simply start getting
`undefined`. That is the shape this document exists to prevent, and it is
recorded here rather than fixed because adding them to the contract is a
change to what the contract is FOR, not a rename.

The skills package is the third side of this. `agentic-service-blueprinting`
still writes the retired `slice_type` and `check_name` spellings, and `origin`
on slices, from its own `slice_tools.py`
and documents them in `skills/audit/SKILL.md` and the playbooks. It is a
git-URL dependency pinned to a tag, so the fix goes upstream and arrives here
as a version bump — which has to happen in the same window.

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
names the offending parameter), every declared `granularity` value sent as a
value and bisected the same way, the returned columns read off a row that came
back, the row kinds read off the rows the structural rungs produce, and the
breadcrumb parsed out of the title the database actually emits.

The granularity call deliberately leaves `cell` out. With no query text and no
embedding, cell rows sort ahead of structural ones and there are eight hundred of
them, so asking for both returns `match_count` cells and no rung at all — the
cell kind is covered by the call above it.

Since #259 it also reads the constraints themselves. `public.value_sets()`
returns every single-column CHECK and every domain as the catalog deparses it,
and the check holds each value set a swept document states — "`kind` is
`happy`, `variant`, `exception`"; "the `entity_status` domain: …" — to the set
the constraint accepts, by equality, because "these three" is false the day a
fourth lands. A list naming a value the rename map retired — `single`,
say — fails wherever it stands, unless the sentence records the retirement
and cites the migration. And `public.schema_comments()` returns
every table and column comment, which get the same three sweeps markdown gets
— retired spellings, qualified names, value lists — because the agent-facing
schema section is rendered from them (#260): a `paths` comment still reading
"happy, unhappy, exception, alternative" ships to an agent exactly as a stale
doc does. `pg_catalog` is exposed to no PostgREST role, which is why both are
functions and why both are granted to `anon`: a constraint's definition is not
a secret, and the CI job runs under the anon key. `scripts/value-set-claims.mjs`
holds the grammar; `scripts/tests/value-set-claims.test.mjs` holds it to the
shapes that are claims and the four that are not.

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

One divergence surfaced while wiring this up and is now closed by
`supabase/migrations/20260826000000_the_embedding_view_the_database_actually_runs.sql`
(plus-uno-blueprint#130). It is worth recording what it actually was, because
the first diagnosis was half wrong.

The live `blueprint_chunks_src` carries the `Phase` breadcrumb segment, the
`lanes`/`scenarios` renames, `cells.summary`, and seven appended chunk fields
(Function, Form, Value, Owner, Perceived owner, Lane owner team, Lane KPIs).
Only the `Phase` segment and those seven fields were ever a divergence. A view
stores its dependencies as column numbers on table OIDs rather than as text, so
the renames rewrote themselves through the view for free — a replay of the
series already produced `lanes`, `scenarios` and `c.summary`. What it could not
produce was the material no migration had ever contained; `'Perceived owner: '`
and `'Lane KPIs: '` appeared nowhere in this repository until that migration
landed.

The failure was silent rather than loud: a rebuilt environment got the same 784
rows with shorter chunks — five breadcrumb segments collapsed to four, and every
chunk missing the fields that carry ownership and value. Embeddings built on top
of that would be wrong with nothing to announce it.

## What the bot reads about the blueprint

`docs/agents/blueprint.md` is the blueprint's account of itself for every
agent (#260): a hand-written core — retrieval, absence, what a status
licenses, how paths relate to the main route — and two rendered sections, the
entity vocabulary from `src/lib/panelTerms.ts` and the schema from
`pg_description`. It is the file to vendor beside the contract; the harness
should read it rather than carry its own description of the tables.
`npm run check:agent-account` holds it to its sources in the same live job as
the contract check.

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

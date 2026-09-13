# PLUS Uno Blueprint

A living service-blueprint editor for the PLUS tutoring program. The whole
service journey — every phase, scenario, and touchpoint, above and below the
line of visibility — mapped as an explorable canvas: readable by anyone,
editable by the service team, and worked on by AI agents under the same rules as
humans.

Built with React + Vite, [shadcn/ui](https://ui.shadcn.com/) (base-ui flavor),
and [Supabase](https://supabase.com/). Desktop is the full editor; phones get
the same canvas, view-only and scoped to one scenario at a time — the drawer is
the only way to move between them.

## Five files at the root

Each answers one question. Read the one you have.

| File | Answers |
|---|---|
| **README.md** (this) | What is this? |
| [**SETUP.md**](SETUP.md) | How do I get it running? |
| [**CONTEXT.md**](CONTEXT.md) | What do these words mean? |
| [**INDEX.md**](INDEX.md) | Where do I go for my task? — generated from every doc's frontmatter |
| [**AGENTS.md**](AGENTS.md) | What must I not do? — in force for every session |

Quick picks: *"what is this product?"* →
[`docs/product/01-overview.md`](docs/product/01-overview.md) · *design work* →
[`docs/guidelines/overview.md`](docs/guidelines/overview.md) · *where does code
live* → [`docs/engineering/codebase-guide.md`](docs/engineering/codebase-guide.md).

## It runs the template

The app is not written here. It comes from
[agentic-service-blueprinting](https://github.com/BilLogic/agentic-service-blueprinting),
the open-source template this deployment is one instance of, pinned in
`package.json` by release tag — a tag rather than a branch, so a consumer
always knows exactly which code it is running.

A shared file that this repository also carries is held **byte-identical** to
the template's copy. `npm run check:reconciled` is that promise, and it fails
CI if either side moves. The set it holds only grows: enrolling a file is how
a difference stops being something somebody has to remember.

Where a shared file has to change, the change goes **upstream first** — into
the template, released, then adopted here with a pin bump. The alternative,
editing the copy, is how a deployment quietly becomes a fork. What stays local
is what is genuinely this deployment's: its config, its environment, its
content, its brand, and the database that holds them.

One consequence worth knowing before writing a comment: a file in that set is
read in two repositories at once, so it **cites no issue, ADR or migration
number**. Each of those is an address in one repository and means something
else in the other. Name the decision instead.

## How `docs/` is arranged

Two lanes, never mixed.

- **Reference** — living, always true. `product/` (what the thing is and how to
  read it), `guidelines/` (the design system: `foundations/`, `components/`,
  `composition/`), `engineering/` (how the code works), `reference/` (fixed
  vocabularies and id maps), `adr/` (decisions that are surprising or hard to
  reverse), `connectors/` (everything crossing a repo boundary).
- **The queue** — [GitHub Issues](https://github.com/BilLogic/plus-uno-blueprint/issues),
  not a folder in the tree.

Anything that is neither a living reference nor an open ticket is git history.
Working documents — plans, ideation, brainstorms — are written in the issue
they belong to and land as commits; a decision worth outliving its ticket
becomes an ADR. `docs/archive/` is not a third lane: it holds forensic
evidence about the database, and states its own reason for being kept.

`overview.md` is authored; `index.md` is generated. Every doc carries a
frontmatter `summary`, and a doc without one fails the index build.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server on 5173 |
| `npm test` | vitest (`src/**/*.test.ts(x)` + `scripts/tests/**/*.test.mjs`) |
| `npm run lint` | eslint — the baseline is zero problems |
| `npm run typecheck` | the type-check; `npm run build` runs it and bundles |
| `npm run check:harness` | every assembled component is claimed by one composition doc |
| `npm run check:reconciled` | every shared file is still byte-identical to the template's copy |
| `npm run check:live-coverage` | every check that asks the database declares where CI runs it, and no pull-request workflow names a privileged credential ([ADR 0017](docs/adr/0017-a-check-that-cannot-see-its-subject-says-so.md)) |
| `npm run docs:index` | regenerate `INDEX.md` after a doc move |
| `npm run supabase:start` / `:stop` | local Supabase lifecycle (`:reset` cannot rebuild this schema — [ADR 0009](docs/adr/0009-the-migration-series-is-a-narrative.md)) |
| `npm run apply:pending -- --from=<version>` | what is written and not applied (add `--apply` to write) |

Deploys ship from `main` via Netlify — push to main is production. Environments,
rollback and troubleshooting:
[`docs/engineering/operations.md`](docs/engineering/operations.md).

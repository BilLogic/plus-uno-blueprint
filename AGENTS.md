# Working in uno-blueprint

Short by design. This file is the whole always-loaded tier, and every routing
item in it is a **pointer** — a trigger word, then the document that carries the
body — or a **security line**, which stays inline by rule because it binds
before any pointer could fire. Three checks hold that shape:
`scripts/check-router-budget.mjs`, `scripts/check-negation-ratchet.mjs`,
`scripts/check-pointers.mjs`. Where a rule here fights the code, the code is
newer; say so and follow the code.

## Boot protocol (read this order, load on demand)

1. **Vocabulary** — the words this codebase fixes, and what each is bound to in
   the schema: `CONTEXT.md`. Definitions only, so it is cheap; a term it fixes
   keeps the spelling it has there.
2. **Routing** — `INDEX.md` (root, GENERATED) is the map: a task-routing table
   plus every living doc's one-line summary. Route by TASK row.
3. **Writes** of any kind read `docs/engineering/access-and-security.md` first —
   which user type this session runs as decides which tools and paths are even
   legitimate. The plain-language capability table is
   `docs/product/01-overview.md`.
4. **Placement** — where a task belongs, when nothing above answers it:
   `docs/engineering/codebase-guide.md`.
5. **History** — `docs/plans/`, `docs/ideation/` and `docs/brainstorms/` are
   decision-era snapshots; read frontmatter `status` / `distilled-into` before
   acting on one.

## Security lines (non-negotiable — inline by rule, so they bind before any pointer fires)

- Keys and secrets live only in gitignored `.env` / `.env.local` or browser
  localStorage. Anywhere else is a leak — a committable file, chat, the Netlify
  environment, a literal value written into a doc:
  `docs/engineering/access-and-security.md` § Environments.
- Never widen RLS or write policies; the deployed site stays read-only.
- Never widen a column grant. RLS decides *who* writes and is silent on *which
  columns*, so the grant is the whole of the boundary between what a panel
  writes and what an RPC records. `authenticated` holds no table-level UPDATE
  anywhere and no key column outside three named ones (`20260830290000`); a new
  panel column means a line in `PANEL_COLUMNS`
  (`scripts/check-rls-posture.mjs`) and a migration, never a table grant.
- Local writes authenticate as the dev auth user (auto sign-in from
  `.env.local`); **never the service-role key**, which bypasses policy and
  belongs in no browser bundle.
- Every blueprint-content write goes through `src/lib/authoringRpc.ts` or a
  `src/lib/*Mutations.ts` module, so it lands in the session ledger with a
  captured revert. Nothing else writes to a table, and
  `src/lib/writeBoundaryContract.test.ts` walks all of `src/` to hold that
  rather than leaving it to convention. In a mutation module: capture the
  previous value as the inverse **before** the write, write with `.select()` so
  a zero-row update fails loudly, then `recordChange`. Deletes are human-only.
  The two exemptions, and why each is deliberate:
  `docs/engineering/access-and-security.md` § Authoring writes.

## Progressive loading

| Trigger | Load |
|---------|------|
| Composing a surface, or reaching for a primitive | `docs/reference/ui-inventory.md` — the need→primitive map, and the rule that `src/components/ui/` is the design system to compose rather than re-hand-roll |
| React state, effects, or state shared across surfaces | `docs/engineering/codebase-guide.md` § State idioms |
| Patterns worth copying — picker, review-then-commit list, sidebar menus, panel postures | `docs/engineering/codebase-guide.md` § Patterns to copy, by problem shape |
| Styling anything — colour, spacing, motion, elevation, any raw value | `docs/engineering/standards.md` § The Supabase benchmark, concretely |
| Running the gates — test, lint, typecheck, docs index, composition claims | `docs/engineering/standards.md` § Testing |
| Commands behaving oddly — `tsc`, shell globs, generated files, canvas assets | `docs/engineering/standards.md` § Tooling traps |
| Skills — `/sb:map`, `/sb:audit`, `/sb:whatif`, `/sb:slice` are the installed `sb` plugin's, authored upstream and absent from this repo | `docs/engineering/agent-system.md` § Skills and the pinned-package contract |
| Blueprint reads — retrieval, absence, what a status licenses, the schema as the catalog describes it | `docs/agents/blueprint.md` |
| Migrations, applying or replaying one | `docs/engineering/access-and-security.md` § Migrations workflow |
| Deploying, rolling back, monitoring, inviting someone | `docs/engineering/operations.md` |
| Crossing a repo boundary — the template, the pinned package, the bot, Netlify | `docs/connectors/` |

## Agent skills

Config the `mattpocock-skills` engineering skills read. Open the file a skill
names when it asks for it, rather than preloading all three.

### Issue tracker

- **Issues** are GitHub Issues on `BilLogic/plus-uno-blueprint`, via the `gh`
  CLI: `docs/agents/issue-tracker.md`.

### Triage labels

- **Labels** are the five canonical roles, strings unchanged (`needs-triage`,
  `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`):
  `docs/agents/triage-labels.md`.

### Domain docs

- **Domain** is single-context: one root `CONTEXT.md` plus `docs/adr/`, both
  created lazily by `/domain-modeling`: `docs/agents/domain.md`.

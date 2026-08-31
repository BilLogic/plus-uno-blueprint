---
status: accepted
audience: developers
summary: The migration series records how the schema was reasoned about, not how it can be rebuilt — the board arrived as imported data, so 157 files can never replay, and the two ratchets exist because of that rather than in spite of it.
---

# The migration series is a narrative, and the board is imported data

`supabase/migrations/` holds 844 files. A from-scratch replay of them applies
687 and fails 157. That is the accepted state, not a defect queue.

**Every one of the 157 fails for one reason: no migration in the series ever
creates a path, a lane, a step or a cell.** The board was imported. The content
seeds from 2025 then edit rows that a replay has never had, and a trigger stops
them:

```
[replay] 687/844 applied, 157 failed (syntax 0, assertion 18, data 139, structure 0)
[replay] first failure: 20250603170000_warm_up_step2_cells.sql
          — cells: layer_id or step_id does not exist
```

So the series is two things at once, and only one of them is true of the whole:

- **Structure** — every table, column, constraint, policy, function and grant —
  replays. That half is a reproduction.
- **Content** — the seeds and repairs that shaped one particular board — does
  not, and cannot without the import that preceded it.

## Why this is written down rather than fixed

Three ways to "fix" it were considered under #148 and each is worse than saying
what is true.

**Repairing the ledger for all 844 files** would record them as applied, making
`supabase db push` usable. It would also assert that 157 files replay when they
demonstrably do not, and it buys a command nothing here uses.

**Stripping the assertions from the 157** would turn the replay green. Those
files carry no DDL: an assertion is the only thing in most of them that can
fail, so the green would prove strictly less than the red does. A red ratchet
that names its root is worth more than a green one that hides it.

**Squashing to a `pg_dump` baseline** would make `supabase db reset` meaningful
for the first time, and it remains the only route to that. It is not free: ten
scripts read `supabase/migrations/` as a corpus — the static replay behind
`check:identifiers`, `check:proof-footprint`, `check:new-table-grants`,
`check:write-surface`, `lane-roles`, `check:database-names` among them — and
each would have to be told which corpus it is asking about. `db reset` also
needs Docker, which the machine this is developed on does not have. Deferred,
not rejected: if a second environment ever has to be built from nothing, this is
the decision to revisit first.

## What holds the line instead

**`npm run apply:pending -- --from=<version> --apply`** is the apply path. Each
file goes in inside one transaction with its ledger row written **within** it,
under the filename's version rather than the apply time. The five migrations
since 2026-08-30 went in this way, so going forward the files *are* the apply
path — which is what the historical 168 without a ledger row never were.

**Two ratchets, both recording a set that may shrink and never grow.**

| Ratchet | Records | Fails when |
|---|---|---|
| `docs/reference/migration-replay-baseline.json` | the 157 that cannot replay | a NEW file joins them |
| `docs/reference/migration-ledger-baseline.json` | 168 never applied, 37 applied without a file, 12 duplicated names | a new file is written and never applied |

Neither is a threshold that someone can be tempted to raise. A new entry in
either is the #148 gap happening again, which is the only thing they are for.

## The rule that keeps the replay honest

**An assertion in a migration is an invariant, never a census.** "Expected 3
partner lanes" is a measurement of production on the day; asserted in a file it
raises on every empty replay, and because a migration is one transaction it
rolls back its own DDL and everything downstream that needed it. One such
assertion in `20260821340000` was holding 187 files hostage.

The repair is always the same: scope the claim to the rows the file was given to
work with, so an empty database satisfies it vacuously and a populated one gets
the same answer the count gave. Twenty-nine files were repaired this way across
#199, #211, #214 and #219, taking the failing set from 193 to 157.

## Consequences

- `supabase db reset` and `supabase db push` do not work here and are not
  expected to. Neither appears in any workflow.
- A migration file is the record of intent for a change; the database is the
  record of fact. Where they disagree, `check:migration-ledger:live`,
  `check:rls-posture:live` and `check:identifiers:live` are how the
  disagreement is found — all three read the database, none of them the files.
- A new migration must replay against an empty database. If it cannot, it is a
  census, and the ratchet will say so on the next run.
- **The plausible "fix" that would undo this:** running
  `supabase migration repair --status applied` across the series to make
  `db push` work. That reintroduces exactly the claim this record exists to
  retire — that the files are a reproduction of the schema.

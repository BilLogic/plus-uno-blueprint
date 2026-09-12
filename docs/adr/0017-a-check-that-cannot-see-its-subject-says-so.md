---
status: accepted
audience: developers
summary: Each live check is answered on its own — publishable credentials run on every pull request, privileged ones run nightly and never on a pull request, one stays manual — and whatever the answer, a job that did not verify something says which thing, on every pull request.
---

# A check that cannot see its subject says so

Eight checks in this repository ask a live subject rather than the files.
Before this record they had one policy between them — "a privileged database
credential never belongs in this repository's workflows" — and the policy was
applied to all eight by association, including to the ones that need no
privileged credential at all. The result was a blind spot with a green tick
over it.

`check:identifiers` replays `supabase/migrations` on every pull request.
`check:identifiers:live` asks `pg_catalog`. A rename written into the files and
never applied passes the first and fails the second, and the second ran when
somebody remembered — so `stakeholders.parent_id` and `agent_sessions.user_id`
stayed in production long enough for a template's account of the schema to
disagree with this deployment's database, and for a person rather than a check
to notice.

## The decision, one per check rather than one for all

The three kinds of credential are three different risks, and they get three
different answers. `scripts/live-checks.mjs` is the declaration;
`npm run check:live-coverage` is what holds the workflows to it.

**Nothing to supply, or a publishable credential → every pull request.** The
project URL and the anon key already ship inside the deployed browser bundle,
so publishing them to Actions adds no exposure whatever. They are repository
variables, and `check:contract:live`, `check:agent-account` and
`check:auth-posture` have run on every pull request since they were set. The
cost is real and accepted: a Supabase outage reddens a branch that changed no
SQL. It is the correct trade against a guard that reports agreement it never
checked, and it was already being paid before this record — what this record
adds is that it was a decision.

**A privileged credential → nightly, and never on a pull request.** The catalog
checks — `check:identifiers:live`, `check:rls-posture:live`,
`check:database-types:live` — need a direct `postgres://` string, password and
all, because `pg_catalog`, `information_schema` and `supabase_migrations` are
reachable through no PostgREST role. The reason this may not be a pull-request
job is sharper than "a secret is dangerous": a same-repo pull request is handed
the repository's secrets **and supplies the workflow file that will read
them**, so a privileged credential named by a pull-request workflow is one any
branch author can print. A scheduled run on `main` runs the workflow that was
reviewed and merged, and has no such hole.

Nightly is also the right cadence on its own merits. The subject is
production, and a pull request does not change production; what changes it is
an apply, which a person performs. A daily sweep bounds a divergence at one
day. That is the whole promise `.github/workflows/live-schema.yml` makes.

**A tool in a loop → manual, and said out loud.**
`check:migration-ledger:live` stays manual. It is a step in the apply loop
rather than a watch on production — `apply:pending` ends by naming it, its
baseline is a committed ratchet, and clearing a failure means editing that
baseline. A nightly red that no runner can clear is precisely the unread job
this arrangement exists to avoid. Manual is a real answer here, not a
placeholder; the price of giving it is the paragraph below.

## Whatever the answer, the absence is loud

This is the part that would have been worth having on its own, and the part
that is true regardless of which of the three answers a check gets.

Every pull request ends by printing, from that same declaration, which live
checks ran in it and which did not — a `::warning::` annotation and a
job-summary line each, naming what went unverified and where it is covered
instead. The nightly does the same in the other direction: with no credential
it does not pass quietly, it raises a warning per check saying it verified
nothing and which repository secret would change that.

A skipped job in a green checks table reads exactly like a job that passed.
That was the defect, one level below the credential question, and it had
already appeared twice here — a `live` job gated on a repository variable that
had been set a fortnight earlier and still showed grey, and an auth check whose
`continue-on-error` swallowed "looked at nothing" for weeks.

## Consequences

- Turning the nightly on is one repository **secret**, `SUPABASE_DB_URL`, and
  nothing else. Until it is set, the nightly runs, verifies nothing, and says
  so every day; every pull request says so too.
- `check:live-coverage` fails if a new `:live` script is added without
  declaring where CI runs it, or if any workflow a pull request can trigger so
  much as names a privileged credential. The standing rule stopped being a
  sentence in a comment and became an assertion.
- A privileged job runs `main`'s copy of its own workflow or none.
  `workflow_dispatch` takes a ref, and a branch's copy of that file could say
  anything, so the job refuses a ref other than `main` loudly rather than
  skipping.
- Every pull request now carries warning annotations that are not failures.
  They are permanent by design: the sentence "these ticks did not look at
  production" stays true after the nightly is armed.
- **The plausible "fix" that would undo this:** putting `SUPABASE_DB_URL` into
  the pull-request workflows so the catalog checks block a merge. It would read
  as strictly more coverage and would hand a printable database password to
  every branch author.

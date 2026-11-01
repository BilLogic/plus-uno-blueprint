---
audience: developers and blueprint authors
summary: Review and apply a ticket's JSON changeset through the pinned mutation modules, then verify content, structure, counts and durable inverses by reading the database back.
---

# Content changesets

Changesets live in `changesets/`, one JSON file per ticket. The runner is
`scripts/run-content-changeset.mjs`. It loads the pinned package's actual
authoring RPC and mutation modules through Vite, so column grants, placement
syncing and inverse shapes follow the application. This is deployment tooling;
it does not change the template, the schema, grants or policies.

## Review, apply, verify

Configure this worktree's gitignored `.env.local` with `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_DEV_EMAIL` and
`VITE_SUPABASE_DEV_PASSWORD`. The runner signs in as the dev auth user, checks
`authenticated` in its access token and `service` in its app metadata, and
refuses secret/service-role API keys and the `rpc_writer` tier. Never put
credentials in a changeset, command argument, report or PR.

```sh
node scripts/run-content-changeset.mjs changesets/0738-created-in-app.json --dry-run
node scripts/run-content-changeset.mjs changesets/0738-created-in-app.json --verify
# After Bill replies "approved" on the ticket:
node scripts/run-content-changeset.mjs changesets/0738-created-in-app.json --apply
node scripts/run-content-changeset.mjs changesets/0738-created-in-app.json --verify
```

Post the dry-run output on the ticket, including its SHA-256 and every
mismatch. Run the verifier before applying to show the expected failure.
Wait for Bill's ticket approval before applying that exact file. A mismatch
aborts the whole batch before writes; investigate it rather than updating an
expected value just to make the check pass. Post the passing verifier output
before closing the ticket. Follow GitHub's native dependency frontier for the
next ticket. Do not close the parent spec.

Dry-run performs reads only and re-reads the touched rows and durable log
count to detect a change during the run. Apply preflights every operation and
count, checks the captured row again immediately before its mutation, waits
for durable appends, reads every logged inverse back, and verifies the full
post-state. Zero-row writes fail through the package's `requireRowsWritten`.
All modes return JSON with `ok`, `failures` and `diff`; failure exits nonzero.
Verify without an apply receipt reports the content differences but cannot
pass durable-log verification.

## Shape

The tracer file is a complete example. Its expected values came from a hosted
read on 2026-10-20. Each operation has:

- `key`: a unique name, used by later references.
- `operation`: one of the supported operations below.
- `target`: `table` plus an `id`, `cell_key`, or scoped `where` object. An id
  can be a full UUID, prefix, `…suffix`, or `prefix…suffix`. Every page of the
  scoped result is read before matching; ambiguity fails. `cell_key` is exact.
- `expected`: exact prior field values for an edit, including every field
  being changed; additional identity guards are encouraged. Creation uses
  `null` and a unique parent/name or parent/slot scope.
- `value`: the fields the operation should leave in the database. Use trimmed
  text and `null` for an empty optional field. Statuses are explicit.
- `evidence`: nonempty source citations. To attach a citation to a cell,
  include an `add_evidence` operation; a citation in this array alone does not
  create an evidence row.
- `input`, when needed: structural RPC options described below.

An id-valued field can use `{ "ref": "earlier-operation" }`, or
`{ "ref": "earlier-operation", "field": "cell_key" }`. References read a
preceding operation's row. A pending new parent makes its child absent during
preflight; creation is still checked against the actual scope before writing.
Supply new rows' prose in their creation operation. The runner cannot preflight
an edit to a row that does not exist yet.

When a path RPC copies lanes with fresh ids, use a scoped read-only lookup for
the cell's lane id, for example:

```json
{ "lookup": { "table": "lanes", "where": { "path_id": { "ref": "new-path" }, "name": "Regular Tutor" } } }
```

A lookup resolves exactly one row's id, or the identity column `field`
names on a row without its own id, such as a `path_steps` membership's
`step_id`; missing, ambiguous or empty results fail. During preflight a
lookup under a pending new parent stays pending.
Apply resolves it after that parent is created, and separate verify resolves
it again from the database. This adds reads, not a new write operation. Keep
parent ids in the scope; a name alone does not identify a lane across paths.

`checks` is an array of `{ target, beforeCount, afterCount }`. Use it for
every touched path/scenario's paths, steps, lanes and cells, and for evidence
counts. Optional `beforeRows` and `afterRows` describe every row in that scoped
set using the fields worth asserting: parent ids, names, positions and edge
types. Matching is unordered and one-to-one. This checks entities an RPC
creates as side effects, including copied lanes and a scenario's initial path.

## Supported writes

| Operation | Target / fields | Additional input |
|---|---|---|
| `update_cell_content` | `cells`; content, summary, status, owner, perceived_owner | Actual `cellContentMutations.updateCellContent`; captures all prior text fields and synced placements |
| `update_cell_status` | Existing `cells`; status alone | Actual `updateCellStatus`; preserves blank text, all other fields and placements, and awaits its durable ID. A same-status batch is refused during preflight because it would produce no write/record |
| `rename_step` | Existing `steps`; name | Actual optional host `renameStep`; required `input.expected_path_steps` lists every `{ path_id, position }` membership at review time |
| `move_cell` | Existing `cells` by id/key; all four coordinates in both expected and value | Actual optional host `moveCell`; path_id/lane_id/step_id/position, same scenario, valid source/destination memberships, vacant destination, no conflicting incident edges |
| `insert_cell_at_position` | New `cells`; scope path_id/lane_id/step_id/position; content/status | Actual optional host `insertCellAtPosition`; insert-only, explicit nonnegative position and status, server-minted ID/key, preserves existing conversations |
| `upsert_cell_at_status` | New `cells`; scope path_id/lane_id/step_id/position=0; content/status, optional summary | RPC records creation; optional summary uses the cell mutation and captures a second inverse |
| `create_path_at_status` | New `paths`; scope scenario_id/name; kind/status, optional summary/note | Optional input.lane_source_path_id; optional prose uses updatePathSpec |
| `set_path_status` | Existing `paths`; status | RPC records itself |
| `create_scenario` | New `scenarios`; scope phase_id; name/layout, optional summary | Optional input.lane_source_path_id, lane_set, step_count, path_name; the RPC creates at least one placeholder step even when step_count is 0; verify its generated path/lanes/steps in checks |
| `add_step` | New `steps`; scope scenario_id/name; name, optional summary | Required input.path_id; optional input.at_position; check path_steps positions |
| `add_lane` | New `lanes`; scope path_id/name; name/lane_role | Required input.scenario_id; optional input.at_position; creates a lane on every path, so check all of them |
| `set_path_steps` | `paths`, target.withSteps=true; expected.step_ids and value.step_ids in order | Captures the previous full list before calling the RPC and recordChange |
| `set_cell_dependency` | New `cell_dependencies`; scope source_cell_id/target_cell_id/kind; kind, optional name/note | Required input.expected_source and input.expected_target, each naming at least path_id/lane_id/step_id/scenario_id; both ends are read through to their service and must still match, and a cross-service link is refused before any write. The ends may sit on different paths or scenarios. An RPC that reports an update instead of an insert fails; the recorded inverse is `clear_cell_dependency` |
| `update_cell_dependency` | Existing `cell_dependencies` by id; kind, optional note | Actual `updateCellDependency`, the in-place edit: same row id and ends, so a retype never leaves the old edge drawn. Requires input.expected_source and input.expected_target as for `set_cell_dependency`. Refuses a no-op and an existing edge of the new kind between the same cells. The RPC's reported prior row and the logged self-inverse `update_cell_dependency` must match the preflight row |
| `set_placement_touchpoint` | Existing `cell_touchpoints`; touchpoint_id or name | Actual placementLinkMutations; captures the prior registry/name pair |
| `add_evidence` | New `evidence`; scope service_id/cell_id/cell_key/title; title/kind/note | Actual evidenceMutations.addEvidence; the delete inverse is recorded, never executed by this runner |
| `update_path_spec` | `paths`; summary/note | Actual scenarioSpecMutations; preserves status |
| `update_scenario_spec` | `scenarios`; summary | Actual scenarioSpecMutations |
| `update_step_spec` | `steps`; summary | Actual stepSpecMutations |

An unknown operation is a preflight error. `set_cell_status` is deliberately
unsupported: the hosted database has no such function. Edit status alone with
`update_cell_status`, or use `update_cell_content` for a combined text edit.
A missing sanctioned operation is a ticket blocker,
not permission to write a table or change grants.

`create_scenario` cannot create a path with zero initial steps. Its RPC clamps
the requested count to at least one and names the generated columns Step 1,
Step 2 and so on. Adding named steps afterward does not replace these rows.
A placeholder can now be renamed with the guarded shared-step rename;
deleting one is still human-only. Address the placeholder by its membership,
not its name, so separate verification still finds it after the rename:

```json
{ "lookup": { "table": "path_steps", "where": { "path_id": { "lookup": { "table": "paths", "where": { "scenario_id": { "ref": "new-scenario" }, "name": "Main path" } } }, "position": 0 } }, "field": "step_id" }
```

Dry-run cannot read a row the batch has not created, so a `rename_step` or
`update_step_spec` whose target is still pending is deferred rather than
failed: its diff entry shows the declared `expected` and a `deferred` note.
Deferral is only for a row this batch creates, and preflight refuses the
whole batch otherwise:

- `expected.scenario_id` is required and must be `{ "ref": … }` to a
  `create_scenario` earlier in the batch.
- The target may be pending only through that scenario: through it directly,
  through rows created under it, or through an edit already deferred on it.
  A target reached through any other new row, such as a cell inserted on an
  existing step, could resolve to an existing row, so it is refused.
- A deferred rename must come after every `add_step` on its scenario. Its
  scenario-wide capture holds every later write to account for itself, and
  `add_step`'s membership row is a side effect the projection does not
  advance.

A new path's copied step list is the other deferral. `create_path_at_status`
copies its source path's lanes and step memberships, so a variant that needs
fewer or reordered columns follows it with a `set_path_steps` whose
`target.id` is `{ "ref": … }` to that creation and whose `expected.step_ids`
is the copied list in position order. Preflight refuses any other target, and
refuses the trim if an `add_step` on that path comes after it. At apply the
runner reads the created path, refuses unless it is that path and its
memberships equal the reviewed list, and only then sends the RPC. Guard the
source path's `path_steps` with a `beforeRows` check, so a membership change
since review fails before the path is created.

At apply the deferred re-check is a fresh capture plus the expected guard,
scenario included: the runner reads the target after its parent exists,
refuses it unless it resolves to exactly one row in the scenario this batch
created, refuses any expected field that differs (the placeholder's name, its
scenario), then runs the capability's membership and preservation capture
before writing. Any other edit to a pending row still fails preflight.
Dry-run does not simulate RPC side effects; prove the whole batch with the
database fixture test instead.

A deferred refusal at apply comes after the batch's earlier writes, so it
leaves a partial scenario. The batch stops there and is not retried. A human
removes the leftovers in the app, where each deletion is its own reviewed
action; the runner never automates deletes. Then fix the changeset and run
the whole batch again from dry-run.

### Guarded host capabilities

The optional host wrappers arrive in template v2.8.10; this deployment pins v2.8.12 and has the reviewed rename, move and insertion RPCs installed. The deployment must
separately install their reviewed RPC contracts before they are usable; a
successful pin/install or read-only dry-run does not establish hosted RPC
availability. Never probe availability by attempting an unapproved write.
The release's canvas database upgrade is a separate prerequisite before
deploying that app release. Preparation and fixture proofs authorize neither
upgrade nor content application.

A shared-step rename guards its exact prior name and its complete membership
list. Dry-run reports every affected path, its name and step position. A
membership added, removed or reordered since the reviewed changeset fails
preflight. A move requires complete expected source and destination coordinates;
position 0 is never assumed vacant. An insertion requires an exact vacant slot
and never upserts. These operations preserve identities and existing prose.

The adapter captures parent/step/lane/membership and per-path cell rows, plus
evidence, placements, resources and incident dependencies for affected cells
and the destination square. Postconditions change only the approved fields;
all other captured fields remain exact. Only an approved edited row's write
timestamp may change. Scoped row counts also catch extra placeholders.
New insertion keys must resolve to
exactly the returned identity. Subsequent approved edits/additions advance
those expectations; separate verification checks the final captured state.
Implicit structural side effects outside these contracts remain a failure,
not permission to relax preservation checks.

Each capability must produce exactly one durable row. The adapter consumes
the host RPC's receipt without another append; status-only edits use the
mutation's required record. It independently constructs the expected durable
args/inverse from the pre-state and compares them with the returned log row.
A duplicate append, missing inverse or concurrent ledger growth stops the batch
for inspection. Creation's captured delete is audit data for human recovery;
this runner has no inverse-execution path.

Statuses follow #737: Triage → proposed; Ready for Dev → planned; Code Review,
Testing, Ready for QA and Ready for Prod → built. Deployed becomes live only
with corroborating Help Center, training, production or shipped Figma evidence.
Deprecation requires production-data evidence. These are source-review duties;
the runner validates the vocabulary, not the truth of a source's claim.

## Partial failures and receipts

The JSON batch is not one database transaction. Preflight and the immediate
re-read reduce races but do not lock another author's session. Each mutation
retains the same transaction boundaries as the application. A column write can
succeed before a placement-sync or durable append fails. The command reports
that as failure, stops the batch, and does not undo or retry automatically.

Before sending a write, it saves an attempt marker in the gitignored
`.changeset-receipts/` directory. Each completed operation adds its returned
change ids and captured durable records. The file is keyed by the changeset
hash and bound to the project and authoring user. Keep it in this worktree:
verify compares the database against those exact operation/args/inverse/author
records and refuses an incomplete receipt. Stored inverses are audit data;
this runner never executes them.

If a run fails, inspect both the rows and `authoring_changes`, post what
landed and what remains unverified, and reconcile before a separately reviewed
follow-up batch. An existing receipt blocks repeating apply. Do not delete it
to get past the guard.

For a typed partial status failure, the attempt marker also retains the
session-captured operation, args and recovery inverse as audit data. It never
rehydrates a session entry or executes that JSON. A malformed host receipt may
also mean the server committed; its attempt marker and pre-state remain, and
the runner stops without retrying or claiming a verified apply.

## Tests

`node --test scripts/changesets/runner.test.mjs` runs the dependency-free
read-back contract tests. `npm test -- scripts/tests/content-changeset-database.test.mjs`
runs the real pinned mutation modules against a disposable PostgREST boundary.
The normal `npm test` gate includes both. Run the usual typecheck/lint/build
and documentation gates before opening the PR. After the final content ticket,
run the render checker over every touched scenario in stacked and merged views
and post the report on #737.

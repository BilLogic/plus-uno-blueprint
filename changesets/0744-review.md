# #744 Missing live Pre-session behaviour (rows 26, 27, 30, 32, 33)

The batch has 37 operations across the Fill-in Request and Call-off Request
scenarios: 7 `update_cell_content`, 10 `upsert_cell_at_status`, 17
`add_evidence`, 2 `create_path_at_status`, 1 `add_lane`, 1 `set_path_steps`
and 1 `update_path_spec`. Every expected value was read from production on
November 1, 2026, as the dev authoring user (reads only).

## Short ids

Each short id resolved to exactly one live row whose text matched the ticket's
quote.

| Ticket id | Row |
|---|---|
| `…00150304` | `a0000000-…-000000150304`, Slot gets covered › Tutor takes the slot › FSA |
| `…170203` | `a0000000-…-000000170203`, 12+ hours ahead › Files call-off › RT |
| `…170207` | `a0000000-…-000000170207`, 12+ hours ahead › Files call-off › BSA |
| `…170208` | `b0000000-…-000000170208`, 12+ hours ahead › Files call-off › BST (the only row with that suffix) |
| `…170603` | `a0000000-…-000000170603`, 12+ hours ahead › Final notification › RT |
| `…180603` | `b0000000-…-000000180603`, Under 12 hours › Final notification › RT |
| `f…0808` | `f0000000-…-000000000808`, the Swap offered instead path |

## Fill-in Request

- **Row 26.** The FSA cell on Tutor takes the slot gains "…and emails the tutor
  a confirmation". The summary is unchanged.
- **Row 27.** A new variant path, **Requested mid-session**, is created from
  Slot gets covered. It shares that path's four steps:
  - Session enters fill-in pool: LT requests tutors, FST `PLUS App` and
    `Slack`, FSA posts to #sessions-in-need and opens fill-in spots.
  - Tutor takes the slot: RT opens the Slack link, confirms and joins.
  - Roster updated, tutor joins: LT assigns students to the fill-in tutor.

  *Tutor browses Fill-In tab* stays empty on this path, because the tutor
  arrives from Slack. No new steps are added.
- **Lead Tutor lane.** The scenario had no Lead Tutor lane, and `add_lane`
  adds a lane to every path of a scenario. So Slot gets covered also gains an
  empty Lead Tutor lane at position 1, after Storyboard (the Help Request
  ordering). Its other lanes shift down by one.
- **Wording change from the ticket.** The ticket's LT cell says "from the
  Students page". The lead-tutor Help Center page puts the control at
  "… (next to Manage session) › Request tutors". The cell says "from … ›
  Request tutors" and doesn't name a page.

## Call-off Request

- **Row 30.** A new FSA cell on 12+ hours ahead › Files call-off (12h+) and
  one on Under 12 hours › Files late call-off carry the call-off received
  email. Both slots were vacant.
- **Row 32.** A new variant path, **Recurring withdrawal**, is created from
  12+ hours ahead. Its copied step list is trimmed and reordered to Initial
  need → Files call-off → Supervisor review → Coverage via fill-in pool →
  Final notification:
  - The late call-off step (<12h) is dropped from this path.
  - Coverage moves after review, because a recurring withdrawal keeps the
    tutor on the roster until it is approved.

  It has three cells: RT at Files call-off, and RT and BSA at Supervisor
  review. The auto-approve rule is in the BSA cell. The recurring facts are
  then removed from the summaries of `…170203`, `…170207` (now empty),
  `…170208`, `…170603` and `…180603`. The one-time facts stay.
- **Row 33.** The Swap offered instead path gets the note "Swap-in card 2204
  archived Aug 2026; spec 5.5 still TBD." Its status stays `proposed`.

## Runner change: a new path's copied step list

`create_path_at_status` copies the source path's step memberships. Before this
batch, the runner had no way to trim them: dry-run can't read a path the batch
hasn't created yet. This batch adds a second deferral, built the same way as
the #759 placeholder-rename deferral:

- Deferral applies to a `set_path_steps` only when its `target.id` is the
  `ref` of a `create_path_at_status` earlier in the batch. An `add_step` on
  that path must not come after it. Preflight refuses anything else.
- At apply, the runner reads the created path. It refuses to write unless the
  row is that path and its memberships equal the reviewed `expected.step_ids`.
- A `beforeRows` check on 12+ hours ahead's `path_steps` makes a membership
  change since review fail before the path is created.

Tests come first. `scripts/changesets/runner.test.mjs` has three new cases:
the trim path, a copied-list mismatch at apply, and both preflight refusals.
`scripts/tests/content-changeset-database.test.mjs` adds a fixture for
`create_path_at_status` and `set_path_steps` and runs a create-and-trim
through the real mutation modules. That run covers dry-run, apply and separate
verify, with the full prior list as the inverse.

## Sources (re-read November 1, 2026, PLUS Notion)

| Card or page | Status | Supports |
|---|---|---|
| Card 2136, In-session Fill-In Request | Deployed, 12.0 (live) | Row 27 |
| Card 2616 (`3cfb`), Add Tutor without automatic reassignment | Deployed | Row 27, "nobody else's students move" |
| Card 2566 (TE1, `3b2b…8118`), session assignment emails | Deployed, 12.0 | Row 26 (fill-in confirmation) |
| Card 2567 (TE2a, `3b2b…81d1`), call-off submitted email | Deployed, 12.0 | Row 30; the auto-approve rule for row 32 |
| Card 2204, Call-off for Swap-in | Archived | Row 33 |
| Help Center, When There Are Not Enough Tutors (`32cb…db9c`) | — | Request tutors, count, closing time, reasons, #sessions-in-need, assignment |
| Help Center, Manage Your Tutoring Schedule (`392b`) | — | The Slack-link response; both confirmation emails |

Module 8 (Day-to-Day Protocols) is cited by the ticket, but it says nothing
about mid-session fill-ins. It is not cited on any cell. Figma 11272:161737
and 11227:394462 are cited as the ticket gives them; they were not re-read for
this batch.

## Left for the owner

- **Deletes.** None are needed for this batch. These are optional:
  - Remove the empty Lead Tutor lane from Slot gets covered if it isn't
    wanted there.
  - Delete the late-call-off step's deprecated cells on 12+ hours ahead.
    This was already pending from #752.
- **Not checked live.** `add_lane` and `set_path_steps` are sanctioned app
  RPCs, but this runner has not called either on the hosted database before.
  Their success is established only by this apply.

## Applied (November 1, 2026)

- `0744-pre-session-live-behaviour.json` (sha256 `a85c3be8…8b59`). All 37
  operations applied, each with its durable inverse, and `add_lane` and
  `set_path_steps` worked on the hosted database. Verify left one failure:
  the new FST cell (`r27-touchpoints`) had no PLUS App or Slack placements.
  `upsert_cell_at_status` doesn't sync placements; only the content mutation
  does, and this cell was created without a summary, so that mutation never
  ran.
- `0744-b-touchpoint-placements.json` (sha256 `92422bc6…da44`) is the
  follow-up. It adds a summary to that cell through the sanctioned content
  mutation, which places both touchpoints, and adds one evidence row.
  Dry-run, apply and verify all passed.
- Re-running the first batch's verify now passes every check but one: its
  evidence count on `r27-touchpoints` expects 1 and finds 2. That second row
  is the follow-up's own evidence row.
- Lesson: a new touchpoint-lane cell needs a summary in its creation
  operation, or its placements are never synced.

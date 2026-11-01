# Review record for #745

Prepared November 1, 2026. The scope is
[issue #745](https://github.com/BilLogic/plus-uno-blueprint/issues/745): shipped
In-session behaviour that the blueprint was missing, outside Goal Setting.
Goal Setting is untouched.

## What the batch does

Twenty-four operations: seven content edits, five cell insertions and one
evidence row for each of the twelve changed or new cells. Every cell stays or
lands `live`. Summaries, owners, frames and positions of existing cells are
unchanged. Nothing is deleted.

| Row | Cell | Change |
|---|---|---|
| 34 | Before Students Join › Setup goes to plan › Share Zoom link › Lead Tutor (`…00180302`) | Claim host, co-host, tutor attendance |
| 35 | Same step › Teacher, new at position 1 | Teacher joins and asks for co-host |
| 36 | › Prepare breakout rooms › Lead Tutor (`…00180402`) | Assignment tool, then the Rooms count |
| 37 | › Set up classroom › Front Stage Actions, new | Manage session, the … menu and Tutor tools |
| 38 | › Distribute breakout list › Front Stage Actions, new | Add Tutor moves no students |
| 39 | Student Just Joined › Full room, on time › Students join › Front Stage Actions, new | Header counts |
| 40 | › Raise hand for help › Regular Tutor (`…00190303`) | Late marking after 10 minutes |
| 43 | Warm-Up › Student shares screen › Enter Breakout Room › Regular Tutor (`…00040103`) | 5-minute check-in, recording |
| 44 | Warm-Up › Select Engagement level › Regular Tutor (`…00040603`, `…00060603`) | Engagement sub-reasons |
| 54 | Help Request › Routed out › Resolve issue › Regular Tutor, new at position 1 | Request lead tutor |
| 55 | Help Request › Routed out › Resolve issue › Support Actions (`b3…036`) | #plus-app-bug-reporting triage |

Each short id resolved to exactly one live row whose full current content
matched the ticket's quote. The expected values in the changeset are the full
authenticated read of November 1, 2026.

## Sources

All four roadmap cards are `Deployed` with Release Version `12.0 (live)`:
328b Session Controls Consolidation (RM-2357), 333b Session Counts on Headers
(RM-2371), 2c5b In-session Fill-In Request (RM-2136) and 3cfb Add Tutor
without reassignment (RM-2616). Each `live` status is corroborated by
training material (Modules 4, 6, 7 and 11) or the Tutor and Teacher Help
Centers. Each evidence row's note names its sources and links.

## Judgement calls

- **Row 37** adds *view session info* to the lead's … menu. Modules 6 and 7
  list it there; the ticket's text left it out.
- **Row 38** cites card 3cfb, Help Center 383b and Module 11. The ticket's
  second Help Center id, 392b, matches two pages (schedule management and
  session reflections), neither about Add Tutor, so it is not cited. The
  wording agrees with the #750 summaries on the Live rebalancing and
  Distribute breakout list cells and restores no unrestricted late-join
  reassignment claim.
- **Row 35** cites Teacher Help Center dd0b ("How do I join as a co-host?")
  and 379b…8022 ("What to do once I'm a co-host?"). The prefix 379b matches
  several Teacher articles; that one is the co-host article.
- **Row 54** names no path or step in the ticket. It sits on Routed out ›
  Resolve issue, beside "Routes the issue out of the room", the Slack
  touchpoint and the back-stage cell where supervisors monitor
  #in-session-support. Move it if another step reads better.

## Left for the owner

- No deletes are wanted.
- The summary of `b3…033` (Routed out › Resolve issue › Regular Tutor) still
  routes classroom-side issues to "the school Slack channel". Help Center
  3a2b says school channels are retired. It is outside this ticket's rows
  and was not changed.
- The summary of `…00180402` says the lead starts the recording. Module 11
  has the lead remind tutors to record, and each tutor starts it in their
  first room. The content edit here does not touch that summary.

## Partial apply and recovery

The first apply of `0745-in-session-live-behaviour.json` (SHA-256
`2f6ddc93…62179`) wrote row 34's edit and its evidence, then stopped before
row 35's insertion wrote anything. The insertion's preservation check had
advanced row 34's cell with the old `search_tsv`, a column the database
regenerates on every write. The runner now leaves `search_tsv` out of
projected rows, as it already did `updated_at`. A unit test covers the edit
followed by the check. All approved fields are still compared exactly.

`0745-recovery.json` carries the remaining 22 operations unchanged, with
expected values re-read after the partial apply. The first file's receipt
stays in this worktree as the record of the two operations that landed.

## Validation

- Dry-run: `ok: true`, 24 operations, no expected-current mismatch, no writes.
- Pre-apply verify: failed as expected on the seven old contents, the five
  absent cells and the twelve absent evidence rows.

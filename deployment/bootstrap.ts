/**
 * The one thing this deployment has to settle BEFORE the application's modules
 * evaluate — its own module, so that it does.
 *
 * `main.tsx` names this file on the line above the application's import. ES
 * modules evaluate depth-first in source order, so naming it there is what
 * guarantees it has run. Nothing below relies on that being remembered: the
 * seam freezes on first read and throws on a late call, so getting the order
 * wrong raises an error that names the fix rather than running quietly on the
 * template's default.
 *
 * It imports from `agentic-service-blueprinting/bootstrap` and NOT from the
 * package root. The root export reaches `App`, and evaluating `App` is the
 * exact thing this call has to precede; the bootstrap entry's import graph is
 * held empty of the application for that reason.
 *
 * THIS FILE USED TO CARRY A SECOND CALL, and the release that removed it is
 * the reason the file is now one line long. The agent's reference documents
 * were registered here, through a `registerReferenceDocs` seam, because the
 * template assembled the reference record, the vocabulary naming it and the
 * `get_reference` description quoting that vocabulary all at module scope — so
 * a document handed over at render time would have been served by a tool that
 * never mentioned it. The template now reads its references when a document is
 * SERVED rather than when its modules evaluate, which removes the ordering
 * rule entirely, and the seam with it. Both documents are ordinary
 * configuration now, on `agent.references` in `deployment.ts`.
 */
import { configureStorageNamespace } from 'agentic-service-blueprinting/bootstrap'

/**
 * FIRST, AND BEFORE ANYTHING READS STORAGE.
 *
 * Six of the application's modules build their localStorage key while the
 * import graph evaluates, and two of them read storage there to seed a store
 * snapshot. The package's own default prefix is `sb-`; every key already
 * sitting in a reader's browser was written under `uno-`. A call that arrives
 * one lifecycle too late does not raise here — it is `storageKey` freezing the
 * prefix on first read that raises — but a call that never arrives at all is
 * silent: every reader's saved state resets under a new prefix, nothing errors,
 * and the old keys stay on disk unread.
 *
 * The prefix is frozen in the longer sense too. It is not a name to tidy: the
 * keys are in browsers this deployment does not control, and changing it
 * abandons them.
 */
configureStorageNamespace('uno-')

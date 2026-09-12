/**
 * Everything this deployment has to settle BEFORE the application's modules
 * evaluate — its own module, so that it does.
 *
 * `main.tsx` names this file on the line above the application's import. ES
 * modules evaluate depth-first in source order, so naming it there is what
 * guarantees it has run. Nothing below relies on that being remembered: both
 * seams freeze on first read and throw on a late call, so getting the order
 * wrong raises an error that names the fix rather than running quietly on the
 * template's defaults.
 *
 * It imports from `agentic-service-blueprinting/bootstrap` and NOT from the
 * package root. The root export reaches `App`, and evaluating `App` is the
 * exact thing these two calls have to precede; the bootstrap entry's import
 * graph is held empty of the application for that reason.
 */
import {
  configureStorageNamespace,
  registerReferenceDocs,
} from 'agentic-service-blueprinting/bootstrap'
import blueprintAccount from '../docs/agents/blueprint.md?raw'
import canvasAdapter from './agent/canvas-adapter.md?raw'

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

/**
 * This deployment's reference documents, registered before the vocabulary that
 * names them is built.
 *
 * The record the agent serves, the vocabulary that names it, and the
 * `get_reference` tool description that quotes that vocabulary to the model are
 * all assembled at module scope. A document handed over at render time would be
 * served by a tool that never mentions it, which is why this is a call and not
 * a `DeploymentConfig` field.
 */
registerReferenceDocs({
  // The generated account of this deployment's schema, served to the agent as
  // the `blueprint` reference. `npm run agent-account` renders it from the
  // connected database; `check:agent-account` holds it to its sources.
  blueprint: blueprintAccount,
  // This deployment's canvas adapter REPLACES the template's: the template's
  // copy names a tool registry this app does not have. A key the template
  // already serves is replaced and adds no name, so the vocabulary is unchanged.
  'canvas-adapter': canvasAdapter,
})

/**
 * This deployment's configuration — the whole of what it says about itself.
 *
 * The values are this deployment's; the mechanisms are the template's. Nothing
 * here is a call: every field is read while `App` RENDERS, and the two values
 * that are settled earlier than that — the storage prefix and the agent's
 * reference documents — are in `bootstrap.ts` for exactly that reason.
 *
 * `brand` names the product and the colour it is branded on. `cover` is the
 * landing page, whole: replaced, never merged, because a merged cover is a
 * cover half of which describes a service the reader is not looking at.
 * `sample.nav` and `sample.blueprints` are the two halves of the board
 * shown before a database answers. `cellBudget` is
 * read by the length guidance a person sees under the Content field and the
 * agent receives in its tool result, so both name the same thresholds.
 * `pathColorPins` hand-picks slots for the paths this board draws side by side,
 * where the hash would put two of them too close to follow — colour and dash
 * are read from the one slot, so the pair cannot drift. `agent.references` is
 * the two documents this deployment serves its own agent, which used to be a
 * pre-import call in `bootstrap.ts` and are ordinary configuration now.
 */
import type { DeploymentConfig } from 'agentic-service-blueprinting'
import blueprintAccount from '../docs/agents/blueprint.md?raw'
import canvasAdapter from '~/agent/canvas-adapter.md?raw'
import { coverContent } from './content/coverContent'
import { SAMPLE_NAV } from './data/sampleNav'

export const unoDeploymentConfig: DeploymentConfig = {
  brand: {
    /**
     * The wordmark. It reaches app chrome through
     * `content.workspaceTitle ?? cover.title ?? brand.name ?? ORG_NAME`, and
     * `ORG_NAME` is the template's own name now that this deployment reads the
     * application out of the package — so naming this is what keeps the
     * template's name off this deployment's chrome.
     */
    name: 'PLUS',
    /**
     * PLUS's blue-green. Its OKLCH hue is 177.6, which is the hue
     * `styles/brand.css` draws the whole ramp at — so reading this accent
     * repaints nothing, and the two agreeing is the point rather than a
     * coincidence. `DeploymentConfigProvider` writes it onto the root's `--hue`
     * in a layout effect; the stylesheet declares the same value at parse time,
     * so the first frame is already correct and the effect is idempotent.
     *
     * The accent alone carries only the hue. The chroma and lightness dials
     * that make this deployment teal rather than a grey at a teal hue are in
     * `styles/brand.css`, which is why the two belong together.
     */
    accent: '#85ECD5',
  },
  cover: coverContent,
  /**
   * Both halves of the offline board, because the kit replaces each rather
   * than merging it: the nav alone would draw this deployment's rows over the
   * template's content registry, which is keyed by the template's scenario ids
   * and answers none of ours. `SAMPLE_BLUEPRINTS` is an EXPORT of this
   * deployment's live board, taken through the public read surface — the anon
   * key the site itself ships — by `npm run export:sample-board`, because the
   * kit's own generator takes an IR and this deployment has never had one. Its
   * header carries the command; the script's header carries the why.
   *
   * THE REGISTRY ARRIVES BEHIND A LOADER RATHER THAN AS A VALUE, and the two
   * forms draw the same board. What differs is which builds carry it. The
   * registry is read on one condition — the bundled sample being active, which
   * is false the moment a database is configured — and named as a value it was
   * reachable from this module, so every build carried an export of the live
   * board that the deployed site, which has a database, never asks for. Inside
   * a dynamic import the only reference to those bytes is behind a chunk
   * boundary. `DeploymentConfigProvider` calls the loader only when the
   * bundled sample is reachable and awaits it before rendering below itself,
   * because the board reads the registry while it draws: one chunk fetch
   * before first paint in a no-database build, and no call at all in the
   * deployed one.
   */
  sample: {
    nav: SAMPLE_NAV,
    blueprints: () => import('./data/sampleBlueprints').then((m) => m.SAMPLE_BLUEPRINTS),
  },
  cellBudget: {
    prose: { target: 80, warning: 100 },
    touchpointLabels: { target: 32, warning: 48 },
  },
  pathColorPins: {
    'Set Goals': 0,
    'Update Goals': 1,
    'Check Goals': 2,
    'Set Goals Edge Case': 3,
    'Update Goals Edge Case': 4,
  },
  agent: {
    /**
     * The documents this deployment serves its own agent, laid over the
     * template's per name when one is served.
     *
     * `blueprint` is a name the template does not serve, so it is an
     * ADDITIONAL reference, listed to the model right after the canvas
     * adapter: the generated account of this database's own schema.
     * `npm run agent-account` renders it from the connected database and
     * `check:agent-account` holds it to its sources.
     *
     * `canvas-adapter` is a name the template DOES serve, so this replaces
     * that document and adds no name. The template's adapter is spliced into
     * every system prompt; the reason this deployment replaces it is in the
     * override's own header, and the two surface rows inside it are rendered
     * from the session's roster rather than written out here.
     *
     * Both were registered from `bootstrap.ts` before the application's
     * modules evaluated, because the template built its reference vocabulary
     * at module scope. It reads them when a document is served now, so the
     * ordering rule is gone and these are configuration like everything else
     * in this file. The `?raw` imports are the host's to hold, which is why
     * they sit at the top of this module.
     */
    references: {
      blueprint: blueprintAccount,
      'canvas-adapter': canvasAdapter,
    },
    // This database carries `search_blueprint`, so the tool is real here. The
    // index it holds is named exactly as the database records it: a question
    // embedded with any other model, or any other size, is refused rather than
    // ranked as noise.
    //
    // ONE ENTRY, AND THAT IS A STATEMENT ABOUT THE DATABASE. Only a person
    // holding a Google key has their question embedded and is offered the
    // tool. A person on any other provider is not offered it — quietly, not
    // handed the keyword arms as a consolation — because a list that names
    // some providers and not others is `agentSearchPlan`'s `offered: false`.
    // An empty list would be the different case, where nobody is singled out
    // and keyword search is what ranked search means.
    //
    // The schema can hold a second model's set beside this one, so an OpenAI
    // entry here is legal. It is absent because no such set has been built,
    // and listing an index with no vectors behind it makes every meaning
    // search from that provider raise. The order to turn one on, and why it is
    // that order, is in docs/engineering/access-and-security.md.
    search: {
      enabled: true,
      indexes: [{ provider: 'google', model: 'gemini-embedding-001', dimensions: 768 }],
    },
  },
}

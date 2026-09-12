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
 * `sample.nav` is the board shown before a database answers. `cellBudget` is
 * read by the length guidance a person sees under the Content field and the
 * agent receives in its tool result, so both name the same thresholds.
 * `pathColorPins` hand-picks slots for the paths this board draws side by side,
 * where the hash would put two of them too close to follow — colour and dash
 * are read from the one slot, so the pair cannot drift.
 */
import type { DeploymentConfig } from 'agentic-service-blueprinting'
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
  sample: { nav: SAMPLE_NAV },
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

/**
 * This deployment's configuration, and the one registration it has to make
 * before the app is imported.
 *
 * `main.tsx` imports this module first. Import order is evaluation order, and
 * the agent's tool description quotes the reference vocabulary while it
 * evaluates, so a reference document registered any later would be refused.
 *
 * The values are this deployment's; the mechanisms are the template's.
 * `cellBudget` is read by the length guidance a person sees under the Content
 * field and the agent receives in its tool result, so both name the same
 * thresholds. `pathColorPins` hand-picks slots for the paths this board draws
 * side by side, where the hash would put two of them too close to follow —
 * colour and dash are read from the one slot, so the pair cannot drift.
 */
import blueprintAccount from '../docs/agents/blueprint.md?raw'
import canvasAdapter from '@/lib/agent/canvas-adapter.md?raw'
import { registerReferenceDocs } from '@/lib/agent/tools/referenceRegistry'
import type { DeploymentConfig } from '@/deploymentConfig'

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

export const unoDeploymentConfig: DeploymentConfig = {
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

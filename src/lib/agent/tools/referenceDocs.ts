// The instance override, not the package's copy — see REFERENCE_DOCS below
// and `src/lib/agent/canvas-adapter.md`'s own header (#115).
import canvasAdapter from '@/lib/agent/canvas-adapter.md?raw'
// The blueprint's own account of itself (#260): one file, read here, by the
// bot and by IDE sessions. Its schema section is rendered from the catalog.
import blueprintAccount from '../../../../docs/agents/blueprint.md?raw'
import dataModel from 'agentic-service-blueprinting/references/data-model.md?raw'
import elicitationProtocol from 'agentic-service-blueprinting/skills/map/references/elicitation-protocol.md?raw'
import cocreatePlaybook from 'agentic-service-blueprinting/skills/map/references/cocreate-playbook.md?raw'
import laneVocabulary from 'agentic-service-blueprinting/references/lane-vocabulary.md?raw'
import laneRoles from 'agentic-service-blueprinting/references/lane-roles.md?raw'
import auditPlaybook from 'agentic-service-blueprinting/references/audit-playbook.md?raw'
import whatifPlaybook from 'agentic-service-blueprinting/skills/whatif/references/whatif-playbook.md?raw'
import checkGapSweep from 'agentic-service-blueprinting/skills/audit/references/check-gap-sweep.md?raw'
import checkJargonLint from 'agentic-service-blueprinting/skills/audit/references/check-jargon-lint.md?raw'
import checkChannelConflict from 'agentic-service-blueprinting/skills/audit/references/check-channel-conflict.md?raw'
import checkKpiAlignment from 'agentic-service-blueprinting/skills/audit/references/check-kpi-alignment.md?raw'
import checkPerceivedOwner from 'agentic-service-blueprinting/skills/audit/references/check-perceived-owner.md?raw'
import checkValueLedger from 'agentic-service-blueprinting/skills/audit/references/check-value-ledger.md?raw'
import checkFeeVisibility from 'agentic-service-blueprinting/skills/audit/references/check-fee-visibility.md?raw'
import checkObsoleteSource from 'agentic-service-blueprinting/skills/audit/references/check-obsolete-source.md?raw'
import slicePlaybook from 'agentic-service-blueprinting/skills/slice/references/slice-playbook.md?raw'
import sliceTemplates from 'agentic-service-blueprinting/skills/slice/references/slice-templates.md?raw'

/**
 * WHERE the rulebook's documents come from — a DECLARED FORK SEAM
 * (#325 S2, #396 Q19), and one of exactly two places where convergence with
 * the template stops on purpose.
 *
 * `read.ts` serves these under bare names and is byte-shared with the
 * template. It cannot be, while it also names the paths: this deployment
 * INSTALLS the rulebook (`agentic-service-blueprinting`, pinned by the
 * lockfile) and the template VENDORS it (`@/lib/agent/skill/references/…`),
 * and the two specifier families can never be the same string. So the
 * specifiers live here, alone, and every module above this one imports a
 * record with the same shape from the same path in both repositories.
 *
 * Editing a file in the plugin repo and bumping the pin upgrades both; there
 * is nothing here that can be edited instead. TWO EXCEPTIONS, both deliberate
 * and both deployment-only:
 *
 *   `canvas-adapter` is served from `src/lib/agent/canvas-adapter.md` in this
 *   repo, because the package's copy names the package's registry — twelve
 *   tools this app does not have, thirty-three of ours missing — and calls
 *   those rows "the FULL surface" (#115). A rulebook that enumerates tool
 *   names cannot be shared by two installations with different tools.
 *   `scripts/check-write-surface.mjs` reads THIS file and fails if the key
 *   ever points back at the package.
 *
 *   `blueprint` is this deployment's account of itself (#260) and has no
 *   template counterpart — a template describes no particular service. It is
 *   the entry `referenceNamesExtra.ts` publishes, which is why the shared
 *   name list can stay shared.
 *
 * Adding a reference means three edits: the import and the row here, the
 * name in `referenceNames.ts` (or `referenceNamesExtra.ts` if it is
 * deployment-only), and — upstream — the path in the template's
 * `scripts/check-reference-paths.mjs`. `read.ts` throws at module init if the
 * first two disagree.
 */
export const REFERENCE_DOCS: Record<string, string> = {
  'canvas-adapter': canvasAdapter,
  blueprint: blueprintAccount,
  'lane-roles': laneRoles,
  'lane-vocabulary': laneVocabulary,
  'elicitation-protocol': elicitationProtocol,
  'cocreate-playbook': cocreatePlaybook,
  'data-model': dataModel,
  'audit-playbook': auditPlaybook,
  'whatif-playbook': whatifPlaybook,
  'check-gap-sweep': checkGapSweep,
  'check-jargon-lint': checkJargonLint,
  'check-channel-conflict': checkChannelConflict,
  'check-kpi-alignment': checkKpiAlignment,
  'check-perceived-owner': checkPerceivedOwner,
  'check-value-ledger': checkValueLedger,
  'check-fee-visibility': checkFeeVisibility,
  'check-obsolete-source': checkObsoleteSource,
  'slice-playbook': slicePlaybook,
  'slice-templates': sliceTemplates,
}

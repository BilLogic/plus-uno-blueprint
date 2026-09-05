#!/usr/bin/env node
/**
 * The reconciled set: shared files this deployment has DECLARED byte-identical
 * to the template it is imported from — agentic-service-blueprinting, the
 * dependency pinned in package.json and the lockfile.
 *
 * `scripts/check-reconciled-files.mjs` reads this list and fails CI if any
 * path on it has drifted from asb's copy. It is the failing counterpart to
 * `scripts/measure-template-divergence.mjs`, which only REPORTS divergence
 * over the whole tree and fails on nothing.
 *
 * This is a data file on purpose, and it starts EMPTY. Reconciliation happens
 * one file at a time, each under its own ticket, and enrolling a file is a
 * one-line append here — no edit to the checker, no edit to the workflow:
 *
 *     'src/lib/blueprintContract.ts',
 *
 * A path names the SAME repo-relative location in both repos; the checker
 * reads asb's copy from `node_modules/agentic-service-blueprinting/<path>`.
 * Only enrol a path once its ticket has actually made the two copies
 * identical — a path added ahead of that reddens every branch until it is
 * true.
 */
export const RECONCILED_FILES = [
  // The arrow-routing engine (#351): the same data-driven geometry in both
  // repos — anchor slots, confluence/fan-out, gap-first corridors, offset.
  // The renderers stay per-repo (uno's dependency vocab, asb's trigger vocab);
  // only these two pure files are held byte-identical.
  'src/lib/blueprintArrowGeometry.ts',
  'src/lib/arrowAnchorSlots.ts',

  // The panel writers (#357): asb ported uno's entity panel editors wholesale,
  // so the code a panel saves through is one implementation living in two
  // repos. One module per entity, plus the text normaliser and the busy latch
  // every panel shares. The RPCs and the ledger stay per-repo; these do not.
  'src/lib/serviceSpecMutations.ts',
  'src/lib/scenarioSpecMutations.ts',
  'src/lib/phaseSpecMutations.ts',
  'src/lib/laneSpecMutations.ts',
  'src/lib/stepSpecMutations.ts',
  'src/lib/entityStatus.ts',
  'src/lib/panelText.ts',
  'src/lib/panelEditorBusy.ts',

  // The panel surface (#357): the drawer shell every panel is drawn in, the
  // fields it is drawn from, and the badges that carry a definition. Chrome
  // only — the panel bodies that compose these stay per-repo, because they
  // name uno's entities.
  'src/components/blueprint/panelShell.tsx',
  'src/components/blueprint/panelLoading.tsx',
  'src/components/blueprint/StepPanel.tsx',
  'src/components/blueprint/PanelSectionLabel.tsx',
  'src/components/blueprint/PanelTextareaField.tsx',
  'src/components/blueprint/OptionSelect.tsx',
  'src/components/blueprint/StatusSelect.tsx',
  'src/components/blueprint/StatusBadge.tsx',
  'src/components/blueprint/StakeholderBadge.tsx',
  'src/components/ui/select.tsx',

  // Every label is a door (#357): the affordances that open a panel from the
  // name the reader is already looking at, and the headers that host them.
  'src/components/blueprint/EntityHeader.tsx',
  'src/components/blueprint/EntityTitleAffordance.tsx',
  'src/components/blueprint/EntityPropertiesButton.tsx',
  'src/components/blueprint/LaneHeaderAffordance.tsx',
  'src/components/blueprint/StepHeaderAffordance.tsx',
  'src/components/editor/ServiceOverviewHeader.tsx',

  // Panel state and geometry (#357): which panel is open, where the sheet
  // snaps to, and the measurements the drawer takes off the shell around it.
  'src/lib/openPanelStore.ts',
  'src/lib/panelSheetSnap.ts',
  'src/hooks/useCanvasTopOffset.ts',
  'src/hooks/usePanelFooterHost.ts',
  'src/contexts/scenarioBoardScopeContext.ts',
  'src/contexts/shellBootStore.ts',

  // The contracts over the above (#357). A shared implementation whose test
  // drifts is a shared implementation nobody is holding to the same promise,
  // so the tests are reconciled alongside the files they pin.
  'src/components/blueprint/laneStepHeaderAffordance.test.tsx',
  'src/components/blueprint/panelDrawerShell.test.tsx',
  'src/lib/panelSheetSnapContract.test.ts',
]

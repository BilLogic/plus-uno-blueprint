#!/usr/bin/env node
/**
 * The reconciled-set drift gate's contract (#319): an empty allowlist passes,
 * an enrolled file byte-identical to asb passes, an enrolled file that differs
 * fails.
 *
 * `auditReconciled` is exercised against in-memory readers rather than a real
 * asb checkout, so the outcomes are pinned to byte-equality alone and not to
 * whatever the pinned package happens to ship. Two tests do read the shipped
 * list: one asserts the enrolled set — first populated by #351, the shared
 * arrow-routing engine, and grown by every reconciliation ticket and pin bump
 * since — and one asserts that no path on it is enrolled twice (#407).
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { auditReconciled } from '../check-reconciled-files.mjs'
import { RECONCILED_FILES } from '../reconciled-files.mjs'

const bytes = (text) => Buffer.from(text, 'utf8')
const refuse = () => {
  throw new Error('an empty allowlist must not read any file')
}

test('an empty allowlist has nothing to fail on, and reads nothing', () => {
  assert.deepEqual(auditReconciled({ files: [], readInstance: refuse, readAsb: refuse }), [])
})

test('the shipped allowlist holds the arrow engine (#351), the panel editors (#357), the viewport/layout convergence (#323 slices S0–S5), the asb 1.5.0 adopt, the display flags (#326 S1), the asb 1.5.1 adopt (#324 S1+S2), the cell-detail context (#324 S1), the touchpoint-cell face (#325 S6), the #391 phase-B storyboard rename, the #403 identical-by-history sweep, the cell-selection builders (#405), the blueprint resolver (#326 S4), and the entity-detail provider (#324, #396 Q31)', () => {
  // #319 shipped the gate EMPTY; #351 enrolled the first files — the shared
  // arrow-routing geometry — #357 enrolled the entity panel editors asb
  // ported back out of uno, and #323's slice S0 swept every remaining
  // byte-identical path under src/ (viewport/layout/compare, mobile shell,
  // agent providers, shadcn primitives, and the rest). Every pin bump since
  // has ended the same way: adopt what the template moved ahead on, then sweep
  // whatever that left byte-identical. A stray add or removal trips here, so
  // enrolment stays a deliberate act in a reconciliation ticket.
  //
  // #403 is the first entry that also declines. Eleven paths were identical at
  // the 1.6.4 pin without ever having been enrolled — identical by history
  // rather than by decision — and six of them were judged worth holding. The
  // other five are named, with their reasons, at the foot of
  // `scripts/reconciled-files.mjs`; this list is the record that they were
  // considered and left off on purpose, not overlooked.
  //
  // #405 is the newest entry and the end of a two-ticket sequence: #401 fixed
  // the name-only predicate and stopped deliberately at the boundary, and
  // #405 moved the selection path from `cells.links` onto placements, which
  // is what finally made `blueprintCellSelection.ts` the template's file.

  // #324 is the newest entry, and it is the first won by MOVING a component
  // rather than by editing one. `EntityDetailContext.tsx` differed from the
  // template in a single function: the hook returned an inert value outside
  // its provider, because the provider was mounted on one tab body and every
  // affordance elsewhere in the shell had to survive not reaching it. #396's
  // Q31 hoists the provider to `EditorShell`, above both trees, so nothing is
  // outside it any more and the hook can throw the way the template's does.
  // The file was not so much reconciled as made true.
  //
  // #326 S4 was the entry before it, and it is the first enrolment won by
  // DELETING deployment code rather than by adopting the template's. `resolveBlueprint`
  // carried two read-time repairs for this deployment's own rows, gated on
  // hardcoded PLUS UUIDs, and they were the reason the file could never be
  // byte-identical to anything. Both faults had already been corrected at
  // source, so the repairs were removed rather than generalised, and what was
  // left of the two copies differed only in the fallback merge model and in
  // one key name.
  //
  // #407 asked whether a whole-array `deepEqual` is still the right ratchet
  // now that the list is 211 long and every reconciliation ticket touches it,
  // or whether set-equality plus a separate ordering rule would hold the same
  // ground for a smaller diff each time. It is KEPT, on three grounds.
  //
  // The diff is already small. The list grows by appending a block to the end
  // of `scripts/reconciled-files.mjs` and the same paths to the end of this
  // literal, so an ordinary ticket touches the tail of two files and nothing
  // between them. A large diff here means an entry moved or was inserted
  // mid-list — which is exactly the change that ought to be loud.
  //
  // The order is not incidental. The source file is grouped by ticket in the
  // order the tickets landed, so the sequence IS the reconciliation history,
  // and the blocks' prose reads against it. An "ordering rule" strong enough
  // to hold that would have to know which ticket each path belongs to and when
  // it merged, which is a fact no assertion in this file can reach.
  //
  // And set-equality would have made #407's own bug permanent instead of
  // catching it. Comparing sets discards cardinality, so it passes on a list
  // that enrols the same path twice — the precise defect being fixed. The
  // duplicate check below is what closes that hole, and it closes it BESIDE
  // `deepEqual` rather than in place of it.
  assert.deepEqual(RECONCILED_FILES, [
    'src/lib/blueprintArrowGeometry.ts',
    'src/lib/arrowAnchorSlots.ts',
    'src/lib/serviceSpecMutations.ts',
    'src/lib/scenarioSpecMutations.ts',
    'src/lib/phaseSpecMutations.ts',
    'src/lib/laneSpecMutations.ts',
    'src/lib/stepSpecMutations.ts',
    'src/lib/entityStatus.ts',
    'src/lib/panelText.ts',
    'src/lib/panelEditorBusy.ts',
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
    'src/components/blueprint/EntityHeader.tsx',
    'src/components/blueprint/EntityTitleAffordance.tsx',
    'src/components/blueprint/EntityPropertiesButton.tsx',
    'src/components/blueprint/LaneHeaderAffordance.tsx',
    'src/components/blueprint/StepHeaderAffordance.tsx',
    'src/components/editor/ServiceOverviewHeader.tsx',
    'src/lib/openPanelStore.ts',
    'src/lib/panelSheetSnap.ts',
    'src/hooks/useCanvasTopOffset.ts',
    'src/hooks/usePanelFooterHost.ts',
    'src/contexts/scenarioBoardScopeContext.ts',
    'src/contexts/shellBootStore.ts',
    'src/components/blueprint/laneStepHeaderAffordance.test.tsx',
    'src/components/blueprint/panelDrawerShell.test.tsx',
    'src/lib/panelSheetSnapContract.test.ts',
    'src/hooks/useZoomPanViewport.ts',
    'src/lib/cameraTransition.ts',
    'src/lib/cameraTransition.test.ts',
    'src/lib/canvasGestureZoom.ts',
    'src/lib/canvasGestureZoom.test.ts',
    'src/lib/canvasWheelDelta.ts',
    'src/lib/canvasWheelDelta.test.ts',
    'src/lib/canvasKeyboardCamera.ts',
    'src/lib/canvasKeyboardCamera.test.ts',
    'src/lib/canvasKeyboardState.ts',
    'src/lib/canvasScrollRegions.ts',
    'src/lib/canvasScrollRegions.test.ts',
    'src/lib/canvasChromeResize.ts',
    'src/lib/keyboardTarget.ts',
    'src/contexts/CanvasZoomChromeContext.tsx',
    'src/components/editor/EditorZoomIndicator.tsx',
    'src/lib/layoutTokens.ts',
    'src/lib/slideLayout.ts',
    'src/components/editor/canvasPhaseSectionLayout.ts',
    'src/lib/compareGridTracks.ts',
    'src/lib/compareReviewStore.ts',
    'src/lib/compareZoneNavigation.ts',
    'src/lib/compareGate.report.test.ts',
    'src/lib/mergedMembershipRailContract.test.ts',
    'src/lib/blueprintLayoutEstimate.test.ts',
    'src/components/cover/CoverTabStrip.tsx',
    'src/components/cover/coverMeasure.ts',
    'src/hooks/use-mobile.ts',
    'src/hooks/useMobileShell.ts',
    'src/components/mobile/MobileAgentFab.tsx',
    'src/components/mobile/MobileAgentSheet.tsx',
    'src/components/mobile/mobileAgentBridge.ts',
    'src/components/mobile/mobileAgentFab.test.tsx',
    'src/components/mobile/mobileShellLogic.test.ts',
    'src/lib/agent/panelState.ts',
    'src/lib/agent/persistence.ts',
    'src/lib/agent/providers/anthropic.ts',
    'src/lib/agent/providers/google.ts',
    'src/lib/agent/providers/models.ts',
    'src/lib/agent/providers/provider.ts',
    'src/components/ui/accordion.tsx',
    'src/components/ui/attachment.tsx',
    'src/components/ui/breadcrumb.tsx',
    'src/components/ui/bubble.tsx',
    'src/components/ui/card.tsx',
    'src/components/ui/carousel.tsx',
    'src/components/ui/collapsible.tsx',
    'src/components/ui/command.tsx',
    'src/components/ui/context-menu.tsx',
    'src/components/ui/deferred-skeleton.tsx',
    'src/components/ui/dialog.tsx',
    'src/components/ui/drawer.tsx',
    'src/components/ui/dropdown-menu.tsx',
    'src/components/ui/input-group.tsx',
    'src/components/ui/input.tsx',
    'src/components/ui/marker.tsx',
    'src/components/ui/menubar.tsx',
    'src/components/ui/message-scroller.tsx',
    'src/components/ui/message.tsx',
    'src/components/ui/navigation-menu.tsx',
    'src/components/ui/popover.tsx',
    'src/components/ui/separator.tsx',
    'src/components/ui/sheet.tsx',
    'src/components/ui/sidebar.tsx',
    'src/components/ui/spinner.tsx',
    'src/components/ui/tabs.tsx',
    'src/components/ui/textarea.tsx',
    'src/components/ui/toggle-group.tsx',
    'src/components/ui/toggle.tsx',
    'src/components/ui/tooltip.tsx',
    'src/components/blueprint/BlueprintEmptyCellSlot.tsx',
    'src/components/blueprint/BlueprintStoryboardPlayButton.tsx',
    'src/components/blueprint/EntityDetailPanel.tsx',
    'src/components/blueprint/LaneCollapseToggle.tsx',
    'src/components/blueprint/NotionPropertyRow.tsx',
    'src/components/blueprint/PhasePanel.tsx',
    'src/components/blueprint/ScenarioSlideFilters.tsx',
    'src/components/blueprint/StakeholderSelect.test.tsx',
    'src/components/blueprint/StoryboardWalkthroughShell.tsx',
    'src/contexts/StoryboardWalkthroughContext.tsx',
    'src/contexts/ViewStateContext.tsx',
    'src/contexts/sliceMembershipContext.ts',
    'src/components/editor/CanvasLoadProgress.tsx',
    'src/components/editor/canvasLoadProgress.test.tsx',
    'src/lib/canvasLoadProgress.ts',
    'src/components/editor/CanvasSlideConnectors.tsx',
    'src/components/editor/EditorSidebarRail.tsx',
    'src/components/editor/IconTooltip.tsx',
    'src/components/editor/OverviewPhaseRowDivider.tsx',
    'src/components/editor/ScenarioMenubarBreadcrumb.tsx',
    'src/components/editor/SegmentedControl.tsx',
    'src/components/editor/SlideNav.tsx',
    'src/dev/ArrowSituationCatalogPage.tsx',
    'src/dev/arrowSituationCatalog.test.tsx',
    'src/dev/__snapshots__/arrowSituationCatalog.test.tsx.snap',
    'src/hooks/usePathSelection.ts',
    'src/hooks/useSliceBlueprint.ts',
    'src/lib/annotationCapture.ts',
    'src/lib/attachmentUpload.test.ts',
    'src/lib/cellPickGrammar.ts',
    'src/lib/parseCellContent.ts',
    'src/lib/placementLinkMutations.test.ts',
    'src/lib/resolveBlueprintCellId.ts',
    'src/lib/resourceUrl.ts',
    'src/lib/supabase.ts',
    'src/lib/valueProps.ts',
    'src/styles/tailwind-plugins/hit-area.css',
    'src/styles/typography.config.js',
    'src/styles/variants.css',
    'src/components/EditorErrorBoundary.tsx',
    'src/components/editor/SidebarNav.tsx',
    'src/contexts/viewStateStore.ts',
    'src/styles/global.css',
    'src/assets/hero.png',
    'src/assets/react.svg',
    'src/assets/vite.svg',
    'src/vite-env.d.ts',
    'src/components/editor/ZoomPanViewport.tsx',
    'src/components/editor/MarqueeSelection.tsx',
    'src/components/editor/CanvasPenCursor.tsx',
    'src/components/editor/CanvasAnnotationToolbar.tsx',
    'src/contexts/CanvasAnnotationProvider.tsx',
    'src/contexts/canvasAnnotationContext.ts',
    'src/contexts/canvasAnnotationSubscription.test.tsx',
    'src/lib/agent/uiBridge.ts',
    'src/lib/agent/uiBridge.camera.test.ts',
    'src/lib/agent/uiCommands.ts',
    'src/lib/canvasFocusCells.ts',
    'src/lib/canvasFocus.ts',
    'src/lib/canvasTouchContract.test.tsx',
    'src/hooks/useCompareGridAxis.ts',
    'src/components/blueprint/CompareLaneRowShell.tsx',
    'src/lib/railRhythmContract.test.ts',
    'src/components/blueprint/BlueprintLabelRail.tsx',
    'src/components/blueprint/ComparePathSectionFrame.tsx',
    'src/components/blueprint/PathLabelBadge.tsx',
    'src/components/blueprint/PathKindBadge.tsx',
    'src/components/blueprint/PathKindColorKey.tsx',
    'src/components/blueprint/PathSummaryTooltip.tsx',
    'src/components/blueprint/ScenarioTitleBadge.tsx',
    'src/components/blueprint/BlueprintDividerBadge.tsx',
    'src/hooks/useCollapsedBlueprintLanes.ts',
    'src/lib/blueprintLaneCollapse.ts',
    'src/components/blueprint/CompareTrackDecorations.tsx',
    'src/lib/phaseRowPanelHeight.ts',
    'src/lib/phaseRowPanelHeight.test.ts',
    'src/hooks/useAlignedPhaseRowPanelHeight.ts',
    'src/components/blueprint/ScenarioPanel.tsx',
    'src/components/editor/AdminSessionFields.tsx',
    'src/components/editor/AgentProviderFields.tsx',
    'src/components/editor/CanvasSelectionProvider.tsx',
    'src/components/editor/EditorSequenceNav.tsx',
    'src/components/editor/PhaseSectionFlowArrow.tsx',
    'src/components/editor/ToolFamilyMenu.tsx',
    'src/contexts/canvasRevealContext.ts',
    'src/lib/applyBlueprintDisplayFilters.ts',
    'src/lib/compareMergedGrid.test.ts',
    'src/types/integratedBlueprint.ts',
    'scripts/erd-value-sets.mjs',
    'src/lib/blueprintDisplayFlags.ts',
    'src/components/blueprint/badgeGeometry.test.tsx',
    'src/components/cover/CoverCommandCopy.tsx',
    'src/components/editor/PhaseOverviewPhaseLoopArrow.tsx',
    'src/lib/canvasCameraPolicy.ts',
    'src/lib/comparisonCameraContract.test.ts',
    'src/contexts/BlueprintCellDetailContext.tsx',
    'src/components/blueprint/TouchpointCellFace.tsx',
    'src/components/blueprint/BlueprintCellButton.tsx',
    'src/components/editor/AgentScopeField.tsx',
    'src/components/editor/agentScopeField.test.tsx',
    'public/step-visual-placeholder.svg',
    'tsconfig.json',
    'tsconfig.app.json',
    'components.json',
    'src/components/mobile/MobilePathSelector.tsx',
    'src/components/ui/alert.tsx',
    'docs/agents/triage-labels.md',
    'src/lib/blueprintCellSelection.ts',
    'src/types/blueprintCellDetail.ts',
    'src/lib/resolveBlueprint.ts',
    'src/lib/compareSlots.ts',
    'src/lib/compareMergedGrid.ts',
    'src/lib/compareLedger.ts',
    'src/lib/compareSlots.test.ts',
    'src/lib/compareLedger.test.ts',
    'src/contexts/EntityDetailContext.tsx',
    'src/styles/base.css',
    'src/styles/utilities.css',
    'src/styles/unset-tw-colors.css',
    'src/styles/compat.css',
    'src/styles/animations.css',
    'src/styles/tailwind.config.css',
    'src/styles/theme.css',
    'src/lib/motion.ts',
    'src/lib/motion.test.ts',
    'src/lib/tailwindColorReset.test.ts',
    'src/lib/compatLayer.test.ts',
  ])
})

test('no path is enrolled twice, so removing one entry really un-enrols a file', () => {
  // #407. Three paths were listed twice, each because a later ticket re-listed
  // a path an earlier one had already enrolled, inside its own commented
  // block — the natural mistake, since the blocks are grouped by ticket and a
  // file that two tickets touched reads as belonging in two places.
  //
  // Nothing was ever measured wrongly: the checker compared each of them to
  // asb twice and reached the same verdict both times. What a duplicate breaks
  // is REMOVAL, and removal is the operation this list most needs to keep
  // honest. Delete one occurrence of a doubly-listed path and the file stays
  // enrolled from the other block, silently — so a deliberate un-enrolment
  // reads as done and has not happened. It also inflates the count in the
  // checker's own summary line, which is the number quoted in PR bodies.
  //
  // This is derived from RECONCILED_FILES and from nothing else, on purpose.
  // The `deepEqual` above is duplicate-sensitive and so does notice a new
  // duplicate — but it notices it as a mismatch between two long arrays, and
  // the obvious way to make that mismatch go away is to paste the new line
  // into the expectation as well. That is how all three of the originals
  // arrived. A check that reads only the shipped list cannot be quieted that
  // way.
  const seen = new Set()
  const duplicated = []
  for (const path of RECONCILED_FILES) {
    if (seen.has(path) && !duplicated.includes(path)) duplicated.push(path)
    seen.add(path)
  }
  assert.deepEqual(duplicated, [])
  assert.equal(RECONCILED_FILES.length, seen.size)
})

test('an enrolled file byte-identical to asb passes', () => {
  const problems = auditReconciled({
    files: ['src/lib/shared.ts'],
    readInstance: () => bytes('export const x = 1\n'),
    readAsb: () => bytes('export const x = 1\n'),
  })
  assert.deepEqual(problems, [])
})

test('an enrolled file that differs from asb fails', () => {
  const problems = auditReconciled({
    files: ['src/lib/shared.ts'],
    readInstance: () => bytes('export const x = 1\n'),
    readAsb: () => bytes('export const x = 2\n'),
  })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /drifted/)
})

test('a difference as small as a trailing newline fails — this is byte-identity', () => {
  const problems = auditReconciled({
    files: ['src/lib/shared.ts'],
    readInstance: () => bytes('export const x = 1\n'),
    readAsb: () => bytes('export const x = 1'),
  })
  assert.equal(problems.length, 1)
})

test('an enrolled path asb does not ship fails rather than passing blind', () => {
  const problems = auditReconciled({
    files: ['src/lib/instance-only.ts'],
    readInstance: () => bytes('export const x = 1\n'),
    readAsb: () => null,
  })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /no copy/)
})

test('an enrolled path this repo has deleted fails rather than passing blind', () => {
  const problems = auditReconciled({
    files: ['src/lib/gone.ts'],
    readInstance: () => null,
    readAsb: () => bytes('export const x = 1\n'),
  })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /does not exist in this repo/)
})

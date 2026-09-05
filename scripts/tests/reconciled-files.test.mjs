#!/usr/bin/env node
/**
 * The reconciled-set drift gate's contract (#319): an empty allowlist passes,
 * an enrolled file byte-identical to asb passes, an enrolled file that differs
 * fails.
 *
 * `auditReconciled` is exercised against in-memory readers rather than a real
 * asb checkout, so the outcomes are pinned to byte-equality alone and not to
 * whatever the pinned package happens to ship. The one test that does touch
 * the shipped list asserts the enrolled set — first populated by #351, the
 * shared arrow-routing engine.
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

test('the shipped allowlist holds the arrow engine (#351), the panel editors (#357), and the viewport/layout convergence (#323 slices S0–S5)', () => {
  // #319 shipped the gate EMPTY; #351 enrolled the first files — the shared
  // arrow-routing geometry — #357 enrolled the entity panel editors asb
  // ported back out of uno, and #323's slice S0 swept every remaining
  // byte-identical path under src/ (viewport/layout/compare, mobile shell,
  // agent providers, shadcn primitives, and the rest). A stray add or removal
  // trips here, so enrolment stays a deliberate act in a reconciliation ticket.
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
    'src/components/blueprint/BlueprintVisualPlayButton.tsx',
    'src/components/blueprint/EntityDetailPanel.tsx',
    'src/components/blueprint/LaneCollapseToggle.tsx',
    'src/components/blueprint/NotionPropertyRow.tsx',
    'src/components/blueprint/PhasePanel.tsx',
    'src/components/blueprint/ScenarioSlideFilters.tsx',
    'src/components/blueprint/StakeholderSelect.test.tsx',
    'src/components/blueprint/VisualWalkthroughShell.tsx',
    'src/contexts/ViewStateContext.tsx',
    'src/contexts/VisualWalkthroughContext.tsx',
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
    'src/lib/compareGridTracks.ts',
    'src/hooks/useCollapsedBlueprintLanes.ts',
    'src/lib/blueprintLaneCollapse.ts',
    'src/components/blueprint/CompareTrackDecorations.tsx',
    'src/lib/phaseRowPanelHeight.ts',
    'src/lib/phaseRowPanelHeight.test.ts',
    'src/hooks/useAlignedPhaseRowPanelHeight.ts',
  ])
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

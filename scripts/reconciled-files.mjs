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

  // viewport (#323, slice S0): the camera core — pan/zoom transitions,
  // gesture/wheel/keyboard-driven zoom, scroll regions, chrome resize, and
  // the keyboard-target seam they all read. Pure geometry and state, no
  // PLUS content; asb renders uno's viewport identically off this set.
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

  // layout (#323, slice S0): the geometry tokens and phase/slide layout math
  // the viewport and the canvas both measure against.
  'src/lib/layoutTokens.ts',
  'src/lib/slideLayout.ts',
  'src/components/editor/canvasPhaseSectionLayout.ts',

  // compare (#323, slice S0): the side-by-side compare layout's grid tracks,
  // review state, and zone navigation, plus the gate report test pinning them.
  'src/lib/compareGridTracks.ts',
  'src/lib/compareReviewStore.ts',
  'src/lib/compareZoneNavigation.ts',
  'src/lib/compareGate.report.test.ts',

  // cover (#323, slice S0): the cover page's tab strip and the measurement
  // hook it reads.
  'src/components/cover/CoverTabStrip.tsx',
  'src/components/cover/coverMeasure.ts',

  // mobile shell: the read-only mobile shell and its agent-launch affordance
  // are one implementation in both repos — no PLUS content, pure viewport.
  'src/hooks/use-mobile.ts',
  'src/hooks/useMobileShell.ts',
  'src/components/mobile/MobileAgentFab.tsx',
  'src/components/mobile/MobileAgentSheet.tsx',
  'src/components/mobile/mobileAgentBridge.ts',
  'src/components/mobile/mobileAgentFab.test.tsx',
  'src/components/mobile/mobileShellLogic.test.ts',

  // canvas agent providers: the model-provider adapters and the panel state
  // and persistence they share sit above uno's own tool registry, not below
  // it — the wiring is generic even though the tools are not.
  'src/lib/agent/panelState.ts',
  'src/lib/agent/persistence.ts',
  'src/lib/agent/providers/anthropic.ts',
  'src/lib/agent/providers/google.ts',
  'src/lib/agent/providers/models.ts',
  'src/lib/agent/providers/provider.ts',

  // shadcn ui primitives: unmodified library components neither repo has
  // customised — the fork point is further up, in the blueprint-specific
  // components that compose these.
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

  // blueprint entity extras: further panel and walkthrough surface that
  // ported the same way #357's first pass did, plus the view-state and
  // slice-membership contexts they read.
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

  // editor chrome: the load-progress indicator and its test, the slide
  // connectors, sidebar rail, and the small chrome pieces around them.
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

  // dev catalog: the arrow-situation catalog page, its test, and the
  // snapshot the test pins — a dev-only surface, still shared byte-for-byte.
  'src/dev/ArrowSituationCatalogPage.tsx',
  'src/dev/arrowSituationCatalog.test.tsx',
  'src/dev/__snapshots__/arrowSituationCatalog.test.tsx.snap',

  // lib grab bag: small pure utilities and their tests with no per-repo
  // vocabulary to fork on.
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

  // styles: the tailwind hit-area plugin, typography config, and shared
  // component variants.
  'src/styles/tailwind-plugins/hit-area.css',
  'src/styles/typography.config.js',
  'src/styles/variants.css',

  // scaffolding: the Vite starter assets and ambient type declaration
  // neither repo has touched.
  'src/assets/hero.png',
  'src/assets/react.svg',
  'src/assets/vite.svg',
  'src/vite-env.d.ts',

  // #323 slice S1: the agent drives the canvas camera, and the annotation
  // state is two contexts. asb generalized to uno's superset (verified focus,
  // canvas_camera command, tool/marks split, set_canvas_tool); uno took asb's
  // spellings (`summary` on a UI command, "intake scenario").
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

  // #323 slices S3–S4: the compare canvas's shared axis and its path frame.
  // asb absorbed uno's rail axis (asb #145) and the frame's label-axis offset,
  // header rail and badges (asb #146), and uno takes those copies back here.
  // The badges came with asb's spelling — `summary` where uno said
  // `description`, `PathKind*` where uno said `PathType*` — and every uno call
  // site was re-pointed rather than the file being edited back.
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

  // #323 slice S5a/S5c: the compare grid's tracks and lane collapse, and the
  // aligned phase-row height. S5a is enrolment alone — the four paths were
  // already byte-identical (one carried a trailing blank line). S5c takes
  // asb's split of the row-height rule into `resolveScenarioPanelHeight`,
  // which is the `Math.max(rowPanelHeight ?? 0, floor)` uno already had
  // inline; the hook's `focusedPanelHeight` is `excludedPanelHeight` in asb's
  // spelling, and `PhaseScenarioOverview` (still forked) was re-pointed.
  'src/lib/compareGridTracks.ts',
  'src/hooks/useCollapsedBlueprintLanes.ts',
  'src/lib/blueprintLaneCollapse.ts',
  'src/components/blueprint/CompareTrackDecorations.tsx',
  'src/lib/phaseRowPanelHeight.ts',
  'src/lib/phaseRowPanelHeight.test.ts',
  'src/hooks/useAlignedPhaseRowPanelHeight.ts',

  // asb 1.5.0 adopt (#323, #325 S1; badge size #149, vocabulary #160): the
  // sweep the pin bump made possible. Not one of these was edited — each was
  // already byte-identical at the new pin and merely unenrolled, so this group
  // is enrolment alone, the way S5a's four paths were. The three badge
  // wrappers are NOT here because they were already enrolled: what the `size`
  // variant did was put them back to identical. `ui/badge.tsx` itself stays
  // forked — uno took the size block and kept its own variant table, which
  // carries no hover state (#182).
  //
  // `scripts/erd-value-sets.mjs` is the first path enrolled outside `src/`.
  // Nothing in the gate ever restricted it to `src/`; this is simply the first
  // script both repos hold identical — a pure ERD parser over a catalog either
  // repo supplies.
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

  // #326 S1 — display flags. The flags module was uno's last per-scenario
  // allowlist: two module-private `Set`s of hardcoded scenario UUIDs, read
  // only after an `if (FLAG) return true` on a flag that is `true`, so no
  // caller could ever observe them. asb had already deleted them; uno takes
  // asb's file whole, and the four scenario-id imports go with the Sets.
  // `applyBlueprintDisplayFilters.ts` — the only caller that passes a
  // scenario id at all — was enrolled at the 1.5.0 sweep above and is not
  // repeated here.
  'src/lib/blueprintDisplayFlags.ts',

  // asb 1.5.1 adopt (#324 S1+S2). The template took uno's names and camera
  // policy — chip→badge/tag, picture→image, the loop arrow's z-20, the
  // camera thresholds as a module — so these five arrived identical at the
  // pin bump and are enrolment alone. `CoverCommandCopy.tsx` is the cover's
  // copy button under the name uno already used; `canvasCameraPolicy.ts` and
  // its contract test were uno-only files until 1.5.1 carried them over.
  'src/components/blueprint/badgeGeometry.test.tsx',
  'src/components/cover/CoverCommandCopy.tsx',
  'src/components/editor/PhaseOverviewPhaseLoopArrow.tsx',
  'src/lib/canvasCameraPolicy.ts',
  'src/lib/comparisonCameraContract.test.ts',

  // #324 S1 — the cell-detail context. Two hunks apart at the 1.5.1 pin,
  // both template-ahead: a reset hands the drawer back (`releasePanel('cell')`)
  // so the next opener starts from nobody owning it, and the share-link
  // comment names "the agent" rather than a deployment's bot and connector
  // doc. uno takes both; the file is identical and enrolled.
  'src/contexts/BlueprintCellDetailContext.tsx',

  // #325 S6 — touchpoint cell (asb 1.5.2). The template took every uno-ahead
  // behaviour of the touchpoint cell at 1.5.2 — `status`, the fixed height,
  // `inline`, `aria-describedby`, `selectionContext` — and kept its own split
  // of the read-only face into `TouchpointCellFace`. uno takes that split:
  // the face arrives whole and is enrolled here. `BlueprintTouchpointCell.tsx`
  // itself is NOT enrolled — its `nameOnly` comment cites uno's #277 where the
  // template cites its own #112 — and neither is `BlueprintCellButton.tsx`,
  // which carries uno's `onOpen` (the storyboard cell opens its STEP). The
  // heights the face reads are uno's, because `blueprintLayout.ts` stays
  // forked at 52/42 against the template's 44/34 pending Q10.
  'src/components/blueprint/TouchpointCellFace.tsx',

  // The cell button. Its one remaining hunk was an `onOpen` prop nobody
  // passed: the storyboard call site went when a frame became a cell with
  // its own id, and the step is one click away on its column header. Dead
  // code does not cross into the template; uno drops the prop and takes the
  // template's file, comment citations included.
  'src/components/blueprint/BlueprintCellButton.tsx',
]

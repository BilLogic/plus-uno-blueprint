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

  // The two compare contracts the template took at v1.8.0, when it adopted
  // this deployment's answers to #396's Q50, Q17, Q16 and Q52. They are the
  // pinning half of those decisions rather than the decisions themselves:
  // `mergedMembershipRailContract` asserts the membership OUTLINE and the
  // absence of the rail wash and the divergence strip, and
  // `blueprintLayoutEstimate` measures the fixed-face cell heights that
  // replaced the template's text measurement. Both became byte-identical the
  // moment the template stopped drawing the other way, and both are the sort
  // of file where a one-sided edit is the drift worth catching — a contract
  // that stops asserting an absence on one side only is how a deleted
  // component comes back.
  'src/lib/mergedMembershipRailContract.test.ts',
  'src/lib/blueprintLayoutEstimate.test.ts',

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

  // asb 1.6.1 adopt (#327 S1). The template's mechanical layers→lanes rename
  // had substituted the new word into ordinary English in these files'
  // comments — tabs stacked over a base view, and the design tokens' semantic
  // tier, each came out saying lane; with the sentences restored on that
  // side they match ours. `activeServiceStore.ts` is not here: the template
  // has no `useActiveService` hook to name until #325's Q45 settles the
  // active-service provider.
  'src/components/EditorErrorBoundary.tsx',
  'src/components/editor/SidebarNav.tsx',
  'src/contexts/viewStateStore.ts',
  'src/styles/global.css',

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
  // KNOWN RED UNTIL THE PIN MOVES TO asb 1.6.2, and the entry stays anyway.
  // This file and `badgeGeometry.test.tsx` below each carried a comment
  // calling the badge's default size a "chip". The comment sweep in
  // `scripts/tests/badge-and-tag.test.mjs` reads comments under `src` as of
  // this change, so both were repaired here, taking asb's own replacement
  // sentences word for word — asb fixed its side first, and the fix is in the
  // template's tree but not yet in a release. So the two are byte-identical to
  // asb HEAD and differ from asb 1.6.1, which is what `check:reconciled`
  // measures against, and it fails on exactly these two paths until the pin
  // bumps. Dropping the entries would trade a loud, self-clearing failure for
  // a silent end to the promise; the enrolment is the promise, and it holds.
  'src/components/blueprint/ScenarioTitleBadge.tsx',
  'src/components/blueprint/BlueprintDividerBadge.tsx',

  // #323 slice S5a/S5c: the compare grid's tracks and lane collapse, and the
  // aligned phase-row height. S5a is enrolment alone — the four paths were
  // already byte-identical (one carried a trailing blank line). S5c takes
  // asb's split of the row-height rule into `resolveScenarioPanelHeight`,
  // which is the `Math.max(rowPanelHeight ?? 0, floor)` uno already had
  // inline; the hook's `focusedPanelHeight` is `excludedPanelHeight` in asb's
  // spelling, and `PhaseScenarioOverview` (still forked) was re-pointed.
  //
  // `src/lib/compareGridTracks.ts` is the fourth of S5a's paths, and it is
  // deliberately NOT repeated here (#407). Slice S0 had enrolled it the day
  // before, in the `compare (#323, slice S0)` block above, beside the review
  // store and the zone navigation it is the layout half of. S5a's lane-collapse
  // work changed the file, which is why the slice names it in this sentence,
  // but the promise to hold it byte-identical is S0's and is made only once.
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

  // asb 1.6.0 adopt (#163 part A). The template took the deployment's
  // service identity — `services.slug`, the scope module, the scope field on
  // agent settings — so the field and its test arrived identical and are
  // enrolment alone. `serviceScope.ts` itself stays apart by a few sentences
  // (the template has no `search_blueprint` and says its catalog carries no
  // `service_id` rather than dropped it — Q21) and is not here.
  'src/components/editor/AgentScopeField.tsx',
  'src/components/editor/agentScopeField.test.tsx',

  // #327 S1 — the free set. Two of the seven the survey named were already
  // byte-identical at the 1.6.0 pin and are enrolment alone. The other five
  // differ by a comment each — three of them the template's mechanical
  // `layer`→`lane` rename substituting the new word into ordinary English — and
  // converge from the template's side, where the wording is fixed. Four of
  // those five are enrolled in the `asb 1.6.1 adopt (#327 S1)` block above;
  // the fifth, `activeServiceStore.ts`, is named there as waiting on #325's
  // Q45 and is not on this list yet.
  //
  // The free two are `src/contexts/ViewStateContext.tsx` and
  // `src/styles/variants.css`, and neither is listed here (#407). "Already
  // byte-identical at the 1.6.0 pin" was all the survey checked, and it was
  // true for a reason the survey did not look for: #323's slice-S0 sweep had
  // enrolled both the day before — the view-state context up with the panel
  // and walkthrough surface that reads it, the variants sheet up with the
  // hit-area plugin and the typography config. So S1 owed no new entry for
  // either. This paragraph is the record that it considered them, kept where
  // a later pass over the same seven will look for it rather than adding the
  // two lines back.

  // #391 phase B — storyboard, not visual. The rename's own enrolment is one
  // file: the placeholder a `cells.frame` carries when a step has no artwork
  // yet. Its NAME is a data value — `/step-visual-placeholder.svg` is written
  // into fourteen applied migrations, so renaming the asset would turn every
  // placeholder into a real frame — so only the copy inside it moved, on both
  // sides, to the same two sentences. It is the first path enrolled under
  // `public/`; nothing in the gate was ever restricted to `src/`, which
  // `scripts/erd-value-sets.mjs` already showed.
  //
  // The three walkthrough files the template renamed stayed enrolled through
  // the move — they are the same promise at `BlueprintStoryboardPlayButton`,
  // `StoryboardWalkthroughShell` and `StoryboardWalkthroughContext` above, and
  // their entries moved with them. `panelShell.tsx`,
  // `applyBlueprintDisplayFilters.ts` and `blueprintDisplayFlags.ts` were red
  // at the 1.6.3 pin for the reason `ScenarioTitleBadge.tsx` was red at 1.6.1
  // — the template fixes its side first — and this change takes its text.
  'public/step-visual-placeholder.svg',

  // #403 — the identical-by-history sweep. At the 1.6.4 pin eleven tracked
  // files were already byte-identical to the template without ever having
  // been enrolled, which is the opposite of how this list is meant to grow:
  // a path belongs here because a ticket decided the two copies should be
  // HELD together, not because they happen to agree today. So the eleven were
  // judged one at a time. Six are enrolled below; the five declines are
  // written down at the end of this block, so the next sweep over the same
  // set finds the answers where it finds the question.

  // The configuration the SHARED SET is written against. Each of these
  // decides what the files already on this list mean, rather than how this
  // deployment is built, and that is the whole of why they are here.
  // `tsconfig.json` carries the `@/*` mapping every reconciled file's imports
  // resolve through; remap it on one side alone and two hundred byte-identical
  // files quietly stop naming the same modules — identical text with different
  // meaning, the one failure a byte-identity gate cannot see for itself.
  // `tsconfig.app.json` is the language those files are authored in —
  // `strict`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, the ES2023 target,
  // the `src` include — and a repo that relaxes a flag alone discovers the
  // breakage in the OTHER repo's build. `components.json` is the shadcn
  // registry config that GENERATES the thirty-odd `src/components/ui/`
  // primitives above: a changed `style` or `baseColor` moves no file by
  // itself, it makes the next `shadcn add` on either side emit a
  // differently-shaped primitive and starts that group drifting one file at a
  // time with no single change to blame.
  // These are the first root-level paths on the list.
  'tsconfig.json',
  'tsconfig.app.json',
  'components.json',

  // Ordinary shared surface, and the two easiest yeses of the eleven.
  // `MobilePathSelector.tsx` is the phone's top-bar path control and belongs
  // with the mobile shell group above — no PLUS content, pure chrome. It
  // composes an enrolled dropdown over the `PathListItem` shape, and reads
  // only the `id` and `name` both repos spell the same way, which is why it
  // is identical while `src/lib/pathSelection.ts` under it is still forked.
  // `alert.tsx` sits in `src/components/ui/` but is deliberately NOT filed
  // with the "unmodified library components" group, whose comment it would
  // make false: this one is customised, and heavily — the filled icon square,
  // the tinted status surfaces, the contrast measurement written into its own
  // comments. That both repos carry the SAME customisation argues for the
  // gate rather than against it, because a shared recipe nobody is holding to
  // one shape is exactly what drifts unnoticed. The brand divergence lives a
  // tier below, in the values `colors.css` gives these tokens, and that file
  // is not on this list and is not meant to be.
  'src/components/mobile/MobilePathSelector.tsx',
  'src/components/ui/alert.tsx',

  // The harness standard (#364), and the first path enrolled under `docs/`.
  // Nothing in the gate was ever restricted to `src/`, which
  // `scripts/erd-value-sets.mjs` and `public/step-visual-placeholder.svg`
  // already showed. This file maps the five canonical triage roles to the
  // label strings a tracker actually uses, and both repos drive the same
  // engineering skills off it, so a role the template respells is a label
  // this deployment's agents would go on applying under the old one. Its two
  // neighbours in `docs/agents/` are the control: `issue-tracker.md` and
  // `domain.md` are the same standard and both differ, each by the single
  // sentence naming a per-repo fact. This one names none — uno's right-hand
  // column is the canonical strings unchanged, and `AGENTS.md` pins them that
  // way inline. The file's closing line invites a deployment to edit that
  // column; if uno ever takes it up the entry comes out, which is how one of
  // these promises ends rather than a reason never to make it.
  'docs/agents/triage-labels.md',

  // #405 — the cell-selection builders. The last fact between the two copies
  // was a fork stated four times: this deployment's selection context carried
  // `cellLinks` and wrote `links` into each path entry, where the template
  // carries `cellTouchpoints` and writes `touchpoints`. The template had
  // finished a migration this deployment started, so the deployment owed it
  // rather than the other way round, and #401 had already closed the other
  // fact by moving `isNameOnlyPlacement` into `cellTouchpoints.ts`. The
  // selection path now takes placements; `cellTouchpointsFromLinks` stays as
  // the adapter for a hand-written fixture board, called from the one
  // accessor (`cellTouchpoints`) at the seam where a cell last knows which
  // source it came from.
  'src/lib/blueprintCellSelection.ts',

  // #405 follow-up — the type the selection builders write into. Two comment
  // lines were all that separated the copies, and one of them was residue of
  // the lane-vocabulary rename (#395): it named the touchpoint lanes by their
  // retired display names, `Front Stage Tech, Back Stage Tech`, which no
  // deployment but this one ever had. The template's wording says `on a
  // touchpoint lane`, which is the lane ROLE and is what the glossary now
  // uses. Taking it is a correction, not a preference. The other line gains
  // one word — a phase belongs to a service — and is simply more precise.
  'src/types/blueprintCellDetail.ts',

  // The blueprint resolver (#326 S4, #396 Q36/Q37/Q40). The last thing keeping
  // this file forked was a pair of read-time repairs for this deployment's own
  // rows — `repairWarmUpAlternatePathBlueprint` and
  // `repairDiscoverySadPathBlueprint`, both gated on hardcoded PLUS UUIDs, and
  // an early return that rendered one path from its curated fixture whatever
  // the database held. Both faults were fixed at source: the Warm-Up lane
  // positions by `20260821270000`, and the Discovery sad path by having been
  // deleted from the database entirely in `20250710134500`, which left its
  // repair firing on a board no reader has seen since. A repair applied on
  // every load is a fault the rows still have; these rows no longer have one,
  // so the code went rather than moving upstream. What is left is the generic
  // merge both repos want: one `fillMissing` matched by name over the two
  // relations that replaced `cells.links`, and `path.summary` under this
  // deployment's own column name instead of the retired `description`.
  'src/lib/resolveBlueprint.ts',

  // The compare data layer (#382, answered as section F of the decision queue
  // #396). These three files were the last of the v1.5.0 adopt left outside
  // the gate, and the fact keeping them out was not a fork: the template
  // compares a FOURTH field, `touchpoints`, and this deployment compared
  // three. The superset rule that settles most of these — the deployment's
  // richer version wins — decides nothing when one side simply lacks a
  // feature, so the owner decided it, and the decision is that this
  // deployment takes the field.
  //
  // What the field buys is not a tidier list of constants. A touchpoint lane's
  // cell carries placements its grid label never names — the author types one
  // touchpoint into the cell and places the rest from the panel — so two paths
  // could hold a visibly different set of touchpoints at the same slot, agree
  // on content, summary and resources, and be reported `shared`. The reader
  // was told the paths were identical at a slot whose board drew different
  // touchpoints. `src/components/blueprint/compareTouchpointDifferences.test.tsx`
  // is the evidence that the fourth field changed that, and it stays OFF this
  // list: the template has no test for its own field, so a byte-identical one
  // is not available to write.
  //
  // Two facts came with the field and are worth naming, because neither is
  // about touchpoints. `compareMergedGrid.ts` differed by a single comment
  // clause and `compareLedger.ts` by that plus a local rename — `position` to
  // `columnPosition`, in a function that already has a `columnLabel` beside
  // it. Both are the template's wording of a shared implementation, and
  // neither changes what any of the three files computes.
  //
  // The two tests come with the sources rather than after them, which is the
  // rule the #357 block above states: a shared implementation whose test
  // drifts is a shared implementation nobody is holding to the same promise.
  // `compareMergedGrid.test.ts` was already enrolled at the v1.5.0 sweep
  // while its source was not, so this closes that pair from the other side.
  // Their diffs were the same shape as the sources' — the vocabulary this
  // deployment has already taken (`description` to `summary`, a named
  // deployment to "a deployment"), one stray indent, and one assertion the
  // template added when it deleted a dead guard.
  'src/lib/compareSlots.ts',
  'src/lib/compareMergedGrid.ts',
  'src/lib/compareLedger.ts',
  'src/lib/compareSlots.test.ts',
  'src/lib/compareLedger.test.ts',
  // The entity panel's state (#324, #396 Q31). The provider moved from the
  // canvas — `ServiceOverviewView`, which is one tab body — up to `EditorShell`,
  // above both the desktop and the mobile tree, so it spans the sidebar and
  // the chrome as well as the board. That was the whole of what still separated
  // the two copies of this file: with the provider reaching everything, the
  // hook stops returning an inert value outside it and throws instead, which
  // is the template's text word for word. A silent affordance is the one
  // failure a UI cannot report; a mounting mistake that crashes in development
  // is one it can.
  //
  // `EditorShell.tsx` and `ServiceOverviewView.tsx` are the two files the move
  // edits and NEITHER is enrolled — both are hundreds of lines apart from the
  // template on matters this ticket does not touch. What is enrolled is the
  // context they now agree about.
  'src/contexts/EntityDetailContext.tsx',

  // DECLINED by #403, recorded beside the enrolments from the same sweep so
  // that the next pass reads the reasoning instead of re-deriving it. None of
  // these is a near miss waiting for a better day; each names a file this
  // deployment wants free, and a later ticket that wants to reverse one
  // should have to argue with the paragraph under it.
  //
  // `vite.config.ts` — how this deployment is BUILT, served and tested, which
  //   is the one category where an instance legitimately differs from the
  //   package it is a deployment of. uno ships to Netlify and asb ships as a
  //   dependency. A base path, a dev proxy onto a local Supabase, a sourcemap
  //   setting, or one more glob in the vitest `include` for a new
  //   `scripts/tests/` suite are all changes uno is entitled to make alone,
  //   and every one of them would land as a gate failure.
  //
  // `tsconfig.node.json` — the compiler config for exactly one file,
  //   `vite.config.ts`, which the line above leaves free. It governs nothing
  //   on this list: `src/` is `tsconfig.app.json`'s, and no other enrolled
  //   path is TypeScript at all. Pinning a config to the template while its
  //   only subject is allowed to move is a promise about nothing, and the
  //   two entries would contradict each other the first time either moved.
  //
  // `eslint.config.js` — a register of THIS repo's own lint exceptions. Its
  //   per-file block names four components that co-export a hook or a constant
  //   beside the component itself, and its ignore list names a working
  //   convention; both are lists that grow whenever one repo gains a file the
  //   other has not got, and the divergence table in
  //   `docs/engineering/template-relationship.md` counts hundreds of such
  //   files on each side. The two configs agree today only because neither has
  //   needed a new exception since they converged, which is a coincidence with
  //   a short half-life. The specific harm the tsconfig entries above exist to
  //   prevent is absent here as well: two repos disagreeing about
  //   `no-unused-vars` cannot make identical source mean different things, it
  //   only makes one repo's lint louder than the other's.
  //
  // `public/favicon.svg` — deployment identity, unclaimed rather than shared.
  //   `index.html` sits beside it as the same shared path and already
  //   diverges on exactly one line, `<title>PLUS</title>` against the
  //   template's own name; the favicon is the other half of the same browser
  //   tab, and it matches only because nobody has drawn a PLUS mark yet.
  //   Enrolling it would say the deployment's mark is the template's to set,
  //   and would turn the day PLUS draws one into a gate failure.
  //   `step-visual-placeholder.svg` above is the contrast rather than the
  //   precedent: its NAME is a data value written into fourteen applied
  //   migrations, and its contents are two sentences of copy the repos agreed
  //   on word for word. An identity mark carries no such contract to hold.
  //
  // `supabase/migrations/20260803001000_slices_origin_allows_human.sql` — the
  //   flattest no of the five, on three independent grounds, and it needed to
  //   be: nothing on this list is a migration.
  //   `scripts/template-quarantine.json` quarantines `supabase/migrations/**`
  //   outright — the deployment owns its series, and a merge may never bring
  //   the template's copy of one. Enrolling it would put a single path under
  //   two flatly contradictory declarations: the template may never change
  //   this file here, AND this file must change here the moment the
  //   template's copy moves. It is also APPLIED, and an applied migration is
  //   never edited (`docs/engineering/access-and-security.md` § Migrations
  //   workflow, ADR 0009), so the gate's only remedy would be the one thing
  //   the repo forbids and the entry could only ever be dropped. Finally the
  //   shared filename is a coincidence of a shared plan and not a
  //   convergence: three of uno's ~860 migrations share a name with one of
  //   the template's thirty-eight, and the other two have ALREADY diverged —
  //   annotated upstream with the `@core` / `@recipe` markers
  //   `generate-portable-core.mjs` reads to build the template's
  //   portable-core contract. This one is identical only because that
  //   annotation pass has not reached it. When it does, the gate would fire
  //   on a change uno must not take and has no use for.

  // The shared stylesheets (#327 S3, gated on #396 Q47). Q47 made `tokenModel`
  // the single style seam in both repositories, and that is what makes a
  // stylesheet convergence checkable rather than hopeful: both sides now
  // resolve the same declarations through the same reader, so "identical" can
  // be measured at the value rather than argued at the text.
  //
  // Seven of the eleven shared sheets converged. Two moved in BOTH directions
  // — `tailwind.config.css` and `theme.css` — which is the convergence rule
  // working rather than one side winning. Nothing renders differently: 626
  // tokens resolved in light and dark on this side, 622 on the template's,
  // zero moved on either.
  //
  // The four that stayed out are three problems and not four, and none of them
  // is a stylesheet problem. `colors.css` differs in exactly seven
  // `--color-brand-*` steps written as literals; `print.css`'s WHOLE
  // divergence is a block restating those same ramps, and it has to use
  // literals because `themes/dark.css` sets its copies with no `@media
  // screen`, so a `var()` would resolve to the dark value on paper; and
  // `semantic.css` differs over where the primary and ring dials live. All
  // three are Q42 — the brand seam, which turns out not to be confined to
  // `themes/*.css` the way that question assumed. `blueprint.css` is the
  // genuine fourth: #323 still owns half of it, and it carries a
  // `partner-action` lane role the template's schema has no value for.
  //
  // The four non-stylesheet files come with the sheets rather than after them.
  // `motion.ts` and `motion.test.ts` moved together because converging
  // `animations.css` exposed that the test had stopped measuring anything: it
  // reduced selectors with a pattern that stops at a hyphen, so an added
  // `[data-slot='skeleton']` made it throw on a null instead of report a gap.
  // A test that reads one file and reduces selectors by pattern is one rename
  // away from measuring nothing, which is exactly the drift this list exists
  // to catch.
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
]

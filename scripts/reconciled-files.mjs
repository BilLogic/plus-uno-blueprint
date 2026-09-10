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
 *
 * ── WHAT A FILE ON THIS LIST MAY NOT SAY ──────────────────────────────────
 *
 * A file here is read from two repositories at once, so it CITES NO
 * REPO-LOCAL IDENTITY: no issue or pull-request number, no ADR number, no
 * migration filename, no `docs/` path, no plan or todo number. Each of those
 * is an address in one repository and resolves to something else, or to
 * nothing, in the other.
 *
 * This is measured, not feared. `#243` was "One definition card, and no icon
 * anywhere" here and "Printing from dark mode renders the filled control at
 * dark-theme lightness" upstream, and it appeared in eight enrolled files.
 * `#305` does not exist upstream at all. Of the three ADR citations this list
 * once carried, two named the wrong decision on one side or the other and the
 * third matched by luck.
 *
 * Where a shared comment has to point at a decision, it NAMES the decision:
 * "the decision that a service owns its journey and shares the catalog", never
 * "ADR 3". `src/hooks/useStakeholders.ts` is the worked example, and ADR 0014
 * carries the rule itself under "How a shared file cites this" — where a
 * reader chasing a citation lands, rather than in a document they would have
 * to know to look for.
 *
 * `check:reconciled` enforces this over everything on this list, whatever the
 * extension. `measure-template-divergence.mjs --enrollable` reports the other
 * side of it: shared files that differ by prose alone and are one agreed
 * comment away from belonging here.
 *
 * Two sets, and they are not the same one. The ADOPTION SURFACE is every file
 * the template ships that this repository also has and has NOT enrolled —
 * everything that could one day belong here. `--enrollable` is the narrow band
 * inside it that is one comment from belonging today. A sweep for citations
 * runs over the adoption surface, because the point is to catch an address
 * BEFORE a file reaches this list; a sweep for enrolments runs over the
 * enrollable band. Measured on the adoption surface at the 1.13.2 pin: 199
 * files, 244 addresses, of which exactly one was a defect. Where the only difference is two people
 * wording the same comment, the template's sentence is the tie-break; a
 * deployment sentence that is materially better goes upstream as its own
 * change first, never sideways.
 *
 * ── THE TIE-BREAK IS FOR PROSE, AND ONLY FOR PROSE ────────────────────────
 *
 * Comments, doc text, fixture strings. NOT identifiers: not a type name, an
 * exported symbol, an argument name or a filename.
 *
 * The tie-break exists because two people writing the same comment produce no
 * fact to appeal to, so the argument has to be settled by a rule rather than
 * by being right. An identifier has an external referent — a column, a table,
 * an entity — so there IS a fact, and a rule that ignores it can be wrong.
 *
 * It nearly was. Five identifiers were spelled one way here and the other way
 * upstream, and reaching for the tie-break would have taken the template's
 * spelling for all five. Four of them were not a difference of opinion at all:
 * the migration that folded the schema's classifiers onto `kind` renamed the
 * columns, and each repository followed it in some places and not others. The
 * tie-break would have imported a spelling the schema had retired.
 *
 * So an identifier is settled by what it names. Where the two disagree, one
 * side is behind on a rename, and the fix is to finish it.
 *
 * ── WHAT BELONGS ON THIS LIST ─────────────────────────────────────────────
 *
 * Application code. NOT the deployment's data, environment or branding — that
 * split is the one ADR 0013 fixes for the end state, applied early, and it is
 * recorded there under "What the reconciled set covers on the way there",
 * along with the three cases whose answer the file alone does not give:
 * build config enrols, branding does not even when it is identical, and a
 * migration never does however identical, because the two repositories share
 * no migration series.
 */
export const RECONCILED_FILES = [
  // The arrow-routing engine (#351): the same data-driven geometry in both
  // repos — anchor slots, confluence/fan-out, gap-first corridors, offset.
  // The renderers stay per-repo (uno's dependency vocab, asb's trigger vocab);
  // only these two pure files are held byte-identical.
  'src/lib/blueprintArrowGeometry.ts',
  'src/lib/arrowAnchorSlots.ts',
  // NOT enrolled: `blueprintArrowGeometry.sameColumnDetour.test.ts`. It was
  // held back by a bare issue number in its opening line, which means a
  // different ticket in each repository. That is fixed upstream now, and this
  // copy still carries `#450` — but the citation is no longer the thing
  // keeping the file off: the template's copy has since grown cases this one
  // does not have, so the two differ by well over a hundred lines of code.
  // What would take it off this note is a convergence ticket, not a comment
  // edit.

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

  // The ground a surface paints, and the tint that measures from it. Every
  // component below that paints its own surface spreads `ground(...)`, so the
  // helper and its callers have to say the same thing on both sides or a role
  // tint measures from a surface that is not underneath it.
  'src/lib/ground.ts',

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
  // `StakeholderSelect.test.tsx` was enrolled here and is not any more. This
  // deployment's `stakeholders` table has a `parent_id` the template's does
  // not, so the row type this fixture builds has a field the template's row
  // type has not, and no single file satisfies both compilers. It was green
  // only because the types file was missing the column too. It comes back when
  // the template's schema takes `parent_id` — one of the schema ports the
  // convergence already lists.
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
  'src/dev/arrowSituationCatalog.ts',
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
  // genuine fourth: #323 still owns half of it, and every lane rule here
  // states five cell state properties where the template's states seven.
  //
  // The `partner-action` half of that reason is spent. This note used to say
  // the file carried a lane role the template's schema had no value for; the
  // template took the role at 1.12.1, so what remains is the property count,
  // and that difference runs the other way. Nothing here reads
  // `--background-blueprint-cell-origin` or `--ring-blueprint-cell-soft`, and
  // two tests hold their absence — `palette.test.ts` requires exactly the five
  // on every block, and `blueprintDomainTokens.test.ts` refuses two properties
  // carrying one value. Whether the template keeps them is its own question.
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

  // asb 1.9.0 adopt. Three slices land at once, and each earns its files a
  // different way.
  //
  // #325 S2 declared the two fork seams. `referenceDocs.ts` holds where the
  // agent's reference documents resolve from and `storageNamespace.ts` holds
  // the localStorage prefix, so the files that used to carry those differences
  // no longer do. `placement.ts` had NOTHING else dividing it — one string —
  // which is why the seam was worth the two modules it cost. `sessions.ts` is
  // not here: it is one hunk away, a doc comment where each repo kept history
  // the other dropped, and neither is the superset.
  'src/lib/agent/placement.ts',
  'src/lib/agent/settings.ts',
  'src/lib/agent/settings.scope.test.ts',
  'src/lib/agent/tools/referenceNames.ts',
  'src/lib/mobilePathMemory.ts',

  // #358 S2-S4 reconciled the compare layout. `sideBySideCompareLayout.ts`
  // converged by SUBTRACTION — the template dropped
  // `COMPARE_HEADER_WRAP_EXTRA_INSET`, because the step-header row stays
  // outside the path frame. `blueprintLayout.ts` needed only the template's
  // wording: three of its comments named things only this deployment has.
  'src/lib/sideBySideCompareLayout.ts',
  'src/lib/blueprintLayout.ts',
  'src/components/blueprint/ResizableComparePanel.tsx',
  'src/components/blueprint/StackedCompareGrid.tsx',

  // #327 S2 converted the template's last style guard onto the token model.
  // These three came with it: the widening the conversion forced held their
  // radius, z-index and font-size call sites to rungs `theme.css` already
  // declared, and both copies came out the same.
  'src/components/editor/EditorLoadingSkeletons.tsx',
  'src/components/cover/coverInline.tsx',
  'src/components/editor/AgentMarkdown.tsx',

  // asb 1.10.0 adopt. Three slices again, and the shell is the one worth
  // naming.
  //
  // #327 S5 converged `EditorShell.tsx` — about nine hundred lines that had
  // been drifting since the fork. The template took our aside model, our #328
  // vocabulary, `shellContext.ts`, the second error boundary (#396 Q46), the
  // collapsed navbar's path selector and the owner-guarded collapse context;
  // the last thing between the two files was ONE COMMENT, our `?cell=`
  // deep-link note, which named uno-bot and pointed at a connector document
  // the template does not ship.
  'src/components/editor/EditorShell.tsx',
  'src/components/editor/EditorRail.tsx',
  'src/components/editor/SlideModeView.tsx',
  'src/components/editor/collapsedPathSelector.test.tsx',
  'src/components/editor/serviceBarSidebarResponse.test.tsx',
  'src/components/editorErrorBoundary.test.tsx',
  'src/contexts/sidebarCollapsedContext.ts',
  'src/lib/shellContext.ts',
  'src/lib/shellContext.test.ts',

  // #325 S4. The slice's headline — deleting our `canvas-adapter.md` override
  // — was REFUSED with measurements: the read rows still differ by two names,
  // and #431 records why that is a schema fork rather than a rename. These
  // four converged anyway. `sessions.ts` had been one hunk away since #208,
  // a comment where each repo kept half the reason for reading the session
  // store rather than the table; it now carries both, each stated without a
  // column name, because the schemas fork there.
  'src/lib/agent/attachments.ts',
  'src/lib/agent/providers/openai.ts',
  'src/lib/agent/role.md',
  'src/lib/agent/sessions.ts',

  // #327 S6 / #326 S6. The colour resolver is generic and the twenty-odd
  // names it used to hold are rows now (#425). Five comments stood between
  // the two copies, each naming something the template cannot have — two
  // migration stamps, an ADR number that is 0014 here and 0003 there, this
  // file's own path, and a gloss naming the service. Byte identity was
  // reached by rewriting those five on BOTH sides, not by copying one over
  // the other.
  'src/lib/touchpointColors.ts',
  'src/hooks/useTouchpointToneResolver.ts',

  // #325 S5, after the seed. `blueprintTechPictures.ts` held a table of nine
  // tool NAMES against nine asset paths, inside the renderer, where no author
  // could see it or set it. It is the template's file now, reading
  // `touchpoints.icon_url` through the placement — but only after
  // `20260906100000` put the six names that table actually matched into rows.
  // Deleting it first would have blanked a logo drawn today on 126 of 359
  // placements, which is why that migration applied before this merged.
  'src/lib/blueprintTechPictures.ts',
  'src/lib/orderedNamedRows.ts',

  // asb 1.11.0 adopt. #358 S6 and #324 S3+S4.
  //
  // The band and the merged grid were kept apart by less than their line counts
  // suggested: an import's position, a stray blank line an earlier move left
  // behind, and `cellTouchpoints(cell ?? {})` against
  // `cell ? cellTouchpoints(cell) : undefined`.
  'src/components/blueprint/BlueprintPathBand.tsx',
  'src/components/blueprint/MergedCompareGrid.tsx',

  // The placement editor's two controls, which the template gained with the
  // whole block — including three writers it had been carrying with NO CALLER
  // anywhere, reachable only by a revert. Byte identity cost three bare issue
  // numbers leaving our doc comments.
  'src/components/blueprint/RoleSelect.tsx',
  'src/components/blueprint/PlacementResourcesList.tsx',
  'src/lib/utils.ts',

  // asb 1.12.0 adopt. The deployment seam, and four files the pin bump made
  // free (BilLogic/agentic-service-blueprinting#214).
  //
  // The seam's CONTEXT is the template's file unchanged — `App` hands it a
  // config, the tree reads the resolved value by hook, and `useWorkspaceTitle`
  // throws outside the provider rather than returning an inert value. The two
  // editor tests upstream wrapped in the provider stay byte-identical because
  // of it.
  'src/contexts/DeploymentConfigContext.tsx',

  // The host half of the reference-doc seam. It imports nothing at all, which
  // is the whole of its contract: `referenceNames.ts` reads it, `specs.ts`
  // reads that, and the eval harness bundles `specs.ts` with no `?raw` loader.
  // Nothing in this repository registers a document — the seam belongs to a
  // host that mounts the package — but `referenceNames.ts` is byte-held and
  // cannot be without this file beside it.
  'src/lib/agent/tools/referenceRegistry.ts',

  // Free from the TEMPLATE's side. asb 1.12.0 took the write-failure notice
  // and its store wholesale — one of the four behaviours `App.tsx` records the
  // template as simply having been missing — and the canvas context menu came
  // with them, being the caller that reports a failed delete.
  'src/components/editor/WriteFailureNotices.tsx',
  'src/lib/writeFailures.ts',
  'src/components/editor/CanvasCellContextMenu.tsx',

  // Free from BOTH sides, and touched by neither for identity's sake. #438 and
  // #439 renamed a scenario's layout to `layout` and anchored the overview's
  // flow arrow on the phases actually loaded; the same two changes are in the
  // template, and these four came out identical on their own.
  'src/lib/mergeSlidesWithFallback.ts',
  'src/lib/scenarioLayout.ts',
  'src/lib/overviewFlowArrowAnchor.test.ts',
  'src/types/slideViewType.test.ts',

  // asb 1.12.1 adopt. The fork this repository declared at 1.12.0 was avoidable
  // and is gone (BilLogic/agentic-service-blueprinting#230).
  //
  // `deploymentConfig.ts` forked here for two literals: the wordmark and the
  // accent. The template inlined one and omitted the other, so changing them
  // meant forking the whole module. It now reads both through constants —
  // `brand.accent` from `BRAND`, `content.workspaceTitle` from
  // `coverContent.title` — and nothing repainted upstream, because that
  // repository's cover omits its title on purpose and its brand seam is
  // deliberately neutral, so both resolve to `undefined` and are dropped.
  //
  // The same file therefore says `'PLUS'`, `'#85ECD5'` and `'Uno Blueprint'`
  // here and the template's own values there, because the imports resolve
  // locally. The values fork; the module does not. `config.ts` is where a
  // deployment's values were always meant to live, and already holds
  // `ORG_NAME` for the same reason.
  //
  // `brandAccent.ts` came with it: the two copies differed only in how the
  // brand argument defaults, which a shared `Brand`/`BRAND` is what was
  // missing.
  'src/deploymentConfig.ts',
  'src/lib/brandAccent.ts',

  // asb 1.12.2 adopt. The read lifetime went upstream, and it took twelve files
  // with it (BilLogic/agentic-service-blueprinting#232).
  //
  // This was one unported feature wearing twelve small diffs. Every fetcher here
  // is `async (client, signal)` ending in `.abortSignal(signal)`, because
  // `useSupabaseQuery` hands it one; the template's could not, so about eighty
  // of the hundred-odd lines separating the two `src/hooks/` trees were this
  // single contract appearing once per file. Nothing converged file by file
  // because nothing could: a signal in one hook, with no wrapper supplying it,
  // changes nothing.
  //
  // The four contract files are the feature itself — the wrapper, the deadline
  // that aborts rather than races, the retry policy that keys off its error, and
  // `awaitOrAbort` for the shared lookups. The six hooks are what they unblock.
  'src/hooks/useSupabaseQuery.ts',
  'src/lib/supabaseFetchTimeout.ts',
  'src/lib/queryClient.ts',
  'src/lib/service.ts',
  'src/hooks/useEvidence.ts',
  'src/hooks/usePhaseSpec.ts',
  'src/hooks/useScenarioSpec.ts',
  'src/hooks/useStepSpec.ts',
  'src/hooks/useScenarioPaths.ts',
  'src/hooks/useSliceScenarioId.ts',

  // The two tests came with them. `readLifetime.test.ts` was enrolled knowing
  // its `query cancellation` block did not test our cancellation — it drove a
  // raw `QueryObserver` and so passed with or without the signal (#468).
  // Enrolling it is what made that fixable ONCE: the block is gone upstream and
  // its coverage moved to `useSupabaseQuery.test.tsx`, which drives the wrapper
  // and fails when the signal is taken away. This repository took both at asb
  // 1.12.3 rather than being repaired twice.
  'src/lib/readLifetime.test.ts',
  'src/lib/service.test.ts',
  'src/hooks/useSupabaseQuery.test.tsx',

  // The prose that was this deployment's, generalised. Three of these hooks
  // illustrated their arguments in this deployment's vocabulary — a team name,
  // a lane name, this deployment's bot and channel and a `docs/connectors/`
  // path — where the template's copies say the same thing in neutral words.
  // Nothing here is wrong; it is unshareable, because `check:standalone`
  // upstream refuses prose that names a deployment, so a file carrying it can
  // never be byte-identical. This is the one class where the template is ahead
  // and this repository comes to it.
  //
  // `useStakeholders.ts` joins them at asb 1.12.3. It had the same vocabulary
  // swaps AND cited the shared-catalog decision as `ADR 0014` where the
  // template cited `ADR 0003` — the same decision, numbered per repository, so
  // no single line could be right in both copies. The citation now names the
  // decision instead of numbering it, which is the rule for every ADR citation
  // that reaches a shared file; ADR 0014 records it where a reader chasing the
  // citation lands (#457).
  'src/hooks/useOwnerTags.ts',
  'src/hooks/useLaneSpec.ts',
  'src/hooks/useCellDeepLink.ts',
  'src/hooks/useStakeholders.ts',

  // Prose-only differences, resolved by the tie-break the convergence review
  // settled: where two copies differ ONLY in the words of a comment, the
  // template's sentence wins. Not a judgement per file — a rule, so that a
  // dozen files do not become a dozen small arguments about whose comment
  // reads better. Every one of these was code-identical once comments were
  // stripped; `measure-template-divergence.mjs --enrollable` is what found
  // them.
  //
  // Two candidates were deliberately NOT taken, and the reasons are the
  // tie-break's own exceptions. `touchpointMutations.ts` is not a wording
  // difference at all: the two comments state different FACTS about the same
  // code ("the four detail columns" here, "the two" upstream — and upstream is
  // right, this repo's own test asserts two), and taking it would also revert
  // the registry/catalog rename this repo made. `blueprintStoryboardPlaceholder.ts`
  // is the materially-better case: this repo's copy warns that the asset
  // filename keeps a retired word because it is a VALUE written into applied
  // migrations, so renaming the file would turn every placeholder on the board
  // into a real frame. The template's one-line version has no such warning.
  // That sentence goes UP as its own change; it does not get overwritten here.
  'src/components/blueprint/BlueprintColumnHandles.tsx',
  'src/components/blueprint/DefinitionCard.tsx',
  'src/components/blueprint/EntityDefinitionPopover.tsx',
  'src/components/blueprint/StakeholderSelect.tsx',
  'src/components/editor/SliceHeaderBand.tsx',
  'src/contexts/cellPickContext.ts',
  'src/lib/blueprintCellStyle.ts',
  'src/lib/canvasCellQuery.ts',
  'src/lib/filterToolbarButton.ts',
  'src/lib/openCellStore.ts',
  'src/lib/serviceRoute.ts',
  'src/lib/touchpointRole.ts',

  // ── A citation blocks a file, from either side ──
  //
  // These were code-identical with the template all along and blocked on prose
  // alone: each carried an issue number, an ADR number, a migration filename
  // or a plan slug on one side or the other, and enrolling one would have
  // enrolled a citation the check forbids. Clearing the citation is what takes
  // a file off this blocked list — and it can be cleared on either side, which
  // is why some of these waited on the template rather than on anything here.
  //
  // `canvasHeaderStyle.ts` is the one worth reading, because it shows what
  // clearing a citation costs and does not cost. Its comment told the ⓘ mark's
  // history as a sequence of three ticket numbers, which named nothing to a
  // reader in the other repository; it now tells the same three steps by what
  // each one did — always-on, then removed as clutter, then returned for the
  // reader who cannot hover. The history survived the citations.
  'scripts/always-loaded.mjs',
  'src/components/blueprint/ServicePanel.test.tsx',
  'src/components/editor/SliceView.tsx',
  'src/components/mobile/MobileTopBar.tsx',
  'src/contexts/activeServiceStore.ts',
  'src/hooks/useRegistryTouchpoints.ts',
  'src/lib/agent/tools/serviceScope.test.ts',
  'src/lib/agent/tools/serviceScope.ts',
  'src/lib/attachmentUpload.ts',
  'src/lib/canvasHeaderStyle.ts',
  'src/lib/placementLinkMutations.ts',
  'src/lib/placementResourceMutations.ts',
  'src/lib/resourcePresentation.ts',
  'src/lib/serviceSlug.ts',

  // ── A fixture's noun is arbitrary; an identity file's noun is the answer ──
  //
  // The FIXTURES named the deployment where the template's copies name nobody:
  // `PLUS App`, `Warm-Up` and `warm-up` as a resource name, a slide title and a
  // slide id. The code under test was identical and nothing asserts on the
  // vocabulary — these strings have to be some word, and the template's word is
  // the neutral one.
  //
  // This is not the same judgement as an identity file. `index.html`,
  // `supabase/config.toml` and `docs/agents/issue-tracker.md` also differ from
  // the template by a deployment noun alone, and they are RIGHT to: the browser
  // tab's title, the Supabase project id and the repository the issue queue
  // lives in are this deployment's answers. A fixture's noun is arbitrary; an
  // identity file's noun is the answer, and a scan for the noun cannot tell
  // them apart.
  //
  // Three of these were blocked prose holdouts and are not blocked any more,
  // which is the citation rule running in both directions.
  // `blueprintStoryboardPlaceholder.ts` was held back because this repo's copy
  // carried the warning that the asset filename is a VALUE in applied
  // migrations and the template's did not: the sentence went upstream, and the
  // file followed. `stakeholderMutations.ts` and `touchpointMutations.ts` were
  // held back from the other side, by an ADR number and two migration
  // filenames in the template's own copies.
  //
  // Neither is an exception any more, so nothing here should read as though
  // one is. A note saying a file is held back is worth keeping only while it
  // would still stop somebody enrolling it.
  //
  // `cssCascadeLayerContract.test.ts` is not a convergence — this repo did not
  // have it. A browser drops an unknown at-rule together with its whole block,
  // in silence, and a repo-wide rename of a domain word once rewrote `@layer`
  // to `@lane` in eight places upstream with every downstream test still
  // green. Enrolled rather than copied, so the guard cannot drift from the one
  // the accident taught.
  'src/components/blueprint/featuredResources.test.tsx',
  'src/components/mobile/mobileTopBar.test.tsx',
  'src/lib/compareReviewStore.test.ts',
  'src/lib/placementResourceMutations.test.ts',
  'src/lib/resourcePresentation.test.ts',
  'src/lib/blueprintStoryboardPlaceholder.ts',
  'src/lib/stakeholderMutations.ts',
  'src/lib/touchpointMutations.ts',
  'src/lib/cssCascadeLayerContract.test.ts',

  // ── Where two copies differ only in wording, the template's wording wins ──
  //
  // The template's copies of seventeen files stopped inlining
  // `x instanceof Error ? x.message : String(x)` and started calling the
  // `errorMessage` helper both repositories already export. One of them —
  // `DeleteStructureDialog.tsx` — had no other difference and is byte-identical
  // now. The other two took the template's wording under the tie-break, and
  // both times the template was simply right: `CreatePhaseDialog.tsx` said
  // "description" for a field that writes `phases.summary`, and
  // `SliceSlideComposer.tsx` said "in the same slide" where the sentence is
  // about an animation frame — a rename that ran through prose it did not
  // belong in.
  'src/components/editor/CreatePhaseDialog.tsx',
  'src/components/editor/DeleteStructureDialog.tsx',
  'src/components/editor/SliceSlideComposer.tsx',

  // ── The build's own configuration ──
  //
  // Not a convergence: these three have been byte-identical the whole time and
  // simply sat outside the gate. They are code rather than environment —
  // environment is the VALUES a build reads, which live in env, not the build
  // that reads them — so the split ADR 0013 fixes puts them here.
  //
  // `vite.config.ts` is the one that reads as a deployment file and is not.
  // Enrolling it is the point: this deployment may not edit the template's
  // code, so a build difference has to arrive as a seam the template offers,
  // and the gate is what forces that conversation instead of letting a quiet
  // local edit stand in for it.
  'eslint.config.js',
  'tsconfig.node.json',
  'vite.config.ts',

  // ── One classifier word, one file ──
  //
  // The template folded `slice_type` into `kind` some releases ago and this
  // deployment did not, so the same file was `sliceType.ts` on one side and
  // `sliceKind.ts` on the other and the two could never be compared. Renaming
  // the symbols here left the file byte-identical to the template's, which is
  // the whole argument for enrolling it: the difference was the spelling of a
  // classifier, never behaviour.
  'src/lib/sliceKind.ts',

  // ── The same classifier, one table over ──
  //
  // `paths.path_type` became `paths.kind` and the generated type followed; two
  // constants did not. The roster the create-version dialog renders its Kind
  // picker from still said TYPES, and so did the arrow file's own copy of that
  // roster, along with the three names hanging off it. Renaming them is the
  // whole of the arrow file's difference from the template's copy. The dialog
  // also had its `errorMessage` import a line below where the template keeps
  // it — nothing at all, until it is the last thing standing between two files
  // that are otherwise the same.
  //
  // The arrow roster also held five entries for three kinds, `exception` and
  // `variant` each twice, left behind when the retired kinds were rewritten
  // onto kinds already listed. `Object.fromEntries` absorbs a repeat, so
  // nothing rendered wrong and nothing was in a position to notice. An array is
  // the one shape of this vocabulary that no `Record<PathKind, …>` is guarding;
  // the gate is what guards it now.
  'src/components/blueprint/BlueprintArrowMarkerDefs.tsx',
  'src/components/editor/CreateVersionDialog.tsx',

  // ── The rule that would have caught the duplicate, once it stopped naming
  //    an address ──
  //
  // The template has always held that roster to one entry per member. The file
  // could not be adopted, because its header cited the migration that folded
  // the retired kinds — a filename in one repository and nothing in the next,
  // which is exactly the second promise this list makes. It now states the
  // CHECK constraint and that `variant` is a fold destination, and hands the
  // history to the rename map, which is read against the migrations that ran
  // HERE. That matters more than it sounds: `unhappy` became `exception` in
  // this database and `variant` in the template's, so WHICH spelling went
  // where is not a fact these two files can share.
  'src/lib/pathKindContract.test.ts',

  // ── Eleven that matched, or matched but for a comment (#522) ──
  //
  // Measured at the 1.13.0 pin: 925 in-scope paths, 561 of them shared with
  // the template, and 346 of those byte-identical against 338 enrolled. The
  // gap is the whole of this entry. A file that HAPPENS to match and a file
  // that is HELD to match read the same on any given day and behave nothing
  // alike on the day one side moves — the second fails a build, the first
  // parts company in silence. Eight of the eleven needed no edit at all;
  // three needed one comment each.
  //
  // 338 rather than the 339 the checker prints, because
  // `public/step-visual-placeholder.svg` is enrolled and `public/` is outside
  // what the divergence measurement scopes. The two numbers count different
  // things and are one apart for that reason alone.
  //
  // The eight are the image viewer and one panel footer, and they are
  // identical because the template took them FROM here rather than the other
  // way round. `ZoomableImage`, `useImageZoom`, `imageZoomReducer` and their
  // tests went upstream whole, along with `CoverFigure`, the first adopter
  // that motivated them, and the cell panel's "loading is not no matches"
  // fix went with them. Convergence normally costs an edit on this side;
  // this is the case where it cost one on that side, and enrolling is what
  // stops the two copies parting again now that both repositories have one.
  'src/components/blueprint/CellInSlicesFooter.tsx',
  'src/components/blueprint/ZoomableImage.tsx',
  'src/components/blueprint/zoomableImage.test.tsx',
  'src/components/cover/CoverFigure.tsx',
  'src/components/cover/coverFigure.test.tsx',
  'src/hooks/useImageZoom.ts',
  'src/lib/imageZoomReducer.ts',
  'src/lib/imageZoomReducer.test.ts',

  // The three that took the template's sentence, each one comment apart.
  //
  // `MobileNavSheet.tsx` named the plan and the phase the drawer was decided
  // in. That was an address in this repository's plans tree, since retired,
  // and nothing at all in the template's; the template's wording already
  // omits it, so there was no meaning to weigh against the tie-break.
  //
  // `findingFingerprint.ts` cited a section number of the audit playbook.
  // The template names the rule instead — the audit playbook's fingerprint
  // rule — which is the form this list asks for and survives the day someone
  // adds a section.
  //
  // `AnnotationCaptureMenu.tsx` did not need the tie-break, and it is worth
  // saying so rather than resting on it. Its comments called the annotation
  // overlay a "lane" — residue of the mechanical rename that turned `layers`
  // into `lanes`, which is about blueprint ROWS and not about z-order. The
  // code directly under the comment never moved: it is still `layerElement`,
  // still querying `[data-canvas-annotation-layer]`, and `useImageZoom.ts` in
  // the block above says "an annotation layer" in a file both repositories
  // already share. So the template's wording is also the true one.
  //
  // `a-rename-leaves-no-mangled-english.test.mjs` is the guard for that
  // family and could not have caught this one. It registers only residue that
  // is impossible as English — the substituted word wedged inside a longer
  // word, or standing where the design-token tier was meant — because that is
  // what lets its subject be the whole tree with no exemption for ordinary
  // prose. A scratch one and an annotation one are both perfectly possible
  // English phrases about the wrong thing, so nothing was in a position to
  // flag them. Holding the file to the template's copy is what catches the
  // residue that guard is deliberately blind to. (Its patterns match this
  // paragraph too, which is why the shapes are described here and not
  // spelled.)
  'src/components/editor/AnnotationCaptureMenu.tsx',
  'src/components/mobile/MobileNavSheet.tsx',
  'src/lib/findingFingerprint.ts',

  // Enrolled by #220. The one difference that was not prose: the template
  // rendered a dependency why-line backed by `linkNote`, and this deployment
  // had no column to put behind it. `cell_dependencies.note` closes that, so
  // the two copies say the same thing again. The remaining differences were
  // import order and one comment citing a local plan document where the
  // template's says the same thing without an address.

  'src/lib/blueprintCellConnections.ts',

  // The same change's test, arriving byte-identical. It exercises the panel
  // through its props and asserts the three readers who have no hover — a
  // keyboard, a touch screen, a screen reader — so it holds in either
  // repository even though the panel around it is a fork here.
  'src/components/blueprint/cellDependencyWhyLine.test.tsx',

  // Enrolled at the 1.13.2 pin, and each was won upstream rather than here.
  //
  // `sliceValidation.ts` carried the last of the three citations #307
  // measured: a comment explaining that `slices.authorship` was renamed from
  // `origin`, naming the migration that did it. Both halves are true in both
  // repositories and only the filename was unportable, so the sentence went
  // upstream stated without one — pointing at the rename map, which is where
  // a reader goes for the history — and this copy takes it verbatim.
  //
  // `cellSpecMutations.ts` and `optimisticConcurrency.ts` were the template
  // raising `new Error(error.message)` where this deployment translates. Both
  // now translate, so a refused write is phrased for a person whichever
  // module raised it, and the database's own text stays on `.raw` for the
  // console. The second was a stated position upstream rather than drift —
  // the error was left to the caller "which knows whether it wants
  // `toAuthoringError`" — and it was settled by its owner, not by whichever
  // side was edited last.

  'src/lib/sliceValidation.ts',
  'src/lib/cellSpecMutations.ts',
  'src/lib/optimisticConcurrency.ts',

  // DECLINED by #522. One judgement that still stands.
  //
  // `src/components/blueprint/pathPickerColumns.test.ts` — declined a second
  //   time, after re-reading the sentence rather than the earlier decision.
  //   The remaining difference is the paragraph describing the defect the
  //   test was written against, and the two repositories had different
  //   defects. Here the two `Set`s were disjoint and each held a repeated
  //   member — `variant` twice in the primary, `exception` twice in the
  //   secondary — so every path was drawn exactly once and what was wrong
  //   was the structure alone. Upstream one kind sat in BOTH sets and its
  //   paths were drawn twice, once per column. The template's sentence says
  //   the second thing, and adopting it would put a false account of a fixed
  //   bug in this tree to buy a line on this list. A comment that is wrong
  //   about what happened costs more than a file that is merely unheld.

  // ── The derivation layer, and the primitives under it ──
  //
  // `semantic.css` is where a role's colour is DERIVED from a handful of
  // dials, and a derivation is not a place a deployment has an opinion: the
  // dials are ours, the arithmetic over them is not. Its copy here is now the
  // template's, byte for byte. Six differences stood between the two and five
  // were wording — a test named rather than filed, a parenthetical carrying
  // this deployment's `--surface-hue` values, a ring comment naming a token
  // that exists on one side only, and a census ("forty-four times, in eleven
  // spellings") that counts differently in each repository.
  //
  // The sixth was the `--primary` retune log: dates, a measurement table and a
  // narrative of walked-back tuning passes, every number of it true here and
  // false upstream, and citing two issue numbers besides. It was not deletable
  // reasoning, it was misplaced reasoning — documentation wearing a comment's
  // clothes — and it now lives in `docs/guidelines/foundations/color.md`,
  // where a reader looking for why the fill is this teal will look. The theme
  // files carry the pointer, because that is where a retune lands.
  //
  // Two values moved with the adoption. `--primary-foreground` takes the hard
  // flip, which replaces an ink that is correct only while the accent stays
  // light; and `--brand-foreground`, which this copy still derived at the
  // blueprint cell's clamp bounds, takes the brand pair's. Both stay past AAA
  // on their own fill. Every other custom property under `src/styles`
  // resolves to the same string in both themes.
  //
  // `src/styles/semantic.css` is enrolled here rather than declined, which is
  // the append that paragraph promised. The template's copy said "Sidebar
  // selection language (nav plan D8)" — D8 a row of this repository's
  // sidebar-navigation-model plan, an address in a docs tree that travelled
  // upstream with the port and resolved to nothing there (and that has since
  // been retired here too). Byte-identity and this list's second
  // promise could not both be kept while the shared text carried it. The
  // sentence now states the decision instead of its plan row, and 1.13.2
  // carries that, so the file that was already identical is finally held.
  //
  // `colors.css` had a smaller story and no such blocker: nothing but prose
  // separated the two copies, and the one number in it was ours and wrong —
  // this copy said the palette it declines to duplicate for print is 216
  // values, which it was before the brand family was removed from it. It is
  // 204 in both files, which is what the template's copy already said.
  'src/styles/colors.css',
  'src/styles/semantic.css',

  // Three files the template ships that this copy already matched byte for
  // byte, found by re-scanning the whole adoption surface rather than the
  // narrow prose-only band. Nothing converged them on purpose — the noun
  // sweep and the cover work moved the last differing lines out from under
  // them — so they are bookkeeping, not code, and they are held here now so
  // the next edit to either copy has to answer for the drift.
  //
  // A fourth, `src/components/cover/coverPage.test.tsx`, took two rounds: the
  // `plan 2026-08-18-001` citation went first, then the `docs/guide/02-x.md`
  // it used as a fixture `docPath` — a file that exists in NEITHER repository,
  // which is right for a fixture and misleading as text, since a `docs/` path
  // reads as somewhere you could go and look. It is `guide/section.md` now,
  // and enrolled below.
  'src/components/blueprint/StoryboardStepDetailStack.tsx',
  'src/components/cover/CoverSections.tsx',
  'src/components/editor/CanvasEmptyState.tsx',

  // Two test files that differed by nothing the code under test can see: a
  // deployment's service name standing in for a neutral one in the slug
  // fixtures, this repository's issue numbers in their headers, and one pair
  // of copies that named the same thing "command" and "control". The
  // template's wording is the tie-break for prose, so both take it whole.
  'src/components/cover/coverCommandCopy.test.tsx',
  'src/lib/serviceSlug.test.ts',

  // The 1.14.0 bump's harvest, in three groups.
  //
  // The cover's services tab went upstream whole, so its four files are held
  // here rather than forked: the type layer that splits a tab into a content
  // tab and a services tab, the page that renders it, the selector, and the
  // test.
  //
  // Two more are identical and deliberately NOT here, both held out by the
  // second promise rather than the first. `coverPage.test.tsx` cites a plan
  // row in this repository's docs tree, and `coverModel.ts` gives
  // `docs/guide/01-the-blueprint-model.md` as the example a `docPath` looks
  // like — a file the template has and this repository does not. Both
  // sentences are byte-identical in the two copies, so neither can be fixed
  // on one side alone; they enrol when the shared line changes upstream.
  //
  // `AgentDock`, `CanvasModeProvider`, `canvasModeContext`, `badge` and
  // `skeleton` came back the other way: this copy was already right and the
  // template adopted it. Three of them were defects there — a second set of
  // window-global listeners on a hidden dock, a canvas mode the agent tool
  // could set without write access, and a skeleton running two animations at
  // once.
  //
  // `CreateSliceSheet` was two comments away all along, and both were the
  // template's: a rename there had turned "on screen" into "on slide" in two
  // sentences that are not about slides.
  'src/components/cover/CoverPage.tsx',
  'src/components/cover/CoverServicesSelector.tsx',
  'src/components/cover/coverServicesTab.test.tsx',
  'src/components/editor/AgentDock.tsx',
  'src/components/editor/CanvasModeProvider.tsx',
  'src/components/editor/CreateSliceSheet.tsx',
  'src/components/ui/badge.tsx',
  'src/components/ui/skeleton.tsx',
  'src/contexts/canvasModeContext.ts',

  // The 1.15.0 bump. One list, two owners, in both repositories.
  //
  // The cell's Resources tab used to carry a second and poorer list of its
  // own — a label field and a URL field per row, no featured block, no row
  // menu, no order. Giving it the list the placement's group already had moved
  // that list out of `PlacementResourcesList` and into `ResourcesList`, which
  // both owners hand rows and a pair of writes. 1.15.0 makes the same move
  // upstream, so the shared file is one file in two repositories and is held
  // here from the day it lands rather than after the drift is noticed.
  //
  // `rowReveal.ts` comes with it and is the smaller half of the same idea: the
  // rule that a row's secondary control waits for a reader is stated once and
  // imported by both the resource list and the dependency why-line, instead of
  // a class list copied into two folders. It arrived byte-identical.
  'src/components/blueprint/ResourcesList.tsx',
  'src/lib/rowReveal.ts',

  // `linkedText.ts` was byte-identical to the template's copy on every line but
  // one, and that line was a citation: each repository's comment named its OWN
  // migration for the change that retired `evidence.ref`. Two copies that
  // agreed on everything a reader cares about were kept apart by a number
  // neither reader needs, and the citation rule would have refused the file
  // even if they had matched. Both sides dropped the address; the sentence
  // that explains what the column was for is untouched.
  'src/lib/linkedText.ts',

  // `sessionReconcile.ts` and its test travelled UPSTREAM first: the template
  // took the refused-write signal, and its copy re-asks the database on the
  // refreshed token where this deployment only re-reads a claim. What kept the
  // two copies apart afterwards was entirely comment — an issue number, and
  // sentences naming `app_metadata.role` and `auth.jwt()` that are true here
  // and not upstream. The template's wording is true in both, so it wins by
  // the standing tie-break and the code never moved.
  'src/lib/sessionReconcile.ts',
  'src/lib/sessionReconcile.test.ts',

  // Five files whose ENTIRE difference from the template was comment. Not
  // one line of code separated any of them, which is what makes them a group
  // rather than five coincidences: the same cause, a comment edited on one
  // side and never on the other, and no design question underneath.
  //
  // Three of the five had drifted into saying something untrue here.
  // `useServicePhases.ts` named `findFirstServiceId` as the lookup it shares
  // a cache with, while the code calls `findActiveServiceId` — the template's
  // line is simply the correct one. `phasesToSlides.ts` described a
  // `description` prop that no longer exists under that name and pointed at a
  // module that has since been deleted. `ScenarioTitleDefinition.tsx` carried
  // the history of the component it replaced, told through three issue
  // numbers; the template says what the component IS.
  //
  // `SlideStickyHeader.tsx` went the other way first. The one thing this
  // deployment's copy said that the template's did not — why the navbar is
  // flush left — was true of both, so it was ported upstream in 1.20.1 and
  // adopted back with the pin.
  'src/components/blueprint/ScenarioSlideHeader.tsx',
  'src/components/blueprint/ScenarioTitleDefinition.tsx',
  'src/components/editor/SlideStickyHeader.tsx',
  'src/hooks/useServicePhases.ts',
  'src/lib/phasesToSlides.ts',

  // The badge-size guard and the last file it was holding apart.
  //
  // This deployment wrote `one-badge-one-size.test.mjs` and the template did
  // not have it, so seven call sites there were still choosing a badge's
  // geometry themselves — three shapes, two of them below every size
  // `ui/badge.tsx` offers. The guard went upstream citation-free and the seven
  // overrides went with it, which is why the file can be held here at all: the
  // version this deployment wrote named two issue numbers, and a rule about
  // call sites does not need an address to be true.
  //
  // `SlideArtboard.tsx` fell out of that sweep. Its whole difference was one
  // `text-3xs` the template had and this deployment had already removed.
  'scripts/tests/one-badge-one-size.test.mjs',
  'src/components/editor/SlideArtboard.tsx',

  // Four more, each its own small reason, none of them a design question.
  //
  // `StoryboardWalkthroughModal.tsx` and `StructureRowMenu.tsx` were fixed
  // here first and the template had the older text: a dialog whose accessible
  // name said "Presentation" — the ONLY name a screen reader had for it, and
  // a word the app uses nowhere a reader can see — and one failure unwrapped
  // by an inline `instanceof Error` ternary next to an import of the helper
  // that IS that expression. Both went upstream, so both files are one file.
  //
  // `blueprintStepTech.ts` differed by the ORDER of two imports and nothing
  // else. `serviceSpecMutations.test.ts` differed by a fixture noun, which is
  // the case the fixture-versus-identity rule settles: a client's name in an
  // example string is not this deployment's identity, and the template's
  // neutral wording is true in both.
  'src/components/blueprint/StoryboardWalkthroughModal.tsx',
  'src/components/editor/StructureRowMenu.tsx',
  'src/lib/blueprintStepTech.ts',
  'src/lib/serviceSpecMutations.test.ts',

  // Two fixes this deployment made and the template did not have. Neither
  // needed a line changed here to converge; both needed the template to catch
  // up, which 1.23.0 did.
  //
  // `button.tsx` is the inset selection ring. A ring with spread rounds at the
  // element's radius PLUS the spread, so a selected cell was 2px larger with a
  // 12px outer corner where hover had 10px — the radius never moved, the
  // outline around it did, and a reader sees the corner change. The ring is
  // also 2 CSS px in BOARD space, so the camera scales it down to about a
  // device pixel at a working zoom. Inset fixes both.
  //
  // `ThemeToggle.tsx` had two positioning mechanisms doing one job: an
  // absolutely positioned resident glyph inside a `relative` box, while
  // `popLayout` was already holding the outgoing glyph's box.
  'src/components/ui/button.tsx',
  'src/components/editor/ThemeToggle.tsx',

  // Twenty contracts this deployment wrote against shared code, now held in
  // both repositories.
  //
  // They were about to be counted as a COST of #332 — tests that would be
  // deleted when this deployment stops keeping its own copy of the
  // application. They were never a cost; they were coverage the template had
  // not received. All 43 deployment-only test files were classified by
  // whether every module they import exists upstream (38 did), those 38 were
  // run against the template's tree unmodified, and 22 passed. Two were
  // dropped for a `links` field the template's `BlueprintCell` does not
  // carry. The twenty that remain landed upstream in 1.24.0.
  //
  // The SIXTEEN that failed are the more useful half and are not here: a
  // contract written against shared code that fails upstream measures real
  // divergence, and each is now a named, executable question for #493.
  //
  // Six of the twenty named this deployment — a fixture, a slug, a comment
  // naming the bot that builds a cell link — and one comment called a boot
  // signal a lane. The template's copies neutralise all of it, which is what
  // its standalone guard is for, and those copies are what is held here.
  'src/components/blueprint/cellResourcesTab.test.tsx',
  'src/components/blueprint/placementResourcesList.test.tsx',
  'src/components/blueprint/stakeholderDefinitionReader.test.ts',
  'src/components/editor/pathSelectorMenu.test.tsx',
  'src/contexts/activeServiceStore.test.ts',
  'src/contexts/canvasModeContext.test.ts',
  'src/lib/activeService.test.ts',
  'src/lib/agent/uiCommands.test.ts',
  'src/lib/annotationChromeInk.test.ts',
  'src/lib/annotationSwatchContrast.test.ts',
  'src/lib/blueprintDisplayFlags.test.ts',
  'src/lib/blueprintDomainTokens.test.ts',
  'src/lib/blueprintLayout.test.ts',
  'src/lib/canvasFocus.test.ts',
  'src/lib/customerBandRail.test.ts',
  'src/lib/placementGateContract.test.ts',
  'src/lib/scenarioLayout.test.ts',
  'src/lib/serviceRoute.test.ts',
  'src/lib/tokenResolution.test.ts',
  'src/lib/workspaceTabNavigationContract.test.ts',

  // The first of the sixteen contracts that failed against the template, worked
  // through and found portable. It failed there for the simplest possible
  // reason: `CELL_DETAIL_PANEL_BOTTOM_GAP_PX` did not exist upstream, only the
  // `!bottom-[61px]` literal it is supposed to agree with. Naming the gap is
  // what makes the contract checkable, so the name went upstream and the
  // contract followed.
  //
  // Three of its neighbours were investigated at the same time and are NOT
  // portable: `authoringErrors` asserts a message keyed on a constraint no
  // migration upstream creates, `canvasNestedHoverContract` asserts a CSS rule
  // where the template does the same dim as inline Tailwind on the camera's
  // own duration, and `findingMutations` expects a field the template's write
  // does not carry.
  'src/lib/panelLayoutContract.test.ts',

  // The last of the plan citations, and one file that was only ever a citation
  // away.
  //
  // Retiring the plan tier deleted the documents; six comments in `src/` went
  // on citing them, which is a worse state than before — a reader following
  // `plan 2026-08-16-002` now finds nothing at all rather than a stale file.
  // Each of the six says what it pins; only the address went.
  //
  // `coverPage.test.tsx` carried one of them, and so did the template's copy —
  // an address in THIS repository's docs tree that never resolved upstream
  // even while the tier existed. Rewritten in both; it still cannot enrol,
  // because the same file cites `docs/guide/02-x.md` twice.
  //
  // `FeaturedResources.tsx` differed by a citation and one JSX line the
  // template wraps differently. Adopted whole, and enrolled.
  'src/components/blueprint/FeaturedResources.tsx',

  // The panel title stopped dropping the scenario's note, and the cover
  // fixture stopped naming a docs path.
  //
  // `ScenarioBlueprintPanel.tsx` passed `panelTitleInfoTooltip: null` upstream
  // under a comment saying the template had nowhere to store a per-scenario
  // aside. It has had somewhere since `scenarios.note` shipped — `NavItem.note`
  // declares it and `phasesToSlides` fills it — so the panel title was the one
  // surface that dropped a note a reader had written. Fixed upstream in 1.25.0,
  // which is also what makes the file holdable here.
  'src/components/blueprint/ScenarioBlueprintPanel.tsx',
  'src/components/cover/coverPage.test.tsx',

  // The touchpoint cell hears the registry.
  //
  // Upstream this file called `getTouchpointTone` directly — a module store,
  // invisible to React, which is the exact failure `useTouchpointToneResolver`
  // was written to prevent and says so in its own comment: a cell that called
  // it directly would draw whatever the store held at its first render and
  // never hear that the rows had landed. Every other surface that draws a
  // touchpoint already took the hook; that call site never switched. Fixed
  // here first, ported in 1.25.1, and the `#277` the local copy carried went
  // with it.
  'src/components/blueprint/BlueprintTouchpointCell.tsx',

  // Fourteen contracts the TEMPLATE wrote and this deployment never had.
  //
  // The mirror of the twenty that went the other way. The template holds 34
  // test files this tree does not; 29 import only modules this tree has;
  // those 29 ran here unmodified and 17 passed. Two of the seventeen turned
  // out to import relative modules this tree lacks, and one carries an issue
  // citation that has to leave BOTH copies before it can be held — it is
  // `src/lib/blueprintTechPictures.test.ts`, and it waits for that.
  //
  // The twelve that FAILED are not here and are the useful half: a contract
  // the template wrote against shared code, failing here, is a measurement of
  // divergence with this side's name on it.
  //
  // `blueprintTechPictures.test.ts` was the fifteenth. It passed unmodified
  // and waited one round for the `#326` in the TEMPLATE's copy to go (1.25.2),
  // because a citation has to leave both copies before either can promise it.
  'src/components/blueprint/resourcesList.test.tsx',
  'src/contexts/PathSelectionContext.test.tsx',
  'src/contexts/canvasActiveContext.test.tsx',
  'src/contexts/viewStateStore.test.ts',
  'src/hooks/useStepSpec.test.ts',
  'src/lib/agent/skills.test.ts',
  'src/lib/agent/tools/surfacePartition.test.ts',
  'src/lib/canvasCellQuery.test.ts',
  'src/lib/canvasFocusCells.test.ts',
  'src/lib/customerBand.test.ts',
  'src/lib/findingFingerprint.test.ts',
  'src/lib/queryClient.test.ts',
  'src/lib/writeTranslationContract.test.ts',
  'src/styles/theme.shape.test.ts',
  'src/lib/blueprintTechPictures.test.ts',
  // Fifteen files the emptied fallback registry set free.
  //
  // Fifty TypeScript files here carried this deployment's board, and every
  // seam that read them had to keep a second shape alive beside the rows: a
  // `links` array, a label lookup that matched a touchpoint by its spelling,
  // a resource list minted from the `url` entries of the same array, an
  // offline touchpoint colour table, an offline slice. The template retired
  // all of it when its content became rows. This tree could not follow while
  // it still had fixtures to serve, so its copies of those files diverged by
  // exactly the fallback half — which is why they converge the moment the
  // fixtures go, without anyone editing them to agree.
  //
  // `canvasActiveContext.tsx` and `coverModel.ts` are byte-identical too and
  // are NOT here: one cites ADR 0010 and the other a `docs/` path, and an
  // address in one repository has to leave both copies before either can
  // promise to keep it.
  'src/contexts/TouchpointRegistryProvider.tsx',
  'src/hooks/useSlice.ts',
  'src/hooks/useSlices.ts',
  'src/hooks/useTouchpointRegistryTones.ts',
  'src/lib/cellTouchpoints.ts',
  'src/lib/cellTouchpoints.test.ts',
  'src/lib/cellResources.ts',
  'src/lib/touchpointColors.test.ts',
  'src/lib/blueprintCellSelection.nameOnly.test.ts',
  'src/lib/canvasNavigationOutcome.test.ts',
  'src/lib/canvasViewState.ts',
  'src/lib/canvasViewState.test.ts',
  'src/lib/linkedText.test.ts',
  'src/components/mobile/MobileScenarioTransition.tsx',
  'src/components/mobile/MobileScenarioTransition.test.tsx',

  // The hook that went the other way.
  //
  // `useBlueprintCell` was written here, to replace `useCellSpec` and
  // `useCellContent` — two per-cell queries on panel open for columns the
  // board can carry. The template kept both and said so in a comment on its
  // own status helper, which named this deployment as having gone the other
  // way outright. It has followed now (1.26.0), so the file is one file
  // again.
  'src/hooks/useBlueprintCell.ts',

  // The service switcher, and the strip it sits in.
  //
  // The top-strip workspace name became a dropdown over the service roster
  // here, and stayed a plain tab wherever a deployment has one service. The
  // template held the plain tab inline in `TabStrip`, so that file's whole
  // divergence from this one was the switcher — and it converges the moment
  // the template mounts it too (1.27.0). The component reads its name from
  // `useWorkspaceTitle` rather than from this deployment's own module, which
  // is what let it travel; the test came with it, its nouns replaced by
  // fixtures and the config seam pinned.
  'src/components/editor/WorkspaceServiceSwitcher.tsx',
  'src/components/editor/workspaceServiceSwitcher.test.tsx',
  'src/components/editor/TabStrip.tsx',

  // Three contracts this deployment wrote, now shared.
  //
  // This tree holds 22 test files the template does not. 19 import only
  // modules the template has, so all 19 were run there: three passed
  // unmodified and are here; sixteen failed, and each of those failures is a
  // measurement of divergence rather than a file to force green.
  //
  // `supabaseProviderWriteGate.test.tsx` is not a duplicate of the template's
  // `supabaseProviderTier.test.tsx`. That one asserts `isServiceAccount`, a
  // flag this deployment deliberately does not publish; this one asserts the
  // gate those flags feed. The template now carries both.
  'src/lib/resolveBlueprint.test.ts',
  'src/components/blueprint/compareTouchpointDifferences.test.tsx',
  'src/contexts/supabaseProviderWriteGate.test.tsx',

  // The reader-tier contract, once the template stopped sending the read.
  //
  // This one was among the sixteen that FAILED upstream, and it failed for a
  // real reason: `business_models` is refused for every signed-out visitor,
  // and the template sent the request anyway and swallowed the 42501 as
  // ordinary — which made a genuinely broken table indistinguishable from a
  // signed-out reader. 1.28.0 publishes `canReadPrivate` and gates the read on
  // it, so the contract passes there and the file is one file.
  'src/hooks/serviceSpecReaderTier.test.tsx',
]

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { MobileShell } from '@/components/mobile/MobileShell'
import { useMobileShell } from '@/hooks/useMobileShell'
import {

  useSidebarCollapse,
} from '@/hooks/useSidebarOverlay'
import {
  RAIL_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from '@/lib/layoutTokens'
import { CoverPage } from '@/components/cover/CoverPage'
import { EditorErrorBoundary } from '@/components/EditorErrorBoundary'
import { coverContent } from '@/content/coverContent'
import { ServiceOverviewView } from '@/components/editor/ServiceOverviewView'
import {
  FloatingSidebarNavbar,
  SidebarCollapseButton,
} from '@/components/editor/EditorChrome'
import { AgentDock, AgentDockDivider } from '@/components/editor/AgentDock'
import { EditorRail, type SidebarPanel } from '@/components/editor/EditorRail'
import { AgentSettingsRailButton } from '@/components/editor/AgentPanel'
import { ThemeToggle } from '@/components/editor/ThemeToggle'
import { VisualWalkthroughShell } from '@/components/blueprint/VisualWalkthroughShell'
import { CanvasModeProvider } from '@/components/editor/CanvasModeProvider'
import { SlideModeSidebarNav } from '@/components/editor/SlideModeView'
import { SlicePresentation } from '@/components/editor/SlicePresentation'
import { SliceView } from '@/components/editor/SliceView'
import { TabStrip } from '@/components/editor/TabStrip'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useCellDeepLink } from '@/hooks/useCellDeepLink'
import { setSidebarCollapsedState } from '@/contexts/sidebarCollapsedContext'
import { setShellBooting } from '@/contexts/shellBootStore'
import { SKELETON_HOLD_MS } from '@/components/ui/deferred-skeleton'
import {
  CANVAS_REVEAL_CELLS,
  CANVAS_REVEAL_DONE,
  CANVAS_REVEAL_LANES,
  CANVAS_REVEAL_PANELS,
} from '@/contexts/canvasRevealContext'
import { EditorSidebarBootSkeleton } from '@/components/editor/EditorLoadingSkeletons'
import {
  tabKey,
  useViewState,
  type TabDescriptor,
} from '@/contexts/viewStateStore'
import {
  registerAgentUiBridge,
  registerAgentUiContext,
} from '@/lib/agent/uiBridge'
import {
  toggleAgentOpen,
  useAgentPlacement,
} from '@/lib/agent/placement'
import { registerAgentUiCommand } from '@/lib/agent/uiCommands'
import { suppressCanvasResizeRefit } from '@/lib/canvasChromeResize'
import { getSlideDisplayLabel } from '@/types/nav'
import {
  MOTION_STRUCTURAL_EASE,
  MOTION_STRUCTURAL_MS,
  SHELL_ENTRANCE_STEP_MS,
  prefersReducedMotion,
} from '@/lib/motion'
import { describeSidebar } from '@/lib/shellContext'
import { cn } from '@/lib/utils'

/**
 * Aside = rail + content panel, drag-resizable from the aside's right edge
 * with one persisted width shared by every surface. Dimensions live in
 * `lib/layoutTokens` — one home for every shell width the runtime does
 * math on.
 */
const WIDTH_STORAGE_KEY = 'uno-sidebar-width'

function loadAsideWidth(): number {
  try {
    const raw = window.localStorage.getItem(WIDTH_STORAGE_KEY)
    const value = raw ? Number(raw) : Number.NaN
    return Number.isFinite(value)
      ? Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, value))
      : SIDEBAR_DEFAULT_WIDTH
  } catch {
    return SIDEBAR_DEFAULT_WIDTH
  }
}

/**
 * The shell gate: one breakpoint decides which app this is. Below `md`
 * (767px) the phone gets the view-only mobile shell — journey reader, touch
 * map, sheets. At or above it, the desktop shell below, untouched. The
 * check is synchronous (`matchMedia` via `useSyncExternalStore`), so a
 * phone never mounts the desktop canvas for even one frame.
 */
export function EditorShell() {
  const mobile = useMobileShell()
  return mobile ? <MobileShell /> : <DesktopEditorShell />
}

/**
 * The app frame: sidebar, tab strip and whichever view the current tab selects.
 *
 * Owns sidebar collapse and the hover-peek rail. Both are timed against
 * `suppressCanvasResizeRefit`, so the canvas does not refit mid-animation.
 */
function DesktopEditorShell() {
  const {
    view,
    goHome,
    goLanding,
    enterCanvas,
    selectPhase,
    selectScenario,
    selectedPhaseId,
    selectedScenarioId,
    slides,
    togglePhaseExpanded,
    setScenarioDisplayViewType,
  } = useEditor()
  const { activeTab, activateTab, openTab, closeTab } = useViewState()
  const { canAgent } = useSupabase()
  // `?cell=` boot deep link — the receiving end of the share link uno-bot
  // hands back with a cited cell (docs/connectors/plus-uno.md). Mounted here because it needs the editor's
  // navigation and the boot URL state, and both live at this level.
  useCellDeepLink()
  /*
    Collapse, and which of the two parties asked for it.

    Below `SIDEBAR_OVERLAY_BREAKPOINT` the sidebar and the canvas cannot both
    have the width, so the gate collapses the sidebar and reopening it draws
    OVER the canvas rather than taking the column back. The state carries the
    reason with it, so widening again gives back only the collapses the gate
    itself made — `useSidebarOverlay` has the argument for why a bare boolean
    cannot tell the two apart.
  */
  const {
    overlay,
    collapsed: sidebarCollapsed,
    setCollapsedByUser,
  } = useSidebarCollapse()
  useEffect(() => {
    // A crossing wipes the aside open or shut, which resizes the canvas
    // container — chrome moving, not the reader navigating. This also runs
    // once on mount, where nothing crossed; suppressing a refit the reader
    // never triggered is the same answer, so it is left unguarded rather
    // than carrying a ref to tell the first run apart.
    suppressCanvasResizeRefit()
  }, [overlay])
  const isLanding = view === 'landing'

  const activeTabKind = activeTab?.kind ?? null

  // The rail picks a panel. Slice/present tab activation auto-selects ◇,
  // exactly as the old horizontal tabs did (initializer covers remounts
  // while a tab is already active, e.g. returning from a presentation).
  // ✦ is NOT in this state — it toggles the chat, which sits under whichever
  // panel is open, so it never displaces one.
  const [panel, setPanel] = useState<SidebarPanel>(
    activeTabKind !== null ? 'slices' : 'blueprints',
  )
  const agentPlacement = useAgentPlacement()
  const agentDocked = agentPlacement.mode === 'docked' && agentPlacement.open
  const panelColumnRef = useRef<HTMLDivElement>(null)
  const [lastTabKind, setLastTabKind] = useState(activeTabKind)
  if (lastTabKind !== activeTabKind) {
    setLastTabKind(activeTabKind)
    if (activeTabKind !== null) setPanel('slices')
  }

  // Leaving presentation runs before the tab actually switches: tabs unmount
  // on switch, so the exit animation has to play while the present tab is
  // still mounted. `leavingPresent` drops the shell back to its non-present
  // pose (sidebar expands) while the presentation surface fades out, then
  // the tab switch lands at the end of the same 320 ms.
  const [leavingPresent, setLeavingPresent] = useState(false)
  const leaveTimer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (leaveTimer.current !== null) window.clearTimeout(leaveTimer.current)
    },
    [],
  )

  // Presentation is full-bleed: the whole sidebar collapses (the navbar hides
  // too — Return is the way back), on the same 320 ms width ease as a manual
  // collapse. It never unmounts, which is what keeps entering smooth.
  const presenting = activeTabKind === 'present' && !leavingPresent

  // The cover page is a full-bleed reading surface: it has no phases to
  // navigate to yet, so a sidebar beside it is chrome for a workspace the
  // reader has not entered. It collapses like a presentation — the whole
  // aside, rail included, and no navbar either — down to zero width, which
  // is what the name below tracks: not "just the rail" (there is no rail
  // left to be only), but the aside gone entirely.
  const asideHidden = presenting || sidebarCollapsed || isLanding
  /*
    Collapsed BY THE READER, which is not the same as an aside that is off
    screen.

    NOT `asideHidden`: presentation hides the sidebar too, and hides the navbar
    with it (full-bleed). Telling the bands they are collapsed there would
    strand a presentation with no header and no Return — the band must keep
    drawing itself when nothing else can carry it. The landing view is the same
    argument again.

    ONE binding because it was three copies of one sentence, and one of the
    three was wrong: the agent's shell context asked plain `asideHidden`, so a
    reader mid-presentation was told the sidebar was collapsed and to expand a
    control that was not on screen. Three readers of a fact is fine; three
    spellings of it is how they disagree.
  */
  const collapsedByReader = sidebarCollapsed && !presenting && !isLanding

  /*
    Entering the workspace from the cover, in two separated concerns.

    WIDTH is not animated. The canvas load bar centers itself in the canvas
    frame, and a 320 ms width ease — or a sidebar that pushes the canvas as
    it arrives — would drag that bar across the screen for the whole first
    third of the load, which is the one thing it must never do. The aside
    takes its full width in the same commit the canvas mounts, so the frame
    is fixed from the first painted frame.

    PAINT is a ladder. With the width already reserved, the sidebar's three
    parts fade in over space that is not moving: the loading bar first and
    alone, then the rail, then the phases panel, then the agent dock, each
    one `SHELL_ENTRANCE_STEP_MS` behind the last. The delays are CSS
    (`--shell-entrance-*` below) rather than a chain of timers — one state
    flip, and the stagger is declarative.

    `pending` for exactly one frame: it is what gives the transitions a
    from-state to run from. A boot that lands straight on the canvas (a
    `?cell=` deep link) starts pending too, so the ladder is the same
    whichever door was used.
  */
  const [entrance, setEntrance] = useState<'idle' | 'pending' | 'shown'>(() =>
    isLanding ? 'idle' : 'pending',
  )
  /*
    The sidebar's boot lane fires ONCE per entry, tracked as a small state
    machine rather than a boolean.

    The base canvas remounts whenever a tab stops covering it, and a remount
    restarts its reveal at stage 0 — so keying the lane on the stage alone
    dropped the full boot skeleton over an already populated sidebar every
    time the reader came back from a slice tab. The stage says "this canvas
    is at rung zero"; this says "and the sidebar is skeletoning with it",
    which is true exactly once per entry from the cover.

    `armed` is the state that earns the extra step. On the frame the reader
    leaves the cover, the base canvas has not mounted yet, so the published
    stage is still the previous surface's `done` — a plain latch would read
    that stale value and retire the boot before it began. Armed waits to
    OBSERVE rung zero before it commits to one.

    Declared ahead of the flip below because the flip writes it: a `const`
    binding read above its declaration is a runtime ReferenceError, and this
    one runs during render on the first frame of every entry.
  */
  const [boot, setBoot] = useState<'off' | 'armed' | 'skeletoning'>(() =>
    isLanding ? 'off' : 'armed',
  )
  const [lastLanding, setLastLanding] = useState(isLanding)
  if (lastLanding !== isLanding) {
    setLastLanding(isLanding)
    // Back to the cover resets to idle, so the aside's width EASES closed
    // (nothing is loading behind it); entering re-arms the ladder.
    setEntrance(isLanding ? 'idle' : 'pending')
    setBoot(isLanding ? 'off' : 'armed')
  }
  useEffect(() => {
    if (entrance !== 'pending') return
    const frame = requestAnimationFrame(() => setEntrance('shown'))
    return () => cancelAnimationFrame(frame)
  }, [entrance])

  /*
    The boot skeleton is an OPAQUE LAYER over the whole sidebar, not a
    placeholder inside each section.

    Two things were wrong with per-section skeletons. Only the row lists
    were ever skeletoned, so the rail's icons, the PHASES and SESSIONS
    headers and every control stayed painted and live over a screen that
    was still loading. And each list ran its own swap, so the two halves of
    the sidebar resolved on separate clocks — a top-to-bottom cascade that
    says nothing, since neither list is waiting on the other.

    One lane fixes both. Everything behind it is covered, and it lifts in a
    single fade at stage 1 — the beat the canvas opens its phase lanes — so
    the sidebar and the board resolve together, all at once.

    Mounted one stage past the fade so the lane cannot be pulled while it
    is still fading (the same tie the loading bar hit).
  */
  /*
    Reported by the base canvas through `onRevealStage` — a prop, not a
    module store. `setRevealStage` is a `useState` setter, so it is stable
    across renders and does not defeat `memo(ServiceOverviewView)`.
  */
  const [revealStage, setRevealStage] = useState(CANVAS_REVEAL_DONE)
  if (boot === 'armed' && revealStage < CANVAS_REVEAL_PANELS) setBoot('skeletoning')
  else if (boot === 'skeletoning' && revealStage >= CANVAS_REVEAL_CELLS) {
    setBoot('off')
  }
  /*
    Opaque until the canvas opens its first lane, then fades with it.

    The fade begins at stage 1 and the lane is not unmounted until stage 3 —
    two stages, not one. The beats are 200/160/128 ms and the fade is one
    `--motion-fade`, so unmounting at stage 2 would be a near-exact tie: a
    frame of scheduling jitter either way and the lane vanishes mid-fade
    instead of completing it. That is the same tie the loading bar hit, and
    the cost of the extra stage is an invisible element at opacity 0.
  */
  const sidebarBooting = boot === 'skeletoning' && revealStage < CANVAS_REVEAL_LANES
  const sidebarBootMounted = boot === 'skeletoning'

  useEffect(() => {
    // Entering and leaving presentation both resize the canvas container.
    suppressCanvasResizeRefit()
  }, [presenting])

  // Picking anything in the rail while collapsed also opens the panel —
  // choosing a surface you cannot see is not a choice.
  const revealSidebar = useCallback(() => {
    if (!sidebarCollapsed) return
    setCollapsedByUser(false)
  }, [sidebarCollapsed, setCollapsedByUser])

  // Hand the agent its navigation hands: open_phase / open_scenario tools
  // land on the same callbacks the sidebar rows use.
  useEffect(
    () =>
      registerAgentUiBridge({
        selectPhase,
        selectScenario,
        openAgentSurface: () => {
          toggleAgentOpen(true)
          setCollapsedByUser(false)
        },
        setSidebarCollapsed: setCollapsedByUser,
      }),
    [selectPhase, selectScenario, setCollapsedByUser],
  )

  // The read side: what the shell itself knows about what's on screen.
  // Ref-refreshed each render, registered once — the collector always sees
  // the latest without effect churn.
  const phaseSlide = slides.find((slide) => slide.id === selectedPhaseId)
  const scenarioSlide = slides.find((slide) => slide.id === selectedScenarioId)
  const shellContext = [
    `View level: ${view}${view === 'home' ? ' (zoomed-out overview of all phases)' : ''}`,
    phaseSlide
      ? `Selected phase: "${getSlideDisplayLabel(phaseSlide, slides)}" (${phaseSlide.id})`
      : 'Selected phase: none',
    scenarioSlide
      ? `Selected scenario: "${getSlideDisplayLabel(scenarioSlide, slides)}" (${scenarioSlide.id})`
      : 'Selected scenario: none',
    activeTab
      ? `Active tab: ${activeTab.kind} for slice ${activeTab.sliceId}`
      : 'Active tab: base blueprint view (no slice tab)',
    describeSidebar({ panel, collapsed: collapsedByReader, overlay, presenting }),
    `Agent chat: ${agentPlacement.open ? `${agentPlacement.mode} (visible)` : 'hidden'}`,
  ].join('\n')
  const shellContextRef = useRef(shellContext)
  useEffect(() => {
    shellContextRef.current = shellContext
  })
  useEffect(
    () => registerAgentUiContext('shell', () => shellContextRef.current),
    [],
  )

  // Agent parity: the shell-level controls (tabs, presentation, phase
  // accordion, compare toggle). Ref-snapshotted so registration is stable
  // while the handlers stay current.
  type ShellCommands = {
    goOverview: () => void
    activateBase: () => void
    openSliceTab: (sliceId: string, present: boolean) => void
    closeSliceTab: (sliceId: string) => void
    exitPresent: () => string
    togglePhase: (phaseId: string) => void
    setScenarioView: (view: 'stacked' | 'merged') => string
  }
  const shellCommandsRef = useRef<ShellCommands>({
    goOverview: () => {},
    activateBase: () => {},
    openSliceTab: () => {},
    closeSliceTab: () => {},
    exitPresent: () => 'Shell not ready yet.',
    togglePhase: () => {},
    setScenarioView: () => 'Shell not ready yet.',
  })
  useEffect(() => {
    const commands = shellCommandsRef
    const unregister = [
      registerAgentUiCommand({
        name: 'go_overview',
        description: 'Back to the zoomed-out overview of all phases (Home).',
        run: () => {
          commands.current.goOverview()
          return 'On the overview.'
        },
      }),
      registerAgentUiCommand({
        name: 'activate_base_tab',
        description: 'Return to the base blueprint tab and its zoomed-out overview.',
        run: () => {
          commands.current.activateBase()
          return 'Base blueprint overview is active.'
        },
      }),
      registerAgentUiCommand({
        name: 'open_slice_tab',
        description: 'Open a slice in a tab. arg: slice id (list_slices).',
        run: (arg) => {
          if (!arg) throw new Error('arg required: slice id')
          commands.current.openSliceTab(arg, false)
          return 'Slice tab opened.'
        },
      }),
      registerAgentUiCommand({
        name: 'present_slice',
        description: 'Start presenting a slice full-bleed. arg: slice id.',
        run: (arg) => {
          if (!arg) throw new Error('arg required: slice id')
          commands.current.openSliceTab(arg, true)
          return 'Presenting the slice.'
        },
      }),
      registerAgentUiCommand({
        name: 'exit_presentation',
        description: 'Leave the running presentation back onto its slice tab.',
        run: () => commands.current.exitPresent(),
      }),
      registerAgentUiCommand({
        name: 'close_slice_tab',
        description: 'Close a slice\'s open tab(s). arg: slice id.',
        run: (arg) => {
          if (!arg) throw new Error('arg required: slice id')
          commands.current.closeSliceTab(arg)
          return 'Tab closed.'
        },
      }),
      registerAgentUiCommand({
        name: 'toggle_phase_expanded',
        description: "Expand/collapse a phase's accordion in the sidebar. arg: phase id.",
        run: (arg) => {
          if (!arg) throw new Error('arg required: phase id')
          commands.current.togglePhase(arg)
          return 'Toggled the phase accordion.'
        },
      }),
      registerAgentUiCommand({
        name: 'set_scenario_view',
        description: 'Switch the SELECTED scenario between its two displays. arg: stacked | merged (needs 2+ visible paths). stacked = one full band per path on a shared step axis. merged = the paths combined into ONE blueprint: one lane rail, one step axis, cells the paths agree on drawn once, divergent slots stacking each path\'s version. Entering merged also applies the reading preset — shared steps fold and the difference ledger opens; returning to stacked unfolds. Legacy aliases accepted: side-by-side = stacked, integrated = merged — accepted from a caller, never stored (the column holds single | stacked).',
        run: (arg) =>
          // 'side-by-side'/'integrated' are the pre-v3 tokens. The column no
          // longer holds them, but they are kept as documented aliases so older
          // prompts and transcripts still resolve to a view rather than failing.
          // This is a display switch — it writes nothing.
          commands.current.setScenarioView(
            arg === 'merged' || arg === 'integrated' ? 'merged' : 'stacked',
          ),
      }),
    ]
    return () => unregister.forEach((fn) => fn())
  }, [])

  const toggleSidebar = () => {
    setCollapsedByUser(!sidebarCollapsed)
  }

  // Shared drag-resize. During a drag the width transition is off —
  // easing against the pointer reads as lag, not motion.
  const [asideWidth, setAsideWidth] = useState(loadAsideWidth)
  const [resizing, setResizing] = useState(false)
  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setResizing(true)
    suppressCanvasResizeRefit()
  }
  const moveResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizing) return
    // The aside is flush with the window's left edge, so the pointer's x IS
    // the aside width.
    const next = Math.min(
      SIDEBAR_MAX_WIDTH,
      Math.max(SIDEBAR_MIN_WIDTH, Math.round(event.clientX)),
    )
    suppressCanvasResizeRefit()
    setAsideWidth((width) => (width === next ? width : next))
  }
  const endResize = () => {
    if (!resizing) return
    setResizing(false)
    setAsideWidth((width) => {
      try {
        window.localStorage.setItem(WIDTH_STORAGE_KEY, String(width))
      } catch {
        // Width memory is a nicety; failing to store is fine.
      }
      return width
    })
  }

  /*
    Publish what the aside is doing to the canvas's own chrome, so canvas
    navbars can answer it themselves — see sidebarCollapsedContext for why
    the navbar is now the fallback rather than the default.

    Two facts, one effect. COLLAPSED: host the expand control. INSET: how far
    the aside reaches across the canvas column while it OVERLAYS it, which is
    `asideWidth` in exactly the state the aside is both out of the flow and on
    screen. `asideWidth` and not the panel's own width — the aside is the rail
    plus the panel, and the rail is the half that reaches furthest left.

    Below the resize handlers rather than up with `collapsedByReader`, because
    `asideWidth` is declared here and a dependency array cannot name a binding
    it sits above.

    This is the shell's whole part in #239. When the overlay posture engages,
    and the panel's own geometry inside it, are untouched; only what the bar
    does about it is new.
  */
  useEffect(() => {
    setSidebarCollapsedState({
      collapsed: collapsedByReader,
      overlayInset: overlay && !asideHidden ? asideWidth : 0,
    })
  }, [collapsedByReader, overlay, asideHidden, asideWidth])

  /*
    The identity bars above the canvas hold their own skeletons while this
    lane is up, so the bar, the sidebar and the board arrive on one beat
    (#253). Published rather than passed: the bars sit deep inside canvas
    content, the same distance away as the collapsed state above.

    Cleared on unmount. A latch left `true` by a shell that has gone would
    hold every bar that mounts afterwards, and nothing would ever set it
    back — the boot machine only runs while this component does.
  */
  useEffect(() => {
    setShellBooting(sidebarBooting)
  }, [sidebarBooting])
  useEffect(() => () => setShellBooting(false), [])

  /**
   * Return: exit presentation onto that slice's focus tab, creating the tab
   * if it is not already open. The three entry moves play in reverse over
   * the same durations before the switch commits.
   */
  const exitPresentation = useCallback(
    (sliceId: string) => {
      if (leaveTimer.current !== null) return
      const land = () => {
        leaveTimer.current = null
        openTab({ kind: 'slice', sliceId })
        setLeavingPresent(false)
      }
      if (prefersReducedMotion()) {
        land()
        return
      }
      setLeavingPresent(true)
      suppressCanvasResizeRefit()
      leaveTimer.current = window.setTimeout(land, MOTION_STRUCTURAL_MS)
    },
    [openTab],
  )

  // Home (in the tab strip) is the route back to the birds-eye overview
  // canvas — it deactivates any tab, clears the selection and animates the
  // fit, exactly like Escape and the workspace breadcrumb. `goHome` (not
  // `enterCanvas`) so every overview return has the same feel.
  const goOverview = () => {
    activateTab(null)
    goHome()
  }

  // Home (the icon at the top left) routes to the COVER page: the workspace
  // tab beside it already returns to the base canvas, so pointing both at
  // the overview left the cover unreachable once you had entered.
  const goCover = () => {
    activateTab(null)
    goLanding()
  }

  // The workspace tab always means the blueprint's starting view. From the
  // cover it enters without a boot swoop; from any canvas level it uses the
  // same animated overview return as Home, Escape, and the breadcrumb.
  const goWorkspace = () => {
    activateTab(null)
    if (isLanding) enterCanvas()
    else goHome()
  }

  // Latest handlers for the registered shell commands (declared above);
  // assigned below everything they close over, inside an every-render
  // effect (refs are not written during render).
  const shellCommands: ShellCommands = {
    goOverview,
    activateBase: goWorkspace,
    openSliceTab: (sliceId, present) =>
      openTab({ kind: present ? 'present' : 'slice', sliceId }),
    closeSliceTab: (sliceId) => {
      closeTab(tabKey({ kind: 'slice', sliceId }))
      closeTab(tabKey({ kind: 'present', sliceId }))
    },
    exitPresent: () => {
      if (activeTab?.kind !== 'present') return 'Not presenting right now.'
      exitPresentation(activeTab.sliceId)
      return 'Left the presentation onto the slice tab.'
    },
    togglePhase: (phaseId) => togglePhaseExpanded(phaseId),
    setScenarioView: (viewType) => {
      const scenario = slides.find((slide) => slide.id === selectedScenarioId)
      if (!scenario) return 'No scenario is selected — open one first.'
      setScenarioDisplayViewType(scenario.id, viewType)
      return `Scenario view set to ${viewType === 'merged' ? 'Merged' : 'Stacked'}.`
    },
  }
  useEffect(() => {
    shellCommandsRef.current = shellCommands
  })

  // What counts as a content switch for the crossfade. Navigation *inside*
  // the base canvas (home ⇄ detail) is a camera move, not a screen change,
  // so it deliberately keeps the same key.
  const contentKey = activeTab
    ? tabKey(activeTab)
    : isLanding
      ? 'landing'
      : 'blueprint'

  const sidebarBody = (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-row">
      <EditorRail
        panel={panel}
        agentActive={agentPlacement.open}
        showAgent={canAgent}
        onSelectPanel={(next) => {
          setPanel(next)
          revealSidebar()
        }}
        // ✦ toggles the chat's presence; the panel buttons still pick what
        // sits underneath it, so "chat while looking at the nav" is the
        // default posture rather than a swap away from it.
        onToggleAgent={() => {
          toggleAgentOpen()
          revealSidebar()
        }}
        topSlot={
          <SidebarCollapseButton collapsed={false} onToggle={toggleSidebar} />
        }
        bottomSlot={
          <>
            {/* Theme is a utility toggle, not a surface — it lives in the
                rail's bottom group with the other toggles, not in the
                collapsed navbar, which is already the app's tightest 32px. */}
            <ThemeToggle size="icon-sm" />
            <AgentSettingsRailButton />
          </>
        }
      />
      <div ref={panelColumnRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
        <SidebarProvider
          style={
            {
              '--sidebar-width': `${asideWidth - RAIL_WIDTH}px`,
            } as CSSProperties
          }
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          <SlideModeSidebarNav panel={panel} />
        </SidebarProvider>
        {agentDocked ? <AgentDockDivider columnRef={panelColumnRef} /> : null}
        <AgentDock visible={canAgent && agentDocked} />
      </div>
    </div>
  )

  return (
    // The base surface's mode, hoisted to include the sidebar.
    //
    // It used to wrap only the canvas, which left the sidebar unable to answer
    // "are we editing?" — so its `+` and `⋯` were on in View mode, offering to
    // create and rename things on a surface whose whole premise is that it
    // changes nothing. A slice tab still mounts its own provider inside this
    // one and shadows it, which is what keeps the two surfaces independent.
    <CanvasModeProvider>
      <div
        // h-full rides the html/body/#root 100% chain — unlike svh units it
        // tracks the real laid-out viewport in embedded panes that resolve
        // viewport units against a stale size after a resize.
        className="relative flex h-full flex-col overflow-hidden bg-background"
        data-editor-shell
      >
        {/* Full-width top nav: workspace identity, Home, open tabs. */}
        <TabStrip
          isCover={isLanding}
          onHome={goCover}
          onBase={goWorkspace}
        />

        <div className="relative flex min-h-0 min-w-0 flex-1">
          <aside
            className={cn(
              'z-20 shrink-0 overflow-hidden bg-sidebar',
              !asideHidden && 'border-r border-border',
              /*
                The overlay posture, below the gate. Out of the flow
                entirely, so reopening draws over the canvas instead of
                taking back a column the canvas cannot spare — reopening
                in flow down here only recreates the squeeze the collapse
                was for. Still `z-20`: this is the same shell column in the
                same band (foundations/elevation.md), merely floating, and
                `shadow-floating` is the token that says floating.

                No scrim — but NOT on `CreateSliceSheet`'s reasoning, which
                is conditioned on a sheet that "sits beside" a canvas left
                lit. This panel is `absolute inset-y-0 left-0`; it occludes
                the strip it covers, so the thing that doctrine protects is
                already hidden and citing it here would be borrowing an
                argument that does not reach.

                The reason that does reach is narrower: a scrim announces a
                mode the reader must leave, and this is a column that came
                back, not a dialog. What a scrim usually buys — somewhere to
                click to get out — is bought here instead by the rail's own
                collapse toggle, which stays on screen the whole time, and by
                Escape below. Outside-click is deliberately NOT wired: the
                surface it would swallow clicks from is the canvas, where a
                click selects a cell, and losing that first click to a
                dismissal is worse than one extra keystroke.
              */
              overlay
                ? cn('absolute inset-y-0 left-0', !asideHidden && 'shadow-floating')
                : 'relative',
            )}
            style={{
              width: asideHidden ? 0 : asideWidth,
              transitionProperty:
                resizing || entrance === 'pending' ? 'none' : 'width',
              transitionDuration: `${MOTION_STRUCTURAL_MS}ms`,
              transitionTimingFunction: MOTION_STRUCTURAL_EASE,
            }}
            data-editor-sidebar=""
            data-collapsed={asideHidden ? '' : undefined}
            aria-label="Workspace navigation"
          >
            {/*
              Fixed-width sidebar body (rail + panel). In flow it is clipped
              by the animating aside, so open/close reads as a wipe rather
              than a mount/unmount.
            */}
            <div
              className={cn(
                'flex h-full min-h-0 flex-row',
                'transition-[opacity,transform] duration-(--motion-fade) ease-out motion-reduce:transition-none',
                asideHidden
                  ? 'pointer-events-none -translate-x-2 opacity-0'
                  : 'translate-x-0 opacity-100 delay-75',
              )}
              style={{ width: asideWidth }}
              aria-hidden={asideHidden}
            >
              {sidebarBody}
            </div>
            {/*
              The boot lane. `bg-sidebar` over the aside's own background,
              at the aside's full width so the rail is covered too.
            */}
            {sidebarBootMounted && !asideHidden ? (
              <div
                className={cn(
                  'absolute inset-y-0 left-0 z-10 bg-sidebar',
                  'transition-opacity duration-(--motion-fade) ease-out',
                  !sidebarBooting && 'pointer-events-none opacity-0',
                )}
                style={
                  {
                    width: asideWidth,
                    // The entrance ladder's rungs. Delays are inline so the
                    // TS constants stay the single source — nothing to
                    // drift against a stylesheet.
                    '--shell-entrance-rail': `${SKELETON_HOLD_MS}ms`,
                    '--shell-entrance-panel': `${SKELETON_HOLD_MS + SHELL_ENTRANCE_STEP_MS}ms`,
                    '--shell-entrance-agent': `${SKELETON_HOLD_MS + SHELL_ENTRANCE_STEP_MS * 2}ms`,
                  } as CSSProperties
                }
                data-shell-entrance={entrance}
                data-editor-sidebar-boot=""
                /*
                  Deliberately NOT a live region. The canvas's load bar is
                  already `role="status"` for this same boot, and two status
                  regions active in the same window announce one event twice.
                  The bar is the better owner: it is the thing that actually
                  reports progress.
                */
                aria-hidden
              >
                <EditorSidebarBootSkeleton
                  showAgent={canAgent && agentDocked}
                  dockRatio={agentPlacement.dockRatio}
                />
              </div>
            ) : null}

            {/* Drag the aside's right edge to resize; width is remembered
                per surface. Hidden while collapsed — there is no edge. */}
            {!asideHidden ? (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize sidebar"
                onPointerDown={startResize}
                onPointerMove={moveResize}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                className={cn(
                  'absolute inset-y-0 right-0 z-30 w-1.5 cursor-col-resize',
                  'hover:bg-border/80 active:bg-border',
                  resizing && 'bg-border',
                )}
              />
            ) : null}
          </aside>

          {/*
            The floating posture: portalled to the body so the window
            escapes the sidebar's clip. Hidden while presenting — a
            full-bleed slice is not the place for a chat window.
          */}
          <AgentDock
            visible={canAgent && agentPlacement.mode === 'floating' && !presenting}
          />

          {/*
            Collapsed remnant: the floating navbar over the canvas. Hidden
            while presenting (full-bleed; Return is the way back). Its
            toggle is the same single control the rail carries expanded.
          */}
          {collapsedByReader ? (
            <div className="pointer-events-none absolute left-3 top-3 z-30">
              <FloatingSidebarNavbar onExpand={toggleSidebar} />
            </div>
          ) : null}

          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="relative min-h-0 min-w-0 flex-1">
              {/*
                Only the active tab's content mounts, so switching is a
                fade-through rather than a true crossfade: the keyed wrapper
                remounts and the incoming surface fades up over 200 ms after
                the 75 ms stagger the sidebar already uses.
              */}
              <div
                key={contentKey}
                className="absolute inset-0"
                data-editor-content=""
              >
                {/*
                  A second boundary, inside the one App.tsx puts around the
                  whole shell. That outer one is the last line before a white
                  screen, and it takes the tab strip, the sidebar, the rail
                  and the agent dock down with the board — which is the wrong
                  trade for a throw that came from one canvas. A crash here
                  costs the reader the view they were on and nothing else:
                  the chrome stays, and every other tab is one click away.

                  `resetKey` is the content key, so navigating is enough to
                  recover — the boundary's own documented contract, and the
                  reason a single throw does not read as "the app crashes
                  constantly". This does not soften ADR 0004: the board is
                  still always fully mounted, and this unmounts it only for a
                  throw the alternative would have unmounted anyway.
                */}
                <EditorErrorBoundary resetKey={contentKey}>
                  <ActiveTabContent
                    tab={activeTab}
                    isLanding={isLanding}
                    leavingPresent={leavingPresent}
                    onReturn={exitPresentation}
                    onRevealStage={setRevealStage}
                  />
                </EditorErrorBoundary>
              </div>
            </div>
          </main>
        </div>
      </div>
    </CanvasModeProvider>
  )
}

function ActiveTabContent({
  tab,
  isLanding,
  leavingPresent,
  onReturn,
  onRevealStage,
}: {
  tab: TabDescriptor | null
  isLanding: boolean
  leavingPresent: boolean
  onReturn: (sliceId: string) => void
  /** Handed to the base canvas only — see `ServiceOverviewView`. */
  onRevealStage: (stage: number) => void
}) {
  if (tab === null) {
    // Base blueprint view — existing landing / home / detail behavior.
    return isLanding ? (
      <CoverPage content={coverContent} />
    ) : (
      // No provider here: the base surface's mode is the shell's, so the
      // sidebar and this canvas are always in the same one.
      <VisualWalkthroughShell>
        <div
          className="absolute inset-0 flex min-h-0 flex-col"
          data-editor-view
        >
          {/* The one canvas that boots WITH the sidebar, so the one that
              drives its boot lane — see `onRevealStage`. */}
          <ServiceOverviewView onRevealStage={onRevealStage} />
        </div>
      </VisualWalkthroughShell>
    )
  }
  switch (tab.kind) {
    case 'slice':
      return <SliceView key={tabKey(tab)} sliceId={tab.sliceId} />
    case 'present':
      return (
        <SlicePresentation
          key={tabKey(tab)}
          sliceId={tab.sliceId}
          leaving={leavingPresent}
          onReturn={() => onReturn(tab.sliceId)}
        />
      )
  }
}

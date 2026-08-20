import { Component, type ReactNode } from 'react'
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  CELL_DETAIL_PANEL_BOTTOM_CLASS,
  CELL_DETAIL_PANEL_TOP_CLASS,
} from '@/components/editor/menubarHeaderLayout'
import { useMobileShell } from '@/hooks/useMobileShell'
import { panelEditorBusy } from '@/lib/panelEditorBusy'
import { cn } from '@/lib/utils'

/**
 * The chrome every entity detail panel is made of — drawer, error boundary,
 * field label, footer host.
 *
 * All of it was written for the CELL panel and lived inside it. Four levels of
 * the blueprint tree own spec fields and only one had a surface; the rest are
 * being built now, and copying a 90-line drawer four times is how two of them
 * end up with different close behaviour. Lifted, not duplicated.
 *
 * `data-cell-detail-panel` keeps its name. It is a DOM contract in twenty
 * places — every entry/exit animation in animations.css, the pan-exempt
 * selector in ServiceOverviewView, MarqueeSelection, SliceView, print.css —
 * and renaming it buys a better word at the price of touching the motion
 * system. Read it as "an entity detail drawer"; the shell is the only thing
 * that writes it.
 */

/**
 * One footer host id per panel. `CELL_PANEL_FOOTER_ID` is a global DOM id that
 * a form portals its Save/Cancel row into, and two panels sharing one id would
 * put the lane panel's buttons under the cell panel's fields. Only one panel is
 * open at a time today; the ids make that a design choice rather than the only
 * thing standing between us and a collision.
 */
export const CELL_PANEL_FOOTER_ID = 'cell-panel-editor-footer'
export const LANE_PANEL_FOOTER_ID = 'lane-panel-editor-footer'
export const PHASE_PANEL_FOOTER_ID = 'phase-panel-editor-footer'
export const SCENARIO_PANEL_FOOTER_ID = 'scenario-panel-editor-footer'

/**
 * A render error in the drawer must cost the drawer, not the app.
 *
 * The panel is the one surface that renders arbitrary authored content —
 * pictures, links, tech pills, prose — outside the canvas's providers, which
 * makes it the most likely place for a render throw. Without a boundary that
 * throw unmounted the entire editor to a white page, which is how a broken
 * pill icon read as "loading is broken". React error boundaries are still
 * class-only.
 */
export class DetailPanelErrorBoundary extends Component<
  { children: ReactNode; message: string; logPrefix: string },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error(`[${this.props.logPrefix}] panel render failed:`, error)
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="fixed right-4 bottom-16 z-40 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-md">
          {this.props.message}
        </div>
      )
    }
    return this.props.children
  }
}

/**
 * The one drawer shell every panel renders through. Each render branch
 * (details, draft, placeholder, differences) returns this at the same tree
 * position, so React reconciles them as the SAME drawer — a surface switch is
 * a content swap inside the open drawer, never a close-reopen.
 */
export function PanelDrawerShell({
  open,
  expanded = false,
  onCloseRequest,
  onClosed,
  children,
}: {
  open: boolean
  /** Desktop-only widen. A bottom sheet is already the width of the phone. */
  expanded?: boolean
  onCloseRequest: () => void
  onClosed: () => void
  children: ReactNode
}) {
  // Same drawer, two postures: the desktop right-pinned card, or — below
  // md — a bottom sheet the width of the phone. One component, mirroring
  // the AgentDock docked/floating precedent; the reconciliation guarantee
  // above (same tree position) holds in both postures.
  const mobile = useMobileShell()
  return (
    <Drawer
      // Keyed on posture: a resize across the breakpoint while open would
      // otherwise reinterpret an in-flight swipe's x-offset against the
      // other posture's axis. A flip remounts the drawer clean instead.
      key={mobile ? 'mobile' : 'desktop'}
      open={open}
      onOpenChange={(next) => {
        // Only close *requests* (✕, Escape, swipe) arrive here, and with
        // `open` derived from panel state they can only fire while the panel
        // is open — the delayed-callback-wipes-new-selection class of bug
        // died with the second owner.
        if (!next && !panelEditorBusy()) onCloseRequest()
      }}
      onOpenChangeComplete={(next) => {
        if (!next) onClosed()
      }}
      modal={false}
      disablePointerDismissal
      swipeDirection={mobile ? 'down' : 'right'}
      // A bottom sheet says how to dismiss itself with a grab handle; the
      // desktop inspector has its own ✕ and does not read as draggable.
      showSwipeHandle={mobile}
    >
      <DrawerContent
        data-cell-detail-panel=""
        // The posture the MOTION keys off (animations.css): a sheet rises
        // from the bottom edge, an inspector lifts in beside the cell it
        // came from. Two vocabularies, one component.
        data-cell-detail-posture={mobile ? 'sheet' : 'inspector'}
        className={cn(
          mobile
            ? '!inset-x-0 !bottom-0 !top-auto !m-0 !h-auto max-h-[70svh] w-auto border-t border-border bg-popover shadow-sm after:hidden [--drawer-inset:0px]'
            : cn(
                CELL_DETAIL_PANEL_TOP_CLASS,
                CELL_DETAIL_PANEL_BOTTOM_CLASS,
                '!right-4 !left-auto !m-0 !h-auto !max-h-none rounded-2xl border border-border bg-popover shadow-sm after:hidden [--drawer-inset:1rem] md:!right-8 md:[--drawer-inset:2rem]',
                expanded
                  ? 'w-(--width-cell-panel-expanded)'
                  : 'w-(--width-cell-panel)',
              ),
        )}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </DrawerContent>
    </Drawer>
  )
}

/**
 * Where a panel's Save and Cancel land: a host pinned to the drawer's bottom
 * edge, below the scroll region and any tabs. The form portals its buttons
 * here so they read as controls for the whole panel — one Save for everything
 * on it — instead of a row buried mid-scroll.
 *
 * `empty:hidden` keeps the border off a panel with nothing to save (view mode).
 */
export function PanelFooterHost({ id }: { id: string }) {
  return (
    <div
      id={id}
      className="shrink-0 border-t border-muted px-4 py-3 empty:hidden"
    />
  )
}

/** Label with its explanation folded into a hover tooltip, not inline text. */
export function Field({
  label,
  hint,
  required = false,
  children,
}: {
  label: string
  hint?: string
  /** Draws the asterisk — the only signal a field cannot be left empty. */
  required?: boolean
  children: ReactNode
}) {
  const labelText = (
    <span className="w-fit text-2xs font-medium text-muted-foreground">
      {label}
      {required ? <span className="ml-0.5 text-destructive">*</span> : null}
    </span>
  )
  return (
    <div className="flex flex-col gap-1">
      {hint ? (
        <Tooltip>
          <TooltipTrigger render={labelText} />
          <TooltipContent side="left">{hint}</TooltipContent>
        </Tooltip>
      ) : (
        labelText
      )}
      {children}
    </div>
  )
}

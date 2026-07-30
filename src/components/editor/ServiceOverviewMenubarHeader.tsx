import type { PathOption } from '@/components/blueprint/PathMultiSelect'
import { AssumptionLensToggle } from '@/components/editor/AssumptionLensToggle'
import { NavbarZoomIndicator } from '@/components/editor/EditorZoomIndicator'
import { FindingsToggle } from '@/components/editor/FindingsPanel'
import { NavbarSlideTitleNav } from '@/components/editor/NavbarSlideTitleNav'
import { StackHeaderFilterMenu } from '@/components/editor/StackHeaderFilterMenu'
import {
  BLUEPRINT_MENUBAR_FLAT_CLASS,
  BLUEPRINT_MENUBAR_HEADER_CLASS,
  BLUEPRINT_MENUBAR_TITLE_CLASS,
  BLUEPRINT_NAVBAR_BAR_CLASS,
} from '@/components/editor/menubarHeaderLayout'
import { Menubar } from '@/components/ui/menubar'
import { cn } from '@/lib/utils'

const OVERVIEW_MENU_TITLE = 'Uno Blueprint'
const OVERVIEW_MENU_DESCRIPTION =
  'An overview of the phases across the PLUS service lifecycle.'

type ServiceOverviewMenubarHeaderProps = {
  paths: PathOption[]
  selectedPathIds: string[]
  onTogglePath: (pathId: string) => void
  className?: string
}

/** Title bar for the service overview canvas. */
export function ServiceOverviewMenubarHeader({
  paths,
  selectedPathIds,
  onTogglePath,
  className,
}: ServiceOverviewMenubarHeaderProps) {
  return (
    <Menubar
      modal={false}
      data-phase-menubar-header
      data-service-overview-menubar
      className={cn(BLUEPRINT_MENUBAR_HEADER_CLASS, className)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className={BLUEPRINT_MENUBAR_TITLE_CLASS}>
        <div className="flex min-w-0 shrink-0 items-center gap-1.5">
          <NavbarSlideTitleNav
            label={OVERVIEW_MENU_TITLE}
            description={OVERVIEW_MENU_DESCRIPTION}
            isOverview
          />
          <span
            className="shrink-0 text-xs text-muted-foreground/70"
            aria-hidden
          >
            \
          </span>
          <StackHeaderFilterMenu
            paths={paths}
            selectedPathIds={selectedPathIds}
            onTogglePath={onTogglePath}
          />
        </div>
      </div>
    </Menubar>
  )
}

type ServiceOverviewStickyHeaderProps = ServiceOverviewMenubarHeaderProps

/** Docked horizontal navbar above the overview canvas (main column only). */
export function ServiceOverviewStickyHeader({
  className,
  ...menubarProps
}: ServiceOverviewStickyHeaderProps) {
  return (
    <div
      data-editor-navbar
      className={cn('relative', BLUEPRINT_NAVBAR_BAR_CLASS, className)}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <ServiceOverviewMenubarHeader
        {...menubarProps}
        className={BLUEPRINT_MENUBAR_FLAT_CLASS}
      />
      <div className="pointer-events-none absolute inset-y-0 right-4 z-20 flex items-center gap-2">
        <AssumptionLensToggle />
        <FindingsToggle />
        <NavbarZoomIndicator />
      </div>
    </div>
  )
}

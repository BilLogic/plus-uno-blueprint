import { NavbarZoomIndicator } from '@/components/editor/EditorZoomIndicator'
import { NavbarSlideTitleNav } from '@/components/editor/NavbarSlideTitleNav'
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
  className?: string
}

/** Title bar for the service overview canvas. */
export function ServiceOverviewMenubarHeader({
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
        <NavbarSlideTitleNav
          label={OVERVIEW_MENU_TITLE}
          description={OVERVIEW_MENU_DESCRIPTION}
          isOverview
          className="shrink-0"
        />
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
      <div className="pointer-events-none absolute inset-y-0 right-4 z-20 flex items-center">
        <NavbarZoomIndicator />
      </div>
    </div>
  )
}

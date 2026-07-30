import { ChevronRight } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import {
  getMainSlides,
  getSlideDisplayLabel,
  getSubslides,
  type NavItem,
} from '@/types/nav'
import { cn } from '@/lib/utils'

type SlideNavProps = {
  slides: NavItem[]
  activeSlideId: string
  onSelect: (id: string) => void
  /** True when no phase/scenario should appear selected (landing or overview). */
  isHome?: boolean
  /** Birds-eye canvas overview. */
  onOverview?: () => void
  isOverviewActive?: boolean
  /**
   * Expanded phases. Owned by EditorContext, not this component: local
   * expansion state died on every mode switch, skeleton swap, and
   * presentation tab, since all of those unmount the sidebar.
   */
  expandedPhaseIds: ReadonlySet<string>
  onToggleExpanded: (phaseId: string, open: boolean) => void
}

export function SlideNav({
  slides,
  activeSlideId,
  onSelect,
  isHome = false,
  onOverview,
  isOverviewActive = false,
  expandedPhaseIds,
  onToggleExpanded,
}: SlideNavProps) {
  const mains = getMainSlides(slides)

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {onOverview ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isOverviewActive}
                onClick={onOverview}
                tooltip="Overview"
              >
                <span className="truncate">Overview</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}

          {mains.map((main) => {
            const children = getSubslides(main.id, slides)
            const hasChildren = children.length > 0
            const isMainActive = !isHome && activeSlideId === main.id
            const childActive =
              !isHome && children.some((c) => c.id === activeSlideId)
            const isOpen = expandedPhaseIds.has(main.id)
            const mainLabel = getSlideDisplayLabel(main, slides)

            if (!hasChildren) {
              return (
                <SidebarMenuItem key={main.id}>
                  <SidebarMenuButton
                    isActive={isMainActive}
                    onClick={() => onSelect(main.id)}
                  >
                    <span className="truncate">{mainLabel}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            }

            return (
              <Collapsible
                key={main.id}
                open={isOpen}
                onOpenChange={(open) => onToggleExpanded(main.id, open)}
              >
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isMainActive || childActive}
                    onClick={() => onSelect(main.id)}
                  >
                    <span className="truncate">{mainLabel}</span>
                  </SidebarMenuButton>
                  <CollapsibleTrigger
                    render={<SidebarMenuAction showOnHover={false} />}
                    aria-label={
                      isOpen ? `Collapse ${mainLabel}` : `Expand ${mainLabel}`
                    }
                  >
                    <ChevronRight
                      className={cn(
                        'transition-transform',
                        isOpen && 'rotate-90',
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {children.map((child) => {
                        const childLabel = getSlideDisplayLabel(child, slides)
                        return (
                          <SidebarMenuSubItem key={child.id}>
                            <SidebarMenuSubButton
                              render={<button type="button" />}
                              isActive={!isHome && activeSlideId === child.id}
                              onClick={() => onSelect(child.id)}
                            >
                              <span className="truncate">{childLabel}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

import { useEffect, type KeyboardEvent } from 'react'
import { ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
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
  /** Selected phase, or the parent of the selected scenario. */
  selectedPhaseId: string | null
  /** Selected scenario; null means the phase itself is the camera target. */
  selectedScenarioId: string | null
  /** True when no phase/scenario should appear selected (landing or overview). */
  isHome?: boolean
  /**
   * Expanded phases. Owned by EditorContext, not this component: local
   * expansion state died on every mode switch, skeleton swap, and
   * presentation tab, since all of those unmount the sidebar. It is also
   * deliberately never derived from selection — that is what makes
   * collapsing a phase leave the camera alone (nav plan D3).
   */
  expandedPhaseIds: ReadonlySet<string>
  onSelectPhase: (phaseId: string) => void
  onSelectScenario: (scenarioId: string) => void
  onSetExpanded: (phaseId: string, open: boolean) => void
  /** Bumped by every nav click; re-scrolls the selected row into view. */
  focusNonce: number
}

/** Marks the row a `scrollIntoView` effect looks for after a selection. */
const NAV_ROW_ATTR = 'data-nav-row'

export function SlideNav({
  slides,
  selectedPhaseId,
  selectedScenarioId,
  isHome = false,
  expandedPhaseIds,
  onSelectPhase,
  onSelectScenario,
  onSetExpanded,
  focusNonce,
}: SlideNavProps) {
  const mains = getMainSlides(slides)
  const selectedRowId = isHome ? null : (selectedScenarioId ?? selectedPhaseId)

  // Keep the selected row visible — it may sit below the fold after a deep
  // link, a phase auto-expansion, or a long scenario list.
  useEffect(() => {
    if (selectedRowId === null) return
    const row = document.querySelector(
      `[${NAV_ROW_ATTR}="${CSS.escape(selectedRowId)}"]`,
    )
    row?.scrollIntoView({ block: 'nearest' })
  }, [selectedRowId, focusNonce])

  // An empty SidebarMenu renders as blank space that reads like a loading
  // state that never ends. (A load *failure* is reported separately, by the
  // Alert above this nav.)
  if (mains.length === 0) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <p className="px-2 py-1.5 text-xs text-sidebar-foreground/50">
            No phases in this workspace yet.
          </p>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {mains.map((main) => {
            const children = getSubslides(main.id, slides)
            const hasChildren = children.length > 0
            const isOpen = hasChildren && expandedPhaseIds.has(main.id)
            const mainLabel = getSlideDisplayLabel(main, slides)
            // Selected = this phase is the camera target. Ancestor = the
            // selection lives inside it; those get a marker, never the fill.
            const isSelected =
              !isHome &&
              selectedPhaseId === main.id &&
              selectedScenarioId === null
            const isAncestor =
              !isHome &&
              selectedPhaseId === main.id &&
              selectedScenarioId !== null

            // D1: the row both expands and focuses. It collapses only when it
            // is already expanded *and* already the camera target — otherwise
            // a phase opened via the chevron could never be focused by
            // clicking its row. The collapse branch touches no selection
            // action, so collapsing never moves the camera.
            const handleClick = () => {
              if (hasChildren && isOpen && isSelected) {
                onSetExpanded(main.id, false)
                return
              }
              if (hasChildren) onSetExpanded(main.id, true)
              onSelectPhase(main.id)
            }

            // D6: arrows expand/collapse only — they never move the camera.
            const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
              if (!hasChildren) return
              if (event.key === 'ArrowRight' && !isOpen) {
                event.preventDefault()
                onSetExpanded(main.id, true)
              } else if (event.key === 'ArrowLeft' && isOpen) {
                event.preventDefault()
                onSetExpanded(main.id, false)
              }
            }

            const row = (
              <SidebarMenuButton
                isActive={isSelected}
                data-ancestor={isAncestor ? 'true' : undefined}
                data-nav-row={main.id}
                aria-current={isSelected ? 'true' : undefined}
                aria-expanded={hasChildren ? isOpen : undefined}
                aria-controls={hasChildren ? `phase-panel-${main.id}` : undefined}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
              >
                <span className="truncate">{mainLabel}</span>
                {hasChildren ? (
                  // Decorative: the row itself is the expander (D6).
                  <ChevronRight
                    aria-hidden
                    className={cn(
                      'ml-auto shrink-0 text-sidebar-foreground/50 transition-transform group-data-[collapsible=icon]:hidden',
                      isOpen && 'rotate-90',
                    )}
                  />
                ) : null}
              </SidebarMenuButton>
            )

            if (!hasChildren) {
              return <SidebarMenuItem key={main.id}>{row}</SidebarMenuItem>
            }

            return (
              <Collapsible
                key={main.id}
                open={isOpen}
                onOpenChange={(open) => onSetExpanded(main.id, open)}
              >
                <SidebarMenuItem>
                  {row}
                  <CollapsibleContent id={`phase-panel-${main.id}`}>
                    <SidebarMenuSub>
                      {children.map((child) => {
                        const childLabel = getSlideDisplayLabel(child, slides)
                        const isChildSelected =
                          !isHome && selectedScenarioId === child.id
                        return (
                          <SidebarMenuSubItem key={child.id}>
                            <SidebarMenuSubButton
                              render={<button type="button" />}
                              isActive={isChildSelected}
                              data-nav-row={child.id}
                              aria-current={
                                isChildSelected ? 'true' : undefined
                              }
                              onClick={() => onSelectScenario(child.id)}
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

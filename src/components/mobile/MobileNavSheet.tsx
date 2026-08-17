import { ChevronDown, ChevronRight, Diamond, LayoutGrid } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/editor/ThemeToggle'
import { getSlideDisplayLabel, ordinalLabel } from '@/types/nav'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/types/nav'
import type { Slice } from '@/types/database'

/**
 * The drawer IS the index (plan 2026-08-16-002 Phase 3): a rail + panel,
 * the same IA as the desktop sidebar. The rail carries the surface radio —
 * Blueprints ◫ / Slices ◇, `EditorRail`'s vocabulary — with the light/dark
 * control at its foot, where the desktop keeps its utilities. The panel
 * shows the selected surface: phases as an accordion (expansion lives on
 * `EditorContext.expandedPhaseIds`, reported up — not re-derived here), or
 * the saved slices.
 *
 * Doctrine unchanged from Phase 2: this component only reports WHAT was
 * tapped. What a tap means for the visible view is the shell's decision.
 */
export type MobileNavSurface = 'blueprints' | 'slices'

const RAIL_SURFACES: Array<{
  id: MobileNavSurface
  label: string
  icon: typeof LayoutGrid
}> = [
  { id: 'blueprints', label: 'Blueprints', icon: LayoutGrid },
  { id: 'slices', label: 'Slices', icon: Diamond },
]

export function MobileNavSheet({
  open,
  onOpenChange,
  surface,
  onSurfaceChange,
  slices,
  phases,
  scenariosByPhase,
  slides,
  expandedPhaseIds,
  onPhaseExpandedChange,
  selectedPhaseId,
  selectedScenarioId,
  onSelectSlice,
  onSelectPhase,
  onSelectScenario,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  surface: MobileNavSurface
  onSurfaceChange: (surface: MobileNavSurface) => void
  slices: Slice[]
  phases: NavItem[]
  scenariosByPhase: Map<string, NavItem[]>
  slides: NavItem[]
  expandedPhaseIds: ReadonlySet<string>
  onPhaseExpandedChange: (phaseId: string, open: boolean) => void
  selectedPhaseId: string | null
  selectedScenarioId: string | null
  onSelectSlice: (sliceId: string) => void
  onSelectPhase: (phaseId: string) => void
  onSelectScenario: (scenarioId: string) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        aria-label="Blueprint contents"
        className="flex w-80 flex-row p-0"
      >
        {/* The rail: surface radio on top, utilities at the foot. */}
        <nav
          aria-label="Sidebar surfaces"
          className="flex h-full w-14 shrink-0 flex-col items-center gap-1 border-r border-border/60 px-1.5 py-2"
        >
          {RAIL_SURFACES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-pressed={surface === id}
              onClick={() => onSurfaceChange(id)}
              className={cn(
                'relative flex size-11 items-center justify-center rounded-md',
                surface === id
                  ? 'bg-sidebar-selected text-sidebar-selected-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-selected-rail'
                  : 'text-sidebar-foreground/60',
              )}
            >
              <Icon className="size-4" aria-hidden />
            </button>
          ))}
          <div className="flex-1" aria-hidden />
          <ThemeToggle size="icon-sm" />
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="text-sm">
              {surface === 'slices' ? 'Slices' : 'Blueprints'}
            </SheetTitle>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
            {surface === 'slices' ? (
              slices.length > 0 ? (
                <div className="flex flex-col">
                  {slices.map((slice) => (
                    <button
                      key={slice.id}
                      type="button"
                      onClick={() => onSelectSlice(slice.id)}
                      className="flex min-h-11 items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-foreground/80"
                    >
                      <span className="min-w-0 truncate">{slice.title}</span>
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">
                  No saved slices yet.
                </p>
              )
            ) : (
              phases.map((phase) => {
                const expanded = expandedPhaseIds.has(phase.id)
                return (
                  <div key={phase.id} className="flex flex-col">
                    <div className="flex items-center">
                      <button
                        type="button"
                        aria-current={
                          phase.id === selectedPhaseId && !selectedScenarioId
                            ? 'true'
                            : undefined
                        }
                        onClick={() => onSelectPhase(phase.id)}
                        className={cn(
                          'flex min-h-11 min-w-0 flex-1 items-center gap-1 rounded-md px-2 py-1.5 text-left font-mono text-xs uppercase tracking-wider',
                          phase.id === selectedPhaseId && !selectedScenarioId
                            ? 'bg-accent text-foreground'
                            : 'text-muted-foreground',
                        )}
                      >
                        <span className="min-w-0 truncate">
                          {ordinalLabel(phase.index, phase.label)}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={
                          expanded
                            ? `Collapse ${phase.label}`
                            : `Expand ${phase.label}`
                        }
                        aria-expanded={expanded}
                        onClick={() => onPhaseExpandedChange(phase.id, !expanded)}
                        className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground"
                      >
                        {expanded ? (
                          <ChevronDown className="size-3.5" aria-hidden />
                        ) : (
                          <ChevronRight className="size-3.5" aria-hidden />
                        )}
                      </button>
                    </div>
                    {expanded
                      ? (scenariosByPhase.get(phase.id) ?? []).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            aria-current={
                              item.id === selectedScenarioId
                                ? 'true'
                                : undefined
                            }
                            onClick={() => onSelectScenario(item.id)}
                            className={cn(
                              'flex min-h-11 items-center justify-between rounded-md py-1.5 pr-2 pl-6 text-left text-sm',
                              item.id === selectedScenarioId
                                ? 'bg-accent font-medium text-foreground'
                                : 'text-foreground/80',
                            )}
                          >
                            <span className="min-w-0 truncate">
                              {getSlideDisplayLabel(item, slides)}
                            </span>
                            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                          </button>
                        ))
                      : null}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

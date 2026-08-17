import { ChevronRight } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { getSlideDisplayLabel, ordinalLabel } from '@/types/nav'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/types/nav'
import type { Slice } from '@/types/database'

/**
 * Navigation: left sheet, phases → scenarios, same progressive disclosure
 * as the desktop sidebar; saved slices above.
 *
 * Extracted from MobileShell as a Phase-2 seam (plan 2026-08-16-002). This
 * component only reports WHAT was tapped — which slice, phase, or scenario.
 * What that means for the visible surface (map vs reader) is the shell's
 * decision, kept in one place so the Phase-3 model ("the thing tapped
 * implies the view") lands as a handler change, not a rewrite here.
 */
export function MobileNavSheet({
  open,
  onOpenChange,
  slices,
  phases,
  scenariosByPhase,
  slides,
  selectedPhaseId,
  selectedScenarioId,
  onSelectSlice,
  onSelectPhase,
  onSelectScenario,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  slices: Slice[]
  phases: NavItem[]
  scenariosByPhase: Map<string, NavItem[]>
  slides: NavItem[]
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
        className="w-72 overflow-y-auto p-0"
      >
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-sm">Blueprint</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-2 py-3">
          {slices.length > 0 ? (
            <div className="flex flex-col">
              <p className="px-2 py-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Slices
              </p>
              {slices.map((slice) => (
                <button
                  key={slice.id}
                  type="button"
                  onClick={() => onSelectSlice(slice.id)}
                  className="flex items-center justify-between rounded-md py-1.5 pr-2 pl-6 text-left text-sm text-foreground/80"
                >
                  <span className="min-w-0 truncate">{slice.title}</span>
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : null}
          {phases.map((phase) => (
            <div key={phase.id} className="flex flex-col">
              <button
                type="button"
                aria-current={
                  phase.id === selectedPhaseId && !selectedScenarioId
                    ? 'true'
                    : undefined
                }
                onClick={() => onSelectPhase(phase.id)}
                className={cn(
                  'flex min-h-11 items-center gap-1 rounded-md px-2 py-1.5 text-left font-mono text-xs uppercase tracking-wider',
                  phase.id === selectedPhaseId && !selectedScenarioId
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {ordinalLabel(phase.index, phase.label)}
              </button>
              {(scenariosByPhase.get(phase.id) ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={
                    item.id === selectedScenarioId ? 'true' : undefined
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
              ))}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

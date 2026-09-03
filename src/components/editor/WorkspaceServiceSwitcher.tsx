import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ORG_NAME } from '@/config'
import { coverContent } from '@/content/coverContent'
import { useActiveService } from '@/contexts/ActiveServiceContext'
import { cn } from '@/lib/utils'

// The workspace's name — the deployment identity, from the one module a
// deployment defines itself in (#305), matching the floating navbar. It is the
// switcher's face: the same name whichever service is active.
const WORKSPACE_NAME = coverContent.title ?? ORG_NAME

type WorkspaceServiceSwitcherProps = {
  /** The base blueprint view is the current view — the tab's selected state. */
  active: boolean
  /** Roving-tablist tab stop: `0` only when this is the tablist's one stop. */
  tabIndex: number
  /** Enter the base blueprint view — today's workspace-tab click. */
  onActivate: () => void
}

/**
 * The top-strip workspace name, which IS the service switcher (#336, #303).
 *
 * With more than one service the name becomes a dropdown trigger — a chevron,
 * a menu of the deployment's services, and picking one makes it active and
 * lands on its board. With exactly one service (every single-service
 * deployment — 80% of them) the switcher is off: the element is byte-for-byte
 * today's workspace tab, no chevron and no menu, the same click that enters the
 * base blueprint view. It is one element in two states, not two components.
 */
export function WorkspaceServiceSwitcher({
  active,
  tabIndex,
  onActivate,
}: WorkspaceServiceSwitcherProps) {
  const { services, service, switchService } = useActiveService()
  const [open, setOpen] = useState(false)

  const containerClass = cn(
    'flex shrink-0 items-center rounded-md border text-xs',
    active
      ? 'border-border bg-background shadow-sm'
      : 'border-transparent hover:bg-accent',
  )
  const textClass = active ? 'text-foreground' : 'text-muted-foreground'

  // The single-service (and no-service) path: identical to the workspace tab
  // that shipped before the switcher. This branch is what keeps a one-service
  // deployment unchanged.
  if (services.length <= 1) {
    return (
      <div className={containerClass}>
        <button
          type="button"
          role="tab"
          aria-selected={active}
          tabIndex={tabIndex}
          onClick={onActivate}
          className={cn('max-w-56 truncate px-2.5 py-1 font-medium', textClass)}
        >
          {WORKSPACE_NAME}
        </button>
      </div>
    )
  }

  const activeSlug = service?.slug ?? null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={containerClass}>
        <PopoverTrigger
          render={
            <button
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={tabIndex}
              data-workspace-switcher=""
              className={cn(
                'flex max-w-56 items-center gap-1 px-2.5 py-1 font-medium',
                textClass,
              )}
            >
              <span className="min-w-0 truncate">{WORKSPACE_NAME}</span>
              <ChevronDown className="size-3 shrink-0" aria-hidden />
            </button>
          }
        />
      </div>
      <PopoverContent align="start" className="w-64 p-1.5">
        <span className="flex w-fit px-2 pb-1 pt-0.5 text-3xs font-semibold uppercase tracking-wider text-muted-foreground">
          Services
        </span>
        <ul className="flex flex-col gap-0.5">
          {services.map((svc) => {
            const isActive = svc.slug === activeSlug
            return (
              <li key={svc.id}>
                <button
                  type="button"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => {
                    setOpen(false)
                    // Picking the already-active service still enters its base
                    // view; the store's slug guard keeps that from refetching.
                    switchService(svc.slug)
                    onActivate()
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent',
                    isActive
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{svc.name}</span>
                  <Check
                    className={cn('size-3.5 shrink-0', !isActive && 'invisible')}
                    aria-hidden
                  />
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

import { useEffect } from 'react'
import { X } from 'lucide-react'
import {
  tabKey,
  useViewState,
  type TabDescriptor,
} from '@/contexts/viewStateStore'
import { useSlices } from '@/hooks/useSlices'
import { cn } from '@/lib/utils'
import type { Slice } from '@/types/database'

function availableSlices(result: ReturnType<typeof useSlices>): Slice[] {
  switch (result.status) {
    case 'loading':
      return []
    case 'ready':
      return result.data
    case 'error':
      return result.fallback ?? []
  }
}

/**
 * Tab strip above the shell main area. Visible only when more than the
 * pinned blueprint tab is open; also resolves URL deep links once the slice
 * list settles (pending intent — never applied before the data exists).
 */
export function TabStrip() {
  const {
    tabs,
    activeKey,
    activateTab,
    closeTab,
    pendingUrlState,
    resolvePending,
  } = useViewState()
  const slices = useSlices()

  useEffect(() => {
    if (pendingUrlState === null) return
    if (slices.status === 'loading') return
    resolvePending(availableSlices(slices).map((slice) => slice.id))
  }, [pendingUrlState, resolvePending, slices])

  if (tabs.length <= 1) return null

  const titleById = new Map(
    availableSlices(slices).map((slice) => [slice.id, slice.title]),
  )

  const labelFor = (tab: TabDescriptor): string => {
    switch (tab.kind) {
      case 'blueprint':
        return 'Blueprint'
      case 'slice':
        return `◇ ${titleById.get(tab.sliceId) ?? 'Slice'}`
      case 'present':
        return `▶ ${titleById.get(tab.sliceId) ?? 'Slice'}`
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Open views"
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-sidebar px-2 py-1.5"
    >
      {tabs.map((tab) => {
        const key = tabKey(tab)
        const active = key === activeKey
        const label = labelFor(tab)
        return (
          <div
            key={key}
            className={cn(
              'flex shrink-0 items-center rounded-md border text-xs',
              active
                ? 'border-border bg-background shadow-sm'
                : 'border-transparent hover:bg-accent',
            )}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => activateTab(key)}
              className={cn(
                'max-w-56 truncate px-2.5 py-1 font-medium',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {label}
            </button>
            {tab.kind !== 'blueprint' && (
              <button
                type="button"
                aria-label={`Close ${label}`}
                onClick={() => closeTab(key)}
                className="mr-1 rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

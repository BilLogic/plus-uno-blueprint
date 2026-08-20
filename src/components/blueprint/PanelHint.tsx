import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/**
 * An explanation that is available, not imposed.
 *
 * These started as `alert.tsx` banners sitting permanently in the panel body
 * — a tinted box explaining, forever, something a reader needs at most once.
 * A note that cannot be put away competes with the fields it is describing
 * every time the panel opens.
 *
 * So: base-ui's popover, which dismisses the way everything else in this app
 * dismisses (click away, Escape) and takes no space while closed. The trigger
 * is the same ⓘ used everywhere else, and it names itself for the screen
 * reader while the tooltip says what it does.
 */
export function PanelHint({
  label,
  children,
  side = 'left',
}: {
  /** What the ⓘ opens, e.g. "Why view type is not here". */
  label: string
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
}) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label={label}
                  className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground/60 transition-colors duration-(--motion-micro) hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <Info className="size-3" aria-hidden />
                </button>
              }
            />
          }
        />
        <TooltipContent side={side} className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
      <PopoverContent side={side} align="start" className="w-64 text-xs">
        {children}
      </PopoverContent>
    </Popover>
  )
}

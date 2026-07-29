import { ScanEye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useViewState } from '@/contexts/viewStateStore'

/** Feature const — follows the SHOW_CELL_DEPENDENCIES precedent. */
const SHOW_ASSUMPTION_LENS = true

/**
 * Toolbar toggle for the assumption lens. Cells without evidence get a
 * warning tint while active; counts come from the public evidence_counts
 * view, so the lens works for anonymous viewers too. Disabled with a
 * tooltip when no database is configured (no counts to show).
 */
export function AssumptionLensToggle() {
  const { configured, client } = useSupabase()
  const { lens, setLens } = useViewState()

  if (!SHOW_ASSUMPTION_LENS) return null

  const available = configured && client !== null
  const active = lens === 'assumption'

  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!available}
      aria-pressed={active}
      className="pointer-events-auto gap-1.5 text-xs"
      onClick={() => setLens(active ? null : 'assumption')}
    >
      <ScanEye className="size-3.5" />
      Lens: assumptions
    </Button>
  )

  if (available) return button

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="pointer-events-auto inline-flex">{button}</span>}
      />
      <TooltipContent side="bottom">
        Evidence counts are unavailable without a database connection.
      </TooltipContent>
    </Tooltip>
  )
}

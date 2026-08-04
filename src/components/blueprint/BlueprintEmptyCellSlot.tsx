import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useCanvasModeValue } from '@/contexts/canvasModeContext'
import { useAtScenarioLevel } from '@/contexts/EditorContext'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import { upsertCell } from '@/lib/authoringRpc'
import { cn } from '@/lib/utils'

/**
 * An empty square, in Edit mode, as somewhere a cell can go.
 *
 * The `+` is revealed on hover rather than drawn permanently, and that is the
 * whole design of this component. A blueprint is a few hundred squares and most
 * of them are empty; a grid of plus signs would be unreadable, and a square
 * that writes a row on any stray click would fire constantly while panning and
 * picking. Hover-then-click keeps creation to one click without making the
 * click cheap.
 *
 * The position *is* the argument. There is no dialog because there is nothing
 * to ask: a cell at (lane, step) is fully specified by the square that was
 * pointed at, and its text is typed in place afterwards.
 */
export function BlueprintEmptyCellSlot({
  pathId,
  layerId,
  stepId,
  width,
  minHeight,
  selfStretch = false,
}: {
  pathId: string
  layerId: string
  stepId: string
  width: number
  /** Single-path grid sizes rows explicitly; the compare grid stretches. */
  minHeight?: number
  selfStretch?: boolean
}) {
  const mode = useCanvasModeValue()
  const { client, canWrite } = useSupabase()
  const atScenarioLevel = useAtScenarioLevel()
  const [busy, setBusy] = useState(false)

  const style = {
    width,
    minWidth: width,
    maxWidth: width,
    ...(minHeight === undefined ? {} : { minHeight }),
  }
  const stretch = selfStretch ? 'self-stretch' : ''

  if (mode !== 'design' || !canWrite || !client || !atScenarioLevel) {
    return <div aria-hidden className={cn('shrink-0', stretch)} style={style} />
  }

  const create = async () => {
    if (busy) return
    setBusy(true)
    try {
      // Empty content: the cell exists so it can be typed into, and inventing
      // placeholder text here is how "Untitled" ends up in a blueprint someone
      // presents. The grid re-reads because a new cell changes the layout.
      await upsertCell(client, { pathId, layerId, stepId, content: '' })
      invalidateQueries('lifecycle-phases')
      invalidateQueries('canvas-blueprints')
    } catch (error) {
      console.error('[authoring] upsert_cell failed:', error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      aria-label="Add a cell here"
      title="Add a cell here"
      onClick={(event) => {
        event.stopPropagation()
        void create()
      }}
      data-blueprint-empty-slot=""
      className={cn(
        'group/slot shrink-0 rounded-md border border-dashed border-transparent',
        stretch,
        'grid place-items-center transition-colors',
        'hover:border-primary/50 hover:bg-primary/5',
        'focus-visible:border-primary/50 focus-visible:outline-none',
      )}
      style={style}
    >
      <span
        aria-hidden
        className="grid size-4 place-items-center rounded-full bg-primary/80 text-primary-foreground opacity-0 transition-opacity group-hover/slot:opacity-100 group-focus-visible/slot:opacity-100"
      >
        <Plus className="size-2.5" />
      </span>
    </button>
  )
}

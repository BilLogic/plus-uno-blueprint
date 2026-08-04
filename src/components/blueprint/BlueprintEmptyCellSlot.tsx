import { useRef, useState } from 'react'
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
 * picking.
 *
 * The click opens an inline text field and **Enter** creates. It used to
 * create immediately with empty content, and that was the "creating a cell
 * does nothing" bug: the grid hides cells with no text (an empty box is
 * indistinguishable from a gap), so the row landed in the database and the
 * square looked exactly as empty as before. A cell is born with its text or
 * not at all — the same rule the lane handles follow with names.
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
  const [naming, setNaming] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
    const trimmed = text.trim()
    if (busy || !trimmed) return
    setBusy(true)
    try {
      await upsertCell(client, { pathId, layerId, stepId, content: trimmed })
      // The grid re-reads because a new cell changes the layout.
      invalidateQueries('lifecycle-phases')
      invalidateQueries('canvas-blueprints')
      setNaming(false)
      setText('')
    } catch (error) {
      console.error('[authoring] upsert_cell failed:', error)
    } finally {
      setBusy(false)
    }
  }

  if (naming) {
    return (
      <div
        className={cn('relative shrink-0', stretch)}
        style={style}
        data-blueprint-empty-slot=""
        onPointerDown={(event) => event.stopPropagation()}
      >
        <textarea
          ref={inputRef}
          value={text}
          autoFocus
          disabled={busy}
          placeholder="Cell text…"
          rows={2}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void create()
            }
            if (event.key === 'Escape') {
              setNaming(false)
              setText('')
            }
          }}
          onBlur={() => {
            // A click elsewhere abandons quietly; Enter is the commit.
            if (!busy) {
              setNaming(false)
              setText('')
            }
          }}
          className={cn(
            'absolute inset-0 h-full w-full resize-none rounded-md border border-primary/60',
            'bg-background px-1.5 py-1 text-[10px] leading-snug outline-none',
            'placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/40',
          )}
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      aria-label="Add a cell here"
      title="Add a cell here"
      onClick={(event) => {
        event.stopPropagation()
        setNaming(true)
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

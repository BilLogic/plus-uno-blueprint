import { useState, type DragEvent } from 'react'
import { GripVertical, SplitSquareHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSupabase } from '@/contexts/SupabaseProvider'
import {
  insertSliceItem,
  renumberSliceItems,
  updateSliceItem,
} from '@/lib/sliceMutations'
import { cn } from '@/lib/utils'
import type { Slice, SliceItem } from '@/types/database'

/** Paired cell_keys for a subset; repairs mismatched rows with id placeholders. */
function pairedKeys(item: SliceItem, cellIds: readonly string[]): string[] {
  if (item.cell_keys.length !== item.cell_ids.length) return [...cellIds]
  return cellIds.map((cellId) => {
    const index = item.cell_ids.indexOf(cellId)
    return index >= 0 ? item.cell_keys[index] : cellId
  })
}

type SliceEditBarProps = {
  slice: Slice
  /** Position-sorted frames. */
  items: readonly SliceItem[]
  /** Successful write — flip origin and refetch upstream. */
  onAfterEdit: () => void
  /** Concurrency conflict — `rowGone` when the frame was deleted. */
  onConflict: (rowGone: boolean) => void
  onError: (message: string) => void
}

/**
 * Filmstrip-like frame editor shown in slice edit mode: drag to reorder
 * frames, click captions/narratives to edit inline, split a frame in half.
 */
export function SliceEditBar({
  slice,
  items,
  onAfterEdit,
  onConflict,
  onError,
}: SliceEditBarProps) {
  const { client } = useSupabase()
  const [busy, setBusy] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [editingField, setEditingField] = useState<{
    itemId: string
    field: 'caption' | 'narrative'
  } | null>(null)

  if (!client) return null

  const run = async (action: () => Promise<boolean>) => {
    if (busy) return
    setBusy(true)
    try {
      const changed = await action()
      if (changed) onAfterEdit()
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const saveField = (
    item: SliceItem,
    field: 'caption' | 'narrative',
    value: string,
  ) => {
    setEditingField(null)
    const trimmed = value.trim()
    const current = item[field] ?? ''
    if (trimmed === current.trim()) return
    void run(async () => {
      const outcome = await updateSliceItem(client, item, {
        [field]: trimmed.length > 0 ? trimmed : null,
      })
      if (outcome.conflict) {
        onConflict(outcome.current === null)
        return false
      }
      return true
    })
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>, dropIndex: number) => {
    event.preventDefault()
    const fromIndex = dragIndex
    setDragIndex(null)
    if (fromIndex === null || fromIndex === dropIndex) return

    const reordered = [...items]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(dropIndex, 0, moved)

    void run(async () => {
      const complete = await renumberSliceItems(client, reordered)
      if (!complete) {
        onConflict(false)
        return false
      }
      return true
    })
  }

  const handleSplit = (item: SliceItem) => {
    if (item.cell_ids.length < 2) return
    const half = Math.ceil(item.cell_ids.length / 2)
    const firstIds = item.cell_ids.slice(0, half)
    const secondIds = item.cell_ids.slice(half)

    void run(async () => {
      const outcome = await updateSliceItem(client, item, {
        cell_ids: firstIds,
        cell_keys: pairedKeys(item, firstIds),
      })
      if (outcome.conflict) {
        onConflict(outcome.current === null)
        return false
      }

      const maxPosition = items.reduce(
        (max, entry) => Math.max(max, entry.position),
        0,
      )
      const inserted = await insertSliceItem(client, {
        slice_id: slice.id,
        position: maxPosition + 1,
        cell_ids: secondIds,
        cell_keys: pairedKeys(item, secondIds),
      })

      // Renumber so the new frame lands right after the split frame.
      const ordered = items.flatMap((entry) => {
        if (entry.id === item.id) return [outcome.row, inserted]
        return [entry]
      })
      const complete = await renumberSliceItems(client, ordered)
      if (!complete) {
        onConflict(false)
        return false
      }
      return true
    })
  }

  return (
    <div
      className={cn(
        'shrink-0 overflow-x-auto border-b border-border bg-muted/30 px-4 py-3',
        busy && 'pointer-events-none opacity-60',
      )}
    >
      <div className="flex items-stretch gap-3">
        {items.map((item, index) => {
          const editingCaption =
            editingField?.itemId === item.id &&
            editingField.field === 'caption'
          const editingNarrative =
            editingField?.itemId === item.id &&
            editingField.field === 'narrative'
          return (
            <div
              key={item.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, index)}
              className={cn(
                'flex w-56 shrink-0 flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5 shadow-sm',
                dragIndex === index && 'opacity-50',
              )}
            >
              <div className="flex items-center gap-1.5">
                <GripVertical
                  className="size-3.5 shrink-0 cursor-grab text-muted-foreground"
                  aria-hidden
                />
                <span className="text-[11px] font-medium text-muted-foreground">
                  Frame {index + 1} · {item.cell_ids.length}{' '}
                  {item.cell_ids.length === 1 ? 'cell' : 'cells'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Split frame"
                  title="Split frame"
                  disabled={item.cell_ids.length < 2}
                  onClick={() => handleSplit(item)}
                >
                  <SplitSquareHorizontal className="size-3.5" />
                </Button>
              </div>
              {editingCaption ? (
                <input
                  autoFocus
                  defaultValue={item.caption ?? ''}
                  placeholder="Caption"
                  aria-label="Frame caption"
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                  onBlur={(event) =>
                    saveField(item, 'caption', event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur()
                    }
                    if (event.key === 'Escape') setEditingField(null)
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="truncate text-left text-xs font-medium text-foreground hover:underline"
                  onClick={() =>
                    setEditingField({ itemId: item.id, field: 'caption' })
                  }
                >
                  {item.caption?.trim() || 'Add caption…'}
                </button>
              )}
              {editingNarrative ? (
                <textarea
                  autoFocus
                  defaultValue={item.narrative ?? ''}
                  placeholder="Narrative"
                  aria-label="Frame narrative"
                  rows={3}
                  className="w-full resize-none rounded-md border border-border bg-background px-2 py-1 text-xs leading-snug outline-none focus:ring-1 focus:ring-ring"
                  onBlur={(event) =>
                    saveField(item, 'narrative', event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setEditingField(null)
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="line-clamp-2 text-left text-[11px] leading-snug text-muted-foreground hover:underline"
                  onClick={() =>
                    setEditingField({ itemId: item.id, field: 'narrative' })
                  }
                >
                  {item.narrative?.trim() || 'Add narrative…'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

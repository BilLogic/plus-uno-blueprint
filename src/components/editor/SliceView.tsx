import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type MouseEvent,
} from 'react'
import { Pencil } from 'lucide-react'
import { ServiceBlueprintGrid } from '@/components/blueprint/ServiceBlueprintGrid'
import { SliceFocusOverlay } from '@/components/blueprint/SliceFocusOverlay'
import { SliceEditBar } from '@/components/editor/SliceEditBar'
import { Button } from '@/components/ui/button'
import { InlineNotice } from '@/components/ui/inline-notice'
import { SliceMembershipContext } from '@/contexts/sliceMembershipContext'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useScenarioBlueprint } from '@/hooks/useScenarioBlueprint'
import { useSlice, type SliceDetail } from '@/hooks/useSlice'
import { useSliceScenarioId } from '@/hooks/useSliceScenarioId'
import {
  insertSliceItem,
  markSliceCustomized,
  updateSliceItem,
} from '@/lib/sliceMutations'
import { resolveBlueprintCellId } from '@/lib/resolveBlueprintCellId'
import {
  orderedSliceCellIds,
  pickBlueprintForCells,
  resolveSliceCells,
} from '@/lib/sliceCells'
import { cn } from '@/lib/utils'
import type { SliceItem } from '@/types/database'

type SliceFocusContextValue = {
  focused: boolean
  setFocused: (focused: boolean) => void
}

/** Per-view focus state — local to the slice tab, never global. */
const SliceFocusContext = createContext<SliceFocusContextValue | null>(null)

function useSliceFocus(): SliceFocusContextValue {
  const context = useContext(SliceFocusContext)
  if (!context) {
    throw new Error('useSliceFocus must be used within SliceView')
  }
  return context
}

/** Paired cell_keys for a subset; repairs mismatched rows with id placeholders. */
function pairedKeysWithout(item: SliceItem, removeIndex: number): string[] {
  if (item.cell_keys.length !== item.cell_ids.length) {
    return item.cell_ids.filter((_, index) => index !== removeIndex)
  }
  return item.cell_keys.filter((_, index) => index !== removeIndex)
}

type SliceViewProps = {
  sliceId: string
}

export function SliceView({ sliceId }: SliceViewProps) {
  const { client, canWrite } = useSupabase()
  const [reloadToken, setReloadToken] = useState(0)
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const result = useSlice(sliceId, reloadToken)
  const detail: SliceDetail | null =
    result.status === 'ready'
      ? result.data
      : result.status === 'error'
        ? result.fallback
        : null

  const items = useMemo(
    () => [...(detail?.items ?? [])].sort((a, b) => a.position - b.position),
    [detail],
  )
  const cellIds = useMemo(() => orderedSliceCellIds(items), [items])

  const scenarioResult = useSliceScenarioId(cellIds)
  const scenarioId =
    scenarioResult.status === 'ready'
      ? scenarioResult.data
      : scenarioResult.status === 'error'
        ? (scenarioResult.fallback ?? undefined)
        : undefined

  const { allBlueprints, loading: blueprintLoading } =
    useScenarioBlueprint(scenarioId)

  const blueprint = useMemo(
    () => pickBlueprintForCells(allBlueprints, cellIds),
    [allBlueprints, cellIds],
  )
  const resolution = useMemo(
    () => resolveSliceCells(blueprint, items),
    [blueprint, items],
  )

  const [focused, setFocused] = useState(true)
  const focusValue = useMemo(() => ({ focused, setFocused }), [focused])

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  const handleConflict = useCallback(
    (rowGone: boolean) => {
      setNotice(
        rowGone
          ? 'That frame was deleted elsewhere — reloading the slice.'
          : 'This slice changed elsewhere — reloading the latest version.',
      )
      reload()
    },
    [reload],
  )

  const afterEdit = useCallback(() => {
    setNotice(null)
    if (client && detail) {
      void markSliceCustomized(client, detail.slice).catch(() => {
        // Origin flip is best effort; the reload below refetches either way.
      })
    }
    reload()
  }, [client, detail, reload])

  /** Edit mode: clicking any grid cell toggles slice membership. */
  const toggleMembership = useCallback(
    async (clickedCellId: string) => {
      if (!client || !detail || saving) return
      const resolved = resolveBlueprintCellId(clickedCellId)
      const matches = (id: string) =>
        id === clickedCellId || resolveBlueprintCellId(id) === resolved

      setSaving(true)
      try {
        const owner = items.find((item) => item.cell_ids.some(matches))
        if (owner) {
          const removeIndex = owner.cell_ids.findIndex(matches)
          const outcome = await updateSliceItem(client, owner, {
            cell_ids: owner.cell_ids.filter(
              (_, index) => index !== removeIndex,
            ),
            cell_keys: pairedKeysWithout(owner, removeIndex),
          })
          if (outcome.conflict) {
            handleConflict(outcome.current === null)
            return
          }
        } else {
          const last = items[items.length - 1]
          if (last) {
            const outcome = await updateSliceItem(client, last, {
              cell_ids: [...last.cell_ids, resolved],
              // TODO(map-skill): id placeholder — real IR key-paths come
              // from the slice skill.
              cell_keys:
                last.cell_keys.length === last.cell_ids.length
                  ? [...last.cell_keys, resolved]
                  : [...last.cell_ids, resolved],
            })
            if (outcome.conflict) {
              handleConflict(outcome.current === null)
              return
            }
          } else {
            await insertSliceItem(client, {
              slice_id: detail.slice.id,
              position: 1,
              cell_ids: [resolved],
              cell_keys: [resolved],
            })
          }
        }
        afterEdit()
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error))
      } finally {
        setSaving(false)
      }
    },
    [afterEdit, client, detail, handleConflict, items, saving],
  )

  // Clicking a member cell (re-)focuses; clicking anywhere else in the grid
  // lifts the scrim. Badges and member outlines stay either way. In edit
  // mode clicks toggle membership instead.
  const handleGridAreaClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target =
        event.target instanceof HTMLElement ? event.target : null
      if (editing) {
        const cellId = target
          ?.closest('[data-blueprint-cell]')
          ?.getAttribute('data-blueprint-cell')
        if (cellId) void toggleMembership(cellId)
        return
      }
      setFocused(Boolean(target?.closest('[data-slice-member]')))
    },
    [editing, toggleMembership],
  )

  if (result.status === 'loading') {
    return <SliceViewMessage>Loading slice…</SliceViewMessage>
  }

  if (!detail) {
    // The slice may have been deleted (possibly by another session) — close
    // any tabs pointing at it is left to the tab menu; show the message.
    return (
      <SliceViewMessage>
        {result.status === 'error'
          ? `This slice could not be loaded: ${result.message}`
          : 'This slice could not be loaded.'}
      </SliceViewMessage>
    )
  }

  const loadingBlueprint =
    scenarioResult.status === 'loading' || blueprintLoading

  const canEdit = canWrite && result.status === 'ready'
  const scrimFocused = focused && !editing

  return (
    <SliceFocusContext.Provider value={focusValue}>
      <SliceMembershipContext.Provider value={resolution.memberCellIds}>
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex shrink-0 flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">
              <span aria-hidden>◇ </span>
              {detail.slice.title}
            </h2>
            {detail.slice.description && (
              <p className="text-xs text-muted-foreground">
                {detail.slice.description}
              </p>
            )}
            <span className="ml-auto flex items-center gap-2">
              {resolution.missingCellIds.length > 0 && (
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {resolution.missingCellIds.length}{' '}
                  {resolution.missingCellIds.length === 1 ? 'cell' : 'cells'} no
                  longer in the blueprint
                </span>
              )}
              {canEdit && (
                <Button
                  type="button"
                  variant={editing ? 'secondary' : 'ghost'}
                  size="icon-xs"
                  aria-pressed={editing}
                  aria-label={editing ? 'Done editing' : 'Edit slice'}
                  title={editing ? 'Done editing' : 'Edit slice'}
                  className="shrink-0"
                  onClick={() => {
                    setNotice(null)
                    setEditing((value) => !value)
                  }}
                >
                  <Pencil className="size-3.5" />
                </Button>
              )}
            </span>
            {notice && (
              <InlineNotice variant="warning" className="w-full">
                {notice}
              </InlineNotice>
            )}
            {editing && (
              <p className="w-full text-[11px] text-muted-foreground">
                Editing — click any blueprint cell to add or remove it from
                this slice.
              </p>
            )}
          </header>

          {editing && (
            <SliceEditBar
              slice={detail.slice}
              items={items}
              onAfterEdit={afterEdit}
              onConflict={handleConflict}
              onError={setNotice}
            />
          )}

          <div className="relative min-h-0 flex-1">
            <div
              className="h-full overflow-auto p-4"
              data-slice-focus={scrimFocused ? 'focused' : 'idle'}
              {...(editing ? { 'data-slice-editing': '' } : {})}
              onClick={handleGridAreaClick}
            >
              {blueprint ? (
                <ServiceBlueprintGrid
                  data={blueprint}
                  focusOverlay={
                    <SliceFocusOverlay
                      blueprint={blueprint}
                      placements={resolution.placements}
                      focused={scrimFocused}
                    />
                  }
                />
              ) : (
                <p className="p-6 text-sm text-muted-foreground">
                  {loadingBlueprint
                    ? 'Loading blueprint…'
                    : 'The cells in this slice could not be found in any blueprint.'}
                </p>
              )}
            </div>
            {blueprint && !editing && <SliceFocusPill />}
          </div>
        </div>
      </SliceMembershipContext.Provider>
    </SliceFocusContext.Provider>
  )
}

function SliceFocusPill() {
  const { focused, setFocused } = useSliceFocus()

  return (
    <button
      type="button"
      aria-pressed={focused}
      onClick={(event) => {
        event.stopPropagation()
        setFocused(!focused)
      }}
      className={cn(
        'absolute bottom-4 left-4 z-50 rounded-full border px-3 py-1.5 text-xs font-medium shadow-md transition-colors',
        focused
          ? 'border-transparent bg-foreground text-background'
          : 'border-border bg-card text-foreground hover:bg-accent',
      )}
    >
      <span aria-hidden>◇ </span>
      Slice focus
    </button>
  )
}

function SliceViewMessage({ children }: { children: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

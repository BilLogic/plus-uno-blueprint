import { useState } from 'react'
import { ExternalLink, Play, Trash2 } from 'lucide-react'
import { DeleteSliceDialog } from '@/components/editor/TabStrip'
import { SIDEBAR_SECTION_TRIGGER_CLASS } from '@/components/editor/SlideModeView'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  SidebarGroup,
  SidebarGroupContent,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useViewState } from '@/contexts/viewStateStore'
import { useSlices, type SliceListEntry } from '@/hooks/useSlices'

/** Sidebar group order — unknown types fall into CUSTOM. */
const SLICE_TYPE_GROUPS = ['journey', 'step', 'lane', 'cell', 'custom'] as const

type SliceTypeGroup = (typeof SLICE_TYPE_GROUPS)[number]

function sliceTypeGroup(sliceType: string): SliceTypeGroup {
  const type = sliceType.toLowerCase()
  return SLICE_TYPE_GROUPS.find((group) => group === type) ?? 'custom'
}

function SliceRow({
  slice,
  isActive,
  isOpenInactive,
  onOpen,
  onPresent,
  onDelete,
  canWrite,
}: {
  slice: SliceListEntry
  /** This slice's tab is the active one. */
  isActive: boolean
  /** This slice has an open tab that is not the active one. */
  isOpenInactive: boolean
  onOpen: () => void
  onPresent: () => void
  onDelete: () => void
  canWrite: boolean
}) {
  const row = (
    <button
      type="button"
      aria-current={isActive ? 'true' : undefined}
      // Same three-state language as the Phases section (nav plan D8): the
      // active tab gets the selected fill + rail, an open-but-inactive tab
      // gets the marker dot, everything else is plain.
      className={cn(
        'relative flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
        isActive
          ? 'bg-sidebar-selected font-medium text-sidebar-selected-foreground before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-selected-rail'
          : 'hover:bg-sidebar-hover hover:text-sidebar-accent-foreground',
        !isActive &&
          (isOpenInactive
            ? 'text-sidebar-foreground before:absolute before:top-1/2 before:left-0.5 before:size-1 before:-translate-y-1/2 before:rounded-full before:bg-sidebar-ancestor'
            : 'text-sidebar-foreground/85'),
      )}
      onClick={onOpen}
    >
      <span aria-hidden>◇</span>
      <span className="min-w-0 flex-1 truncate">{slice.title}</span>
    </button>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger render={row} />
      <ContextMenuContent>
        <ContextMenuItem onClick={onOpen}>
          <ExternalLink className="size-3.5" />
          Open in new tab
        </ContextMenuItem>
        <ContextMenuItem onClick={onPresent}>
          <Play className="size-3.5" />
          Present
        </ContextMenuItem>
        {canWrite ? (
          <ContextMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="size-3.5" />
            Delete slice…
          </ContextMenuItem>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * Slices sidebar mode — the lifecycle's slices grouped by `slice_type` into
 * accordion sections (JOURNEY / STEP / LANE / CELL / CUSTOM; only non-empty
 * groups render, all open by default). Click (or the context menu) opens the
 * slice tab; writers can delete from the context menu.
 */
export function SlicesSidebarSection() {
  const slices = useSlices()
  const { openTab, tabs, activeKey } = useViewState()
  const { canWrite } = useSupabase()
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    title: string
  } | null>(null)
  // Tracked as the *collapsed* set rather than the open one: a group the
  // user never touched stays open even when it first appears (slices load
  // late, new types get created), while an explicit collapse survives the
  // list changing under it. The old `key={groups.join('|')}` remount reset
  // every group whenever a slice was created or deleted.
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  )

  const rows: SliceListEntry[] =
    slices.status === 'ready'
      ? slices.data
      : slices.status === 'error'
        ? (slices.fallback ?? [])
        : []

  const groups = SLICE_TYPE_GROUPS.map((type) => ({
    type,
    slices: rows.filter((slice) => sliceTypeGroup(slice.slice_type) === type),
  })).filter((group) => group.slices.length > 0)

  if (groups.length === 0) {
    return (
      <p className="px-3 py-1.5 text-xs text-sidebar-foreground/50">
        No slices yet.
      </p>
    )
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <Accordion
          // Base UI defaults to single-open, so without this collapsing one
          // group silently closed every other one.
          multiple
          value={groups
            .map((group) => group.type)
            .filter((type) => !collapsedGroups.has(type))}
          onValueChange={(value) => {
            const open = new Set(value.map(String))
            setCollapsedGroups(
              new Set(
                groups
                  .map((group) => group.type)
                  .filter((type) => !open.has(type)),
              ),
            )
          }}
          className="border-0"
        >
          {groups.map((group) => (
            <AccordionItem
              key={group.type}
              value={group.type}
              className="border-0"
            >
              <AccordionTrigger className={SIDEBAR_SECTION_TRIGGER_CLASS}>
                {group.type}
              </AccordionTrigger>
              <AccordionContent className="pb-1">
                <ul className="flex flex-col gap-0.5">
                  {group.slices.map((slice) => (
                    <li key={slice.id}>
                      <SliceRow
                        slice={slice}
                        isActive={
                          activeKey === `slice:${slice.id}` ||
                          activeKey === `present:${slice.id}`
                        }
                        isOpenInactive={
                          activeKey !== `slice:${slice.id}` &&
                          activeKey !== `present:${slice.id}` &&
                          tabs.some((tab) => tab.sliceId === slice.id)
                        }
                        canWrite={canWrite}
                        onOpen={() =>
                          openTab({ kind: 'slice', sliceId: slice.id })
                        }
                        onPresent={() =>
                          openTab({ kind: 'present', sliceId: slice.id })
                        }
                        onDelete={() =>
                          setDeleteTarget({ id: slice.id, title: slice.title })
                        }
                      />
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <DeleteSliceDialog
          slice={deleteTarget}
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
        />
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

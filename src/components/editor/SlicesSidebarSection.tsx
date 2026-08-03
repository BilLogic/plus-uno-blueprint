import { useState } from 'react'
import { ExternalLink, Play, Trash2 } from 'lucide-react'
import { DeleteSliceDialog } from '@/components/editor/TabStrip'
import { NavRow, NavSection } from '@/components/editor/SidebarNav'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useCanvasModeValue } from '@/contexts/canvasModeContext'
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
  // Same row component, states and indent as the Phases tree: the active tab
  // gets the selected fill + rail, an open-but-inactive tab gets the marker
  // dot, everything else is plain.
  const row = (
    <NavRow
      label={slice.title}
      icon="◇"
      size="sm"
      onSelect={onOpen}
      selected={isActive}
      ancestor={isOpenInactive}
    />
  )

  return (
    <ContextMenu>
      {/* A plain wrapper takes the trigger's props: NavRow renders two
          sibling buttons, so there is no single element to merge them onto. */}
      <ContextMenuTrigger className="block w-full">{row}</ContextMenuTrigger>
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
  // Edit mode only, like every other authoring affordance in this sidebar.
  const mode = useCanvasModeValue()
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
    <div className="flex flex-col">
      {groups.map((group) => (
        <NavSection
          key={group.type}
          title={group.type}
          open={!collapsedGroups.has(group.type)}
          onOpenChange={(open) =>
            setCollapsedGroups((collapsed) => {
              const next = new Set(collapsed)
              if (open) next.delete(group.type)
              else next.add(group.type)
              return next
            })
          }
        >
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
                  canWrite={canWrite && mode === 'design'}
                  onOpen={() => openTab({ kind: 'slice', sliceId: slice.id })}
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
        </NavSection>
      ))}
      <DeleteSliceDialog
        slice={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      />
    </div>
  )
}

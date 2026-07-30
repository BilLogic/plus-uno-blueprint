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
  onOpen,
  onPresent,
  onDelete,
  canWrite,
}: {
  slice: SliceListEntry
  onOpen: () => void
  onPresent: () => void
  onDelete: () => void
  canWrite: boolean
}) {
  const row = (
    <button
      type="button"
      className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
  const { openTab } = useViewState()
  const { canWrite } = useSupabase()
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    title: string
  } | null>(null)

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
          // Remount when the group set changes so late-loading groups still
          // pick up the open-by-default value.
          key={groups.map((group) => group.type).join('|')}
          defaultValue={groups.map((group) => group.type)}
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

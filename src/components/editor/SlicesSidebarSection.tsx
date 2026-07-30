import { useState } from 'react'
import { ExternalLink, Play, Trash2 } from 'lucide-react'
import { DeleteSliceDialog } from '@/components/editor/TabStrip'
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
      <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-px text-[10px] leading-tight text-muted-foreground">
        {slice.slice_type}
      </span>
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
 * "Slices" accordion section in the sidebar nav — lists the lifecycle's
 * slices by position; click (or the context menu) opens the slice tab,
 * writers can delete from the context menu.
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

  if (rows.length === 0) return null

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <Accordion defaultValue={['slices']} className="border-0">
          <AccordionItem value="slices" className="border-0">
            <AccordionTrigger className="px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70 hover:no-underline">
              Slices
            </AccordionTrigger>
            <AccordionContent className="pb-1">
              <ul className="flex flex-col gap-0.5">
                {rows.map((slice) => (
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

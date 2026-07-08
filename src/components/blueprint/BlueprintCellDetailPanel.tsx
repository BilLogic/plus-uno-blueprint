import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ExternalLink, X } from 'lucide-react'
import { VisualStepDetailStack } from '@/components/blueprint/VisualStepDetailStack'
import { PathLabelBadge } from '@/components/blueprint/PathLabelBadge'
import { Button } from '@/components/ui/button'
import { useBlueprintCellDetail } from '@/contexts/BlueprintCellDetailContext'
import {
  buildBlueprintCellSelectionForId,
  getBlueprintCellConnections,
  getBlueprintForPath,
  getDirectedConnections,
  getDirectedInteractions,
  getFlowConnections,
  getLinkedTechFromConnections,
  getSelectedCellLayerRowPosition,
  scrollBlueprintCellIntoView,
  type FlowConnectionDirection,
  type FlowInteractionDirection,
} from '@/lib/blueprintCellConnections'
import {
  buildTechPillSelectionForItem,
  getBlueprintStepTechItems,
  scrollBlueprintTechPillIntoView,
} from '@/lib/blueprintStepTech'
import {
  getBlueprintCellInteractionStyle,
} from '@/lib/blueprintCellStyle'
import { shouldUsePillCellContent, shouldUseVisualContent, abbreviateConnectionLayerName } from '@/lib/blueprintLayout'
import { getTechPillStyle } from '@/lib/techPillTheme'
import { resolveCellDetailPictures } from '@/lib/blueprintTechPictures'
import {
  resolveTechCellDetailLabel,
  resolveTechCellDetailText,
  resolveTechCellDetailUrl,
  URL_LINK_TYPE,
} from '@/lib/blueprintTechDescriptions'
import { resolveVisualStepPictureEntries } from '@/lib/visualWalkthrough'
import { cn } from '@/lib/utils'
import type { BlueprintCellConnection } from '@/lib/blueprintCellConnections'

/** Fixed panel and illustration frame so every row/step uses the same size. */
const CELL_DETAIL_PANEL_WIDTH_CLASS = 'w-[20rem]'
const CELL_DETAIL_PICTURE_FRAME_CLASS =
  'relative aspect-[4/3] w-[19rem] max-w-full shrink-0'
const CELL_DETAIL_PICTURE_CLASS =
  'absolute inset-0 h-full w-full object-contain object-center'

const DETAIL_META_CLASS =
  'text-[10px] font-medium leading-none text-muted-foreground/65'

const FLOW_COLUMN_TITLE_CLASS =
  'text-[11px] font-semibold leading-none text-muted-foreground/80'

type PanelTechEntry = {
  id: string
  cellId: string
  item: string
}

function TechPill({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  const fill = getTechPillStyle(label).backgroundColor

  return (
    <Button
      type="button"
      variant="blueprintPill"
      size="xs"
      data-blueprint-tech-pill={label}
      className={cn(
        'h-auto min-h-0 w-auto max-w-full shrink-0 rounded-full',
        'px-1.5 py-px text-[10px] font-normal leading-tight',
        'whitespace-normal shadow-none aria-pressed:ring-1',
      )}
      style={getBlueprintCellInteractionStyle(fill) as CSSProperties}
      onClick={onClick}
    >
      {label}
    </Button>
  )
}

function FlowInteractionLink({
  label,
  direction,
  onClick,
}: {
  label: string
  direction: FlowInteractionDirection
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={`Interaction with ${label}`}
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-0.5 text-right text-[11px] leading-snug',
        'font-medium text-foreground/85 transition-colors hover:text-foreground',
        'focus-visible:outline-none focus-visible:underline',
      )}
      onClick={onClick}
    >
      {direction === 'up' ? (
        <ArrowUp className="size-3 shrink-0 text-foreground/45" aria-hidden />
      ) : null}
      <span className="min-w-0 truncate">{label}</span>
      {direction === 'down' ? (
        <ArrowDown className="size-3 shrink-0 text-foreground/45" aria-hidden />
      ) : null}
    </button>
  )
}

function FlowConnectionLink({
  label,
  direction,
  onClick,
}: {
  label: string
  direction: FlowConnectionDirection
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={`Connection to ${label}`}
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-0.5 text-left text-[11px] leading-snug',
        'font-medium text-foreground/85 transition-colors hover:text-foreground',
        'focus-visible:outline-none focus-visible:underline',
      )}
      onClick={onClick}
    >
      {direction === 'prev' || direction === 'both' ? (
        <ArrowLeft className="size-3 shrink-0 text-foreground/45" aria-hidden />
      ) : null}
      <span className="min-w-0 truncate">{label}</span>
      {direction === 'next' || direction === 'both' ? (
        <ArrowRight className="size-3 shrink-0 text-foreground/45" aria-hidden />
      ) : null}
    </button>
  )
}

function FlowKindColumn({
  label,
  children,
  className,
  align = 'start',
}: {
  label: string
  children: ReactNode
  className?: string
  align?: 'start' | 'end'
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <p
        className={cn(
          FLOW_COLUMN_TITLE_CLASS,
          align === 'end' && 'text-right',
        )}
      >
        {label}
      </p>
      <div
        className={cn(
          'flex flex-col gap-1',
          align === 'end' && 'items-end',
        )}
      >
        {children}
      </div>
    </div>
  )
}

function CellDetailConnections({
  incoming,
  outgoing,
  selectedLayerRowPosition,
  onSelect,
}: {
  incoming: BlueprintCellConnection[]
  outgoing: BlueprintCellConnection[]
  selectedLayerRowPosition: number
  onSelect: (cellId: string) => void
}) {
  const connections = getDirectedConnections(incoming, outgoing)
  const interactions = getDirectedInteractions(
    incoming,
    outgoing,
    selectedLayerRowPosition,
  )

  if (connections.length === 0 && interactions.length === 0) return null

  return (
    <div className="flex w-full items-start justify-between gap-x-6">
      {connections.length > 0 ? (
        <FlowKindColumn label="Connections" className="flex-1 min-w-0">
          {connections.map((connection) => (
            <FlowConnectionLink
              key={connection.cellId}
              label={abbreviateConnectionLayerName(connection.layerName)}
              direction={connection.direction}
              onClick={() => onSelect(connection.cellId)}
            />
          ))}
        </FlowKindColumn>
      ) : (
        <div aria-hidden className="flex-1 min-w-0" />
      )}
      {interactions.length > 0 ? (
        <FlowKindColumn
          label="Interactions"
          className="flex-1 min-w-0"
          align="end"
        >
          {interactions.map((connection) => (
            <FlowInteractionLink
              key={connection.cellId}
              label={abbreviateConnectionLayerName(connection.layerName)}
              direction={connection.direction}
              onClick={() => onSelect(connection.cellId)}
            />
          ))}
        </FlowKindColumn>
      ) : (
        <div aria-hidden className="flex-1 min-w-0" />
      )}
    </div>
  )
}

function TechList({
  title,
  entries,
  onSelect,
}: {
  title: string
  entries: PanelTechEntry[]
  onSelect: (cellId: string, item: string) => void
}) {
  if (entries.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      <p className={DETAIL_META_CLASS}>{title}</p>
      <div className="flex flex-wrap gap-1">
        {entries.map((entry) => (
          <TechPill
            key={entry.id}
            label={entry.item}
            onClick={() => onSelect(entry.cellId, entry.item)}
          />
        ))}
      </div>
    </div>
  )
}

function FigmaDetailLink({ url, className }: { url: string; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex w-fit max-w-full items-center gap-1.5 rounded-full',
        'border border-border/70 bg-muted/35 px-2.5 py-1',
        'text-[11px] font-medium leading-none text-foreground/75',
        'transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        className,
      )}
    >
      <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
      View in Figma
    </a>
  )
}

function ResourceDetailLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex w-fit max-w-full items-center gap-1.5 rounded-full',
        'border border-border/70 bg-muted/35 px-2.5 py-1',
        'text-[11px] font-medium leading-none text-foreground/75',
        'transition-colors hover:border-border hover:bg-muted/60 hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
      )}
    >
      <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
      {label}
    </a>
  )
}

function ResourceLinkList({
  links,
}: {
  links: Array<{ label: string; url: string }>
}) {
  if (links.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      <p className={DETAIL_META_CLASS}>Onboarding modules</p>
      <div className="flex flex-col items-start gap-1.5">
        {links.map((link) => (
          <ResourceDetailLink key={link.label} label={link.label} url={link.url} />
        ))}
      </div>
    </div>
  )
}

export function BlueprintCellDetailPanel() {
  const { selection, clearSelection, isOpen, blueprints, selectCell } =
    useBlueprintCellDetail()

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearSelection()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearSelection, isOpen])

  const pathEntry = selection?.paths[0]

  const connections = useMemo(() => {
    const cellId = pathEntry?.cellId
    const pathId = pathEntry?.pathId
    if (!cellId || !pathId) {
      return { incoming: [], outgoing: [] }
    }

    const blueprint = getBlueprintForPath(blueprints, pathId)
    if (!blueprint) {
      return { incoming: [], outgoing: [] }
    }

    return getBlueprintCellConnections(blueprint, cellId)
  }, [blueprints, pathEntry?.cellId, pathEntry?.pathId])

  const stepTechItems = useMemo(() => {
    const pathId = pathEntry?.pathId
    const cellId = pathEntry?.cellId
    const techItem = selection?.techItem
    const stepId = selection?.stepId
    if (!pathId || !cellId || !techItem || !stepId) {
      return []
    }

    const blueprint = getBlueprintForPath(blueprints, pathId)
    if (!blueprint) return []

    return getBlueprintStepTechItems(blueprint, stepId, { cellId, item: techItem })
  }, [
    blueprints,
    pathEntry?.cellId,
    pathEntry?.pathId,
    selection?.stepId,
    selection?.techItem,
  ])

  const selectedCell = useMemo(() => {
    const cellId = pathEntry?.cellId
    const pathId = pathEntry?.pathId
    if (!cellId || !pathId) return null

    const blueprint = getBlueprintForPath(blueprints, pathId)
    return blueprint?.cells.find((entry) => entry.id === cellId) ?? null
  }, [blueprints, pathEntry?.cellId, pathEntry?.pathId])

  const linkedTechItems = useMemo(
    () => getLinkedTechFromConnections(connections),
    [connections],
  )

  const flowConnections = useMemo(
    () => getFlowConnections(connections),
    [connections],
  )

  const selectedLayerRowPosition = useMemo(() => {
    const cellId = pathEntry?.cellId
    const pathId = pathEntry?.pathId
    if (!cellId || !pathId) return -1

    const blueprint = getBlueprintForPath(blueprints, pathId)
    if (!blueprint) return -1

    return getSelectedCellLayerRowPosition(blueprint, cellId)
  }, [blueprints, pathEntry?.cellId, pathEntry?.pathId])

  const techItems = useMemo(() => {
    const seen = new Set<string>()
    const items: PanelTechEntry[] = []

    const add = (entry: PanelTechEntry) => {
      if (seen.has(entry.id)) return
      seen.add(entry.id)
      items.push(entry)
    }

    for (const entry of linkedTechItems) {
      add(entry)
    }
    for (const entry of stepTechItems) {
      add({ id: entry.id, cellId: entry.cellId, item: entry.item })
    }

    return items
  }, [linkedTechItems, stepTechItems])

  const resourceLinks = useMemo(() => {
    if (!selectedCell) return []

    return selectedCell.links.flatMap((link) => {
      if (link.type !== URL_LINK_TYPE || !link.url?.trim()) return []
      return [{ label: link.label, url: link.url.trim() }]
    })
  }, [selectedCell])

  const visualStepEntries = useMemo(() => {
    const stepId = selection?.stepId
    const pathId = pathEntry?.pathId
    if (!stepId || !pathId) return []

    const blueprint = getBlueprintForPath(blueprints, pathId)
    if (!blueprint) return []

    return resolveVisualStepPictureEntries(blueprint, stepId)
  }, [blueprints, pathEntry?.pathId, selection?.stepId])

  if (!isOpen || !selection) return null

  const isVisualLayer = shouldUseVisualContent(selection.layerName)
  const cellContent =
    selection.paths[0]?.content.trim() ||
    selection.techItem ||
    ''
  const detailBodyText = selectedCell
    ? resolveTechCellDetailText(selection.techItem, selectedCell)
    : cellContent
  const techDetailLabel =
    selection.layerName === 'Front Stage Tech' && selectedCell
      ? resolveTechCellDetailLabel(selection.techItem, selectedCell)
      : null
  const detailDescriptionText =
    techDetailLabel && detailBodyText.trim() === techDetailLabel
      ? ''
      : detailBodyText
  const techDetailUrl = selectedCell
    ? resolveTechCellDetailUrl(selection.techItem, selectedCell)
    : null
  const detailPictures = resolveCellDetailPictures({
    techItem: selection.techItem,
    cellContent: selection.paths[0]?.content,
    cellPicture: selection.paths[0]?.picture,
    cellLinks: selectedCell?.links,
  })
  const showPicture = Boolean(detailPictures?.length && !isVisualLayer)

  const hasFlowConnections =
    flowConnections.incoming.length > 0 ||
    flowConnections.outgoing.length > 0
  const hasTech = techItems.length > 0
  const isTechCellSelected =
    Boolean(selection.techItem) ||
    shouldUsePillCellContent(selection.layerName)
  const techSectionTitle = isTechCellSelected
    ? 'Other tech used'
    : 'Tech used'

  const handleConnectionSelect = (cellId: string) => {
    const pathId = pathEntry?.pathId
    if (!pathId) return

    const blueprint = getBlueprintForPath(blueprints, pathId)
    if (!blueprint) return

    const nextSelection = buildBlueprintCellSelectionForId(
      blueprint,
      cellId,
      selection.scenarioName,
    )
    if (!nextSelection) return

    selectCell(nextSelection)
    requestAnimationFrame(() => {
      scrollBlueprintCellIntoView(cellId)
    })
  }

  const handleTechSelect = (cellId: string, techItem: string) => {
    const pathId = pathEntry?.pathId
    if (!pathId) return

    const blueprint = getBlueprintForPath(blueprints, pathId)
    if (!blueprint) return

    const nextSelection = buildTechPillSelectionForItem(
      blueprint,
      cellId,
      techItem,
      selection.scenarioName,
    )
    if (!nextSelection) return

    selectCell(nextSelection)
    requestAnimationFrame(() => {
      scrollBlueprintTechPillIntoView(cellId, techItem)
    })
  }

  const pathBadge = pathEntry ? (
    <PathLabelBadge
      name={pathEntry.pathName}
      description={pathEntry.pathDescription}
      pathType={pathEntry.pathType}
      compact
      className="w-fit max-w-full px-1.5 py-0.5 text-[10px] font-medium leading-none"
      side="left"
    />
  ) : null

  const layerTitle = (
    <div className="flex flex-col gap-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Step {selection.stepIndex + 1}
      </p>
      <p className="text-sm font-bold leading-snug tracking-tight text-foreground">
        {selection.layerName}
      </p>
    </div>
  )

  const figmaLink = techDetailUrl ? (
    <FigmaDetailLink url={techDetailUrl} />
  ) : null

  const layerHeader = (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">{layerTitle}</div>
      {figmaLink ? <div className="shrink-0 pt-0.5">{figmaLink}</div> : null}
    </div>
  )

  const pictureBlock = showPicture ? (
    <div className="flex w-full justify-center">
      <div
        className={cn(
          CELL_DETAIL_PICTURE_FRAME_CLASS,
          detailPictures!.length > 1 &&
            'flex items-center justify-center gap-4',
        )}
      >
        {detailPictures!.length > 1 ? (
          detailPictures!.map((src) => (
            <img
              key={src}
              src={src}
              alt=""
              className="h-16 w-16 shrink-0 object-contain"
            />
          ))
        ) : (
          <img
            src={detailPictures![0]}
            alt=""
            className={CELL_DETAIL_PICTURE_CLASS}
          />
        )}
      </div>
    </div>
  ) : null

  return (
    <div
      data-cell-detail-panel=""
      className={cn(
        'pointer-events-none absolute z-30',
        'top-18 right-4 bottom-14 md:right-8',
        CELL_DETAIL_PANEL_WIDTH_CLASS,
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <aside
        role="dialog"
        aria-modal="false"
        aria-label="Cell details"
        className="pointer-events-auto relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-3">
          <div className="min-w-0 flex-1">{pathBadge}</div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Close cell details"
            onClick={clearSelection}
          >
            <X />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4">
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto blueprint-scroll">
            {isVisualLayer ? (
              <>
                {layerTitle}
                <VisualStepDetailStack entries={visualStepEntries} />
              </>
            ) : (
              <>
                {layerHeader}
                {pictureBlock}
                {techDetailLabel ? (
                  <p className="text-sm font-bold leading-snug text-foreground">
                    {techDetailLabel}
                  </p>
                ) : null}
                {detailDescriptionText.trim() || !techDetailLabel ? (
                  <p className="text-sm whitespace-pre-wrap text-foreground">
                    {detailDescriptionText.trim() || (
                      <span className="text-muted-foreground">No content</span>
                    )}
                  </p>
                ) : null}
                {resourceLinks.length > 0 ? (
                  <ResourceLinkList links={resourceLinks} />
                ) : null}
                {hasTech ? (
                  <TechList
                    title={techSectionTitle}
                    entries={techItems}
                    onSelect={handleTechSelect}
                  />
                ) : null}
              </>
            )}
          </div>
          {hasFlowConnections ? (
            <div className="mt-auto shrink-0 border-t border-border/50 pt-2.5">
              <CellDetailConnections
                incoming={flowConnections.incoming}
                outgoing={flowConnections.outgoing}
                selectedLayerRowPosition={selectedLayerRowPosition}
                onSelect={handleConnectionSelect}
              />
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

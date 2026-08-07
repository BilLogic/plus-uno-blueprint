import { memo, useMemo, useState } from 'react'
import { Filter, Info, PanelRight } from 'lucide-react'
import { CompareZoneChip } from '@/components/blueprint/CompareZoneChip'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { buildBlueprintCellSelectionForId } from '@/lib/blueprintCellConnections'
import { focusCompareCells } from '@/lib/compareZoneNavigation'
import {
  compareSlotFocusCellIds,
  compareZoneFocusCellIds,
  countCompareDifferences,
  deriveCompareZones,
  filterCompareSlots,
  getDetailOnlyCompareSlots,
  type CompareZone,
} from '@/lib/compareLedger'
import {
  setCompareActiveZone,
  setCompareFilters,
  useCompareReviewState,
  type CompareReviewRegistration,
} from '@/lib/compareReviewStore'
import type { CompareSlot, CompareStatus } from '@/lib/compareSlots'
import {
  getBlueprintLayerStyle,
  getBlueprintLayerZone,
} from '@/lib/blueprintTheme'
import { getPathBadgeStyle, getPathColor } from '@/lib/pathColorTheme'
import { cn } from '@/lib/utils'
import type { BlueprintCellSelection } from '@/types/blueprintCellDetail'

const MONO_NUM_CLASS = 'font-mono tabular-nums'

type CompareDifferencesSurfaceProps = {
  registration: CompareReviewRegistration
  /** ⇱ hand-off: open this cell on the Details surface (selection built here). */
  onOpenCell: (selection: BlueprintCellSelection) => void
}

function VerdictChip({ verdict }: { verdict: CompareStatus }) {
  if (verdict === 'only') {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center rounded px-1 py-px text-3xs leading-none',
          MONO_NUM_CLASS,
          'bg-info/10 text-info',
        )}
        title="Present in only one path"
      >
        +
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded px-1 py-px text-3xs leading-none',
        MONO_NUM_CLASS,
        'bg-warning/10 text-warning',
      )}
      title="Paths diverge here"
    >
      ≠
    </span>
  )
}

type CompareDiffRowProps = {
  slot: CompareSlot
  pathIds: readonly string[]
  laneSwatchColor: string | undefined
  onFocusSlot: (slot: CompareSlot) => void
  onOpenSlotCell: (slot: CompareSlot) => void
}

/** One difference row: lane cell, one quote cell per path, ghost ⇱. */
const CompareDiffRow = memo(function CompareDiffRow({
  slot,
  pathIds,
  laneSwatchColor,
  onFocusSlot,
  onOpenSlotCell,
}: CompareDiffRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="group/diffrow col-span-full grid grid-cols-subgrid items-start gap-x-2 rounded-md px-1 py-1.5 text-left hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      onClick={() => onFocusSlot(slot)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onFocusSlot(slot)
        }
      }}
      aria-label={`Show ${slot.laneLabel} at ${slot.columnLabel} on the board`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-[3px]"
          style={{ backgroundColor: laneSwatchColor ?? 'var(--muted)' }}
        />
        <span
          className="min-w-0 truncate text-2xs text-muted-foreground"
          title={slot.laneLabel}
        >
          {slot.laneLabel}
        </span>
        <VerdictChip verdict={slot.verdict} />
      </div>
      {pathIds.map((pathId) => {
        const entry = slot.perPath[pathId]
        return (
          <div key={pathId} className="min-w-0 text-2xs leading-snug">
            {entry?.present ? (
              <span className="line-clamp-2 text-foreground/85">
                {entry.contents.join(' · ')}
              </span>
            ) : (
              <span aria-label="absent" className="text-muted-foreground/60">
                —
              </span>
            )}
          </div>
        )
      })}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-5 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-(--motion-micro) group-hover/diffrow:opacity-100 group-focus-within/diffrow:opacity-100 focus-visible:opacity-100 hover:text-foreground"
          aria-label={`Open ${slot.laneLabel} at ${slot.columnLabel} in Details`}
          onClick={(event) => {
            event.stopPropagation()
            onOpenSlotCell(slot)
          }}
        >
          <PanelRight className="size-3" aria-hidden />
        </Button>
      </div>
    </div>
  )
})

function DiffTable({
  slots,
  registration,
  onFocusSlot,
  onOpenSlotCell,
  laneSwatchByKey,
}: {
  slots: readonly CompareSlot[]
  registration: CompareReviewRegistration
  onFocusSlot: (slot: CompareSlot) => void
  onOpenSlotCell: (slot: CompareSlot) => void
  laneSwatchByKey: ReadonlyMap<string, string>
}) {
  const pathIds = registration.blueprints.map((blueprint) => blueprint.path.id)
  if (slots.length === 0) {
    return (
      <p className="px-1 py-2 text-2xs text-muted-foreground">
        No differences match the current filter.
      </p>
    )
  }
  return (
    <div
      className="grid gap-y-px"
      style={{
        gridTemplateColumns: `minmax(5.25rem, 0.9fr) repeat(${pathIds.length}, minmax(0, 1.3fr)) 1.5rem`,
      }}
    >
      {/* Path column headers: short name over a 3px rail in the path color. */}
      <div aria-hidden />
      {registration.blueprints.map((blueprint) => (
        <div
          key={blueprint.path.id}
          className="min-w-0 border-t-[3px] pt-1 pb-0.5 pr-2"
          style={{ borderTopColor: getPathColor(blueprint.path) }}
        >
          <span
            className="block truncate text-3xs font-medium text-muted-foreground"
            title={blueprint.path.name}
          >
            {blueprint.path.name}
          </span>
        </div>
      ))}
      <div aria-hidden />
      {slots.map((slot) => (
        <CompareDiffRow
          key={slot.slotKey}
          slot={slot}
          pathIds={pathIds}
          laneSwatchColor={laneSwatchByKey.get(slot.laneKey)}
          onFocusSlot={onFocusSlot}
          onOpenSlotCell={onOpenSlotCell}
        />
      ))}
    </div>
  )
}

function FilterChip({
  label,
  pressed,
  onToggle,
}: {
  label: string
  pressed: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        'rounded-full border px-2 py-0.5 text-2xs leading-tight transition-colors duration-(--motion-micro)',
        pressed
          ? 'border-foreground/50 bg-foreground/10 text-foreground'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}

/**
 * The Differences surface — Compare v3's ledger, the authoritative
 * enumeration of every difference between the compared paths. Zone-grouped
 * diff tables (lane rows × path columns); 2+ zones accordion with one open
 * at a time, exactly 1 zone flat; detail-only (description/links) diffs in
 * an unnumbered group below the zones. Opening a zone flies the camera to
 * it — accordion + fly is ONE gesture.
 */
export function CompareDifferencesSurface({
  registration,
  onOpenCell,
}: CompareDifferencesSurfaceProps) {
  const { activeZone, filters } = useCompareReviewState()
  const [detailOpen, setDetailOpen] = useState(false)

  const model = registration.model
  const zones = useMemo(() => deriveCompareZones(model), [model])
  const detailOnlySlots = useMemo(() => getDetailOnlyCompareSlots(model), [model])
  const totalCount = useMemo(() => countCompareDifferences(model), [model])

  // Lane facets (order of first appearance) + swatch colors resolved the
  // way the cell panel resolves its lane chip: layer_role first, name second.
  const { laneFacets, laneSwatchByKey } = useMemo(() => {
    const facets: Array<{ key: string; label: string }> = []
    const seen = new Set<string>()
    const swatches = new Map<string, string>()
    for (const slot of model.slots) {
      if (seen.has(slot.laneKey)) continue
      seen.add(slot.laneKey)
      facets.push({ key: slot.laneKey, label: slot.laneLabel })
    }
    for (const blueprint of registration.blueprints) {
      for (const layer of blueprint.layers) {
        const key = facets.find((facet) => facet.label === layer.name)?.key
        if (!key || swatches.has(key)) continue
        const zone = getBlueprintLayerZone(layer, blueprint.layers)
        swatches.set(key, getBlueprintLayerStyle(layer.name, zone, layer.role).lane)
      }
    }
    return { laneFacets: facets, laneSwatchByKey: swatches }
  }, [model, registration.blueprints])

  const flyTo = (cellIds: string[]) => {
    if (cellIds.length === 0) return
    // The shared compare gesture: auto-expands a pleat first when the
    // target is folded, so zone-fly and row-fly work while folded.
    void focusCompareCells(cellIds, registration.slideId)
  }

  const openZone = (zone: CompareZone | null) => {
    setDetailOpen(false)
    setCompareActiveZone(zone?.index ?? null)
    if (zone) flyTo(compareZoneFocusCellIds(zone))
  }

  const handleFocusSlot = (slot: CompareSlot) => {
    flyTo(compareSlotFocusCellIds(slot))
  }

  const handleOpenSlotCell = (slot: CompareSlot) => {
    for (const blueprint of registration.blueprints) {
      const entry = slot.perPath[blueprint.path.id]
      if (!entry?.present) continue
      const selection = buildBlueprintCellSelectionForId(
        blueprint,
        entry.cellIds[0],
        registration.scenarioName,
        registration.phaseName,
      )
      if (selection) {
        flyTo(compareSlotFocusCellIds(slot))
        onOpenCell(selection)
        return
      }
    }
  }

  const activeFilterCount = filters.lanes.length + filters.verdicts.length
  const filteredZoneSlots = (zone: CompareZone) =>
    filterCompareSlots(zone.slots, filters)
  const filteredDetailSlots = filterCompareSlots(detailOnlySlots, filters)

  const toggleLane = (laneKey: string) => {
    setCompareFilters({
      lanes: filters.lanes.includes(laneKey)
        ? filters.lanes.filter((key) => key !== laneKey)
        : [...filters.lanes, laneKey],
      verdicts: filters.verdicts,
    })
  }
  const toggleVerdict = (verdict: CompareStatus) => {
    setCompareFilters({
      lanes: filters.lanes,
      verdicts: filters.verdicts.includes(verdict)
        ? filters.verdicts.filter((entry) => entry !== verdict)
        : [...filters.verdicts, verdict],
    })
  }

  const zoneGroupLabel = (zone: CompareZone) => (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <CompareZoneChip index={zone.index} active={activeZone === zone.index} />
      <span className="min-w-0 truncate text-2xs font-medium text-foreground">
        {zone.stepRangeLabel} · {zone.titleLabel}
      </span>
      <span
        className={cn(
          'ml-auto shrink-0 pl-2 text-2xs text-muted-foreground',
          MONO_NUM_CLASS,
        )}
      >
        {filteredZoneSlots(zone).length}
      </span>
    </span>
  )

  const detailGroupLabel = (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <span className="min-w-0 truncate text-2xs font-medium text-foreground">
        Detail-only differences
      </span>
      <span
        className={cn(
          'ml-auto shrink-0 pl-2 text-2xs text-muted-foreground',
          MONO_NUM_CLASS,
        )}
      >
        {filteredDetailSlots.length}
      </span>
    </span>
  )

  // Controlled accordion: the store owns the zone (①②③ shared with strip
  // and jump_divergence); `detailOpen` is surface-local. One open at a time.
  const accordionValue: string[] =
    activeZone !== null
      ? [`zone-${activeZone}`]
      : detailOpen
        ? ['detail']
        : []

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 blueprint-scroll">
      {/* Header: who is being compared, how many differences, filter. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {registration.blueprints.map((blueprint, index) => (
              <span
                key={blueprint.path.id}
                className="flex min-w-0 items-center gap-1.5"
              >
                {index > 0 ? (
                  <span className="text-2xs text-muted-foreground">vs</span>
                ) : null}
                <span
                  className="max-w-32 truncate rounded-full px-2 py-0.5 text-3xs font-medium leading-tight"
                  style={getPathBadgeStyle(blueprint.path)}
                  title={blueprint.path.name}
                >
                  {blueprint.path.name}
                </span>
              </span>
            ))}
          </div>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 gap-1 px-2 text-2xs text-muted-foreground hover:text-foreground"
                />
              }
            >
              <Filter className="size-3" aria-hidden />
              Filter
              {activeFilterCount > 0 ? (
                <span className={cn('text-3xs', MONO_NUM_CLASS)}>
                  {activeFilterCount}
                </span>
              ) : null}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 gap-2 p-3">
              <p className="text-3xs font-medium uppercase tracking-wide text-muted-foreground">
                Lanes
              </p>
              <div className="flex flex-wrap gap-1">
                {laneFacets.map((facet) => (
                  <FilterChip
                    key={facet.key}
                    label={facet.label}
                    pressed={filters.lanes.includes(facet.key)}
                    onToggle={() => toggleLane(facet.key)}
                  />
                ))}
              </div>
              <p className="pt-1 text-3xs font-medium uppercase tracking-wide text-muted-foreground">
                Verdict
              </p>
              <div className="flex flex-wrap gap-1">
                <FilterChip
                  label="≠ divergent"
                  pressed={filters.verdicts.includes('divergent')}
                  onToggle={() => toggleVerdict('divergent')}
                />
                <FilterChip
                  label="+ only in one path"
                  pressed={filters.verdicts.includes('only')}
                  onToggle={() => toggleVerdict('only')}
                />
              </div>
              <p className="pt-1 text-3xs text-muted-foreground">
                Nothing selected = everything shown.
              </p>
            </PopoverContent>
          </Popover>
        </div>
        <p className="text-2xs text-muted-foreground">
          <span className={MONO_NUM_CLASS}>{totalCount}</span>{' '}
          {totalCount === 1 ? 'difference' : 'differences'} ·{' '}
          <span className={MONO_NUM_CLASS}>{zones.length}</span>{' '}
          {zones.length === 1 ? 'zone' : 'zones'}
          {detailOnlySlots.length > 0 ? (
            <>
              {' '}
              · <span className={MONO_NUM_CLASS}>{detailOnlySlots.length}</span>{' '}
              detail-only
            </>
          ) : null}
        </p>
        <p className="flex items-center gap-1 text-3xs text-muted-foreground/80">
          <Info className="size-3 shrink-0" aria-hidden />
          triggers/needs are not compared
        </p>
      </div>

      {totalCount === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          Paths identical across{' '}
          <span className={MONO_NUM_CLASS}>{model.columns.length}</span> steps.
        </p>
      ) : zones.length === 1 && detailOnlySlots.length === 0 ? (
        /* Exactly one zone, nothing else: flat table, no accordion chrome. */
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 border-b border-border/60 pb-1.5">
            {zoneGroupLabel(zones[0])}
          </div>
          <DiffTable
            slots={filteredZoneSlots(zones[0])}
            registration={registration}
            onFocusSlot={handleFocusSlot}
            onOpenSlotCell={handleOpenSlotCell}
            laneSwatchByKey={laneSwatchByKey}
          />
        </div>
      ) : (
        <Accordion
          value={accordionValue}
          onValueChange={(value) => {
            const next = (value[0] as string | undefined) ?? null
            if (next === 'detail') {
              setDetailOpen(true)
              setCompareActiveZone(null)
              return
            }
            if (next === null) {
              setDetailOpen(false)
              setCompareActiveZone(null)
              return
            }
            const zoneIndex = Number(next.replace('zone-', ''))
            const zone = zones.find((entry) => entry.index === zoneIndex) ?? null
            openZone(zone)
          }}
        >
          {zones.map((zone) => (
            <AccordionItem key={zone.index} value={`zone-${zone.index}`}>
              <AccordionTrigger className="gap-1.5 py-2 hover:no-underline">
                {zoneGroupLabel(zone)}
              </AccordionTrigger>
              <AccordionContent>
                <DiffTable
                  slots={filteredZoneSlots(zone)}
                  registration={registration}
                  onFocusSlot={handleFocusSlot}
                  onOpenSlotCell={handleOpenSlotCell}
                  laneSwatchByKey={laneSwatchByKey}
                />
              </AccordionContent>
            </AccordionItem>
          ))}
          {detailOnlySlots.length > 0 ? (
            <AccordionItem value="detail">
              <AccordionTrigger className="gap-1.5 py-2 hover:no-underline">
                {detailGroupLabel}
              </AccordionTrigger>
              <AccordionContent>
                <DiffTable
                  slots={filteredDetailSlots}
                  registration={registration}
                  onFocusSlot={handleFocusSlot}
                  onOpenSlotCell={handleOpenSlotCell}
                  laneSwatchByKey={laneSwatchByKey}
                />
              </AccordionContent>
            </AccordionItem>
          ) : null}
        </Accordion>
      )}
    </div>
  )
}

import { useMemo } from 'react'
import { Columns2, FoldHorizontal, GitCompareArrows } from 'lucide-react'
import type { PathOption } from '@/components/blueprint/PathMultiSelect'
import { NavbarSlideTitleNav } from '@/components/editor/NavbarSlideTitleNav'
import {
  BLUEPRINT_MENUBAR_HEADER_CLASS,
  BLUEPRINT_MENUBAR_TITLE_CLASS,
} from '@/components/editor/menubarHeaderLayout'
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@/components/editor/SegmentedControl'
import { Menubar } from '@/components/ui/menubar'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useBlueprintCellDetailOptional } from '@/contexts/BlueprintCellDetailContext'
import { useEditor } from '@/contexts/EditorContext'
import { countFoldableCompareColumns } from '@/lib/compareFold'
import { countCompareDifferences } from '@/lib/compareLedger'
import {
  setCompareFolded,
  useCompareReviewState,
} from '@/lib/compareReviewStore'
import { computePinnedColumns } from '@/lib/compareSlots'
import { getScenarioParallelTooltip } from '@/lib/scenarioParallelInfo'
import {
  getSlideDisplayLabel,
  isSubslide,
  type NavItem,
  type SlideViewType,
} from '@/types/nav'
import { cn } from '@/lib/utils'

type PhaseMenubarHeaderProps = {
  slide: NavItem
  slides: NavItem[]
  /** Paths still inform the description fallback; filtering lives in the sidebar. */
  paths?: PathOption[]
  selectedPathIds?: string[]
  className?: string
}

function resolveHeaderDescription(
  slide: NavItem,
  paths: PathOption[],
  selectedPathIds: string[],
): string | null | undefined {
  if (isSubslide(slide)) {
    if (slide.description?.trim()) return slide.description

    const selectedPath = paths.find((path) => selectedPathIds.includes(path.id))
    return selectedPath?.description ?? paths[0]?.description ?? null
  }

  return (
    slide.description ?? 'Scenarios in this phase and how they connect.'
  )
}

/**
 * Stacked ⇄ Merged, on the bar that holds the scenario title.
 *
 * Visible only while two or more paths are selected — with one path there
 * is nothing to compare and the control would be a question with no answer.
 * Same track-and-raised-square vocabulary as the View/Edit switch.
 */
function CompareViewToggle({ slide }: { slide: NavItem }) {
  const { getScenarioDisplayViewType, setScenarioDisplayViewType } = useEditor()
  const current = getScenarioDisplayViewType(slide)

  const segments: Array<{
    value: SlideViewType
    label: string
    icon: typeof Columns2
  }> = [
    { value: 'stacked', label: 'Stacked', icon: Columns2 },
    { value: 'merged', label: 'Merged', icon: GitCompareArrows },
  ]

  return (
    <SegmentedControl
      aria-label="Path display"
      value={current}
      onValueChange={(value) => setScenarioDisplayViewType(slide.id, value)}
    >
      {segments.map(({ value, label, icon: Icon }) => (
        <SegmentedControlItem key={value} value={value} className="px-2">
          <Icon className="size-3.5" aria-hidden />
          {label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  )
}

/**
 * The `[⇤ Fold]` toggle (Phase 4a) — opt-in compression of shared step
 * runs into pleats, in whichever compare mode is showing (the fold state
 * is mode-agnostic by design). Disabled at zero differences (S7 — nothing
 * to pull adjacent) and when the pin rule leaves no foldable shared
 * column. Turning fold off clears the per-pleat expansions.
 */
function CompareFoldToggle({ slide }: { slide: NavItem }) {
  const { registration, fold } = useCompareReviewState()
  const active =
    registration && registration.slideId === slide.id ? registration : null
  const foldableCount = useMemo(
    () =>
      active
        ? countFoldableCompareColumns(
            active.model,
            computePinnedColumns(active.model, active.blueprints),
          )
        : 0,
    [active],
  )
  if (!active) return null
  const differenceCount = countCompareDifferences(active.model)
  const disabled = differenceCount === 0 || foldableCount === 0
  const foldLabel = `Fold ${foldableCount} shared step${foldableCount === 1 ? '' : 's'}`
  const toggle = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      aria-pressed={fold.folded}
      aria-label={fold.folded ? 'Unfold shared steps' : foldLabel}
      className={cn(
        'h-6 gap-1 px-2 text-2xs text-muted-foreground hover:text-foreground',
        fold.folded && 'bg-muted text-foreground',
      )}
      onClick={() => setCompareFolded(!fold.folded)}
    >
      <FoldHorizontal className="size-3.5" aria-hidden />
      Fold
    </Button>
  )
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        {toggle}
      </TooltipTrigger>
      <TooltipContent>
        {disabled
          ? differenceCount === 0
            ? 'Paths are identical — nothing to fold around'
            : 'Every shared step feeds a divergent one — nothing folds'
          : fold.folded
            ? 'Unfold shared steps'
            : foldLabel}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * The `[≠ N]` differences chip — the menubar entry to the difference
 * ledger, beside the compare toggle. N is the ledger's authoritative
 * count; hidden below 2 selected paths (the compare cluster gate),
 * disabled at zero because "open the empty ledger" is a dead end.
 */
function CompareDifferencesChip({ slide }: { slide: NavItem }) {
  const { registration } = useCompareReviewState()
  const cellDetail = useBlueprintCellDetailOptional()
  if (!registration || registration.slideId !== slide.id || !cellDetail) {
    return null
  }
  const count = countCompareDifferences(registration.model)
  const chip = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={count === 0}
      aria-label={
        count === 0
          ? 'No differences between the compared paths'
          : `Open the difference ledger (${count} differences)`
      }
      className="h-6 gap-1 px-2 font-mono text-2xs tabular-nums text-muted-foreground hover:text-foreground"
      onClick={cellDetail.openDifferences}
    >
      ≠ {count}
    </Button>
  )
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        {chip}
      </TooltipTrigger>
      <TooltipContent>
        {count === 0
          ? 'Paths are identical — nothing to list'
          : 'Open the difference ledger'}
      </TooltipContent>
    </Tooltip>
  )
}

/** Phase or scenario title bar using the shadcn Menubar component. */
export function PhaseMenubarHeader({
  slide,
  slides,
  paths = [],
  selectedPathIds = [],
  className,
}: PhaseMenubarHeaderProps) {
  const label = getSlideDisplayLabel(slide, slides)
  const isScenario = isSubslide(slide)
  const description = resolveHeaderDescription(slide, paths, selectedPathIds)
  const infoTooltip = isScenario ? getScenarioParallelTooltip(slide) : null
  const showCompareToggle = isScenario && selectedPathIds.length >= 2

  return (
    <Menubar
      modal={false}
      data-phase-menubar-header
      className={cn(BLUEPRINT_MENUBAR_HEADER_CLASS, className)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className={BLUEPRINT_MENUBAR_TITLE_CLASS}>
        <NavbarSlideTitleNav
          label={label}
          description={description}
          infoTooltip={infoTooltip}
          className="shrink-0"
        />
      </div>
      {/* Beside the title, not flex-end: the bar's right edge belongs to the
          absolutely-positioned zoom / Reset View chrome. */}
      {showCompareToggle ? (
        <div className="ml-3 flex shrink-0 items-center gap-1.5">
          <CompareViewToggle slide={slide} />
          <CompareFoldToggle slide={slide} />
          <CompareDifferencesChip slide={slide} />
        </div>
      ) : null}
    </Menubar>
  )
}

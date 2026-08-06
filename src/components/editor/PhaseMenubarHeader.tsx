import { Columns2, GitCompareArrows } from 'lucide-react'
import type { PathOption } from '@/components/blueprint/PathMultiSelect'
import { NavbarSlideTitleNav } from '@/components/editor/NavbarSlideTitleNav'
import {
  BLUEPRINT_MENUBAR_HEADER_CLASS,
  BLUEPRINT_MENUBAR_TITLE_CLASS,
} from '@/components/editor/menubarHeaderLayout'
import { Menubar } from '@/components/ui/menubar'
import { useEditor } from '@/contexts/EditorContext'
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
 * Side by side ⇄ Compare, on the bar that holds the scenario title.
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
    { value: 'side-by-side', label: 'Side by side', icon: Columns2 },
    { value: 'integrated', label: 'Compare', icon: GitCompareArrows },
  ]

  return (
    <div
      role="group"
      aria-label="Path display"
      className="flex shrink-0 items-center gap-0.5 rounded-lg bg-black/[0.055] p-0.5 dark:bg-white/10"
    >
      {segments.map(({ value, label, icon: Icon }) => {
        const active = current === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setScenarioDisplayViewType(slide.id, value)}
            className={cn(
              'flex h-6 items-center gap-1.5 rounded-md px-2 text-2xs font-medium transition-colors',
              active
                ? 'bg-background text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        )
      })}
    </div>
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
        <div className="ml-3 shrink-0">
          <CompareViewToggle slide={slide} />
        </div>
      ) : null}
    </Menubar>
  )
}

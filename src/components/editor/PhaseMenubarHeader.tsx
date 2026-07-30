import type { PathOption } from '@/components/blueprint/PathMultiSelect'
import { NavbarSlideTitleNav } from '@/components/editor/NavbarSlideTitleNav'
import {
  BLUEPRINT_MENUBAR_HEADER_CLASS,
  BLUEPRINT_MENUBAR_TITLE_CLASS,
} from '@/components/editor/menubarHeaderLayout'
import { Menubar } from '@/components/ui/menubar'
import { getScenarioParallelTooltip } from '@/lib/scenarioParallelInfo'
import {
  getSlideDisplayLabel,
  isSubslide,
  type NavItem,
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
    </Menubar>
  )
}

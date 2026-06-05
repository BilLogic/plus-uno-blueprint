export type EditorMode = 'stack' | 'canvas'

/** How blueprint paths are laid out on a scenario slide. */
export type SlideViewType = 'single' | 'side-by-side' | 'integrated'

export const SLIDE_VIEW_TYPES: SlideViewType[] = ['single', 'side-by-side', 'integrated']

/** Options shown in the scenario view type control. */
export const SCENARIO_VIEW_TYPE_OPTIONS: SlideViewType[] = [
  'side-by-side',
  'integrated',
]

export const SLIDE_VIEW_TYPE_LABELS: Record<SlideViewType, string> = {
  single: 'Single',
  'side-by-side': 'Side by side',
  integrated: 'Integrated',
}

export type Slide = {
  id: string
  index: number
  label: string
  /** When set, this slide is a subslide branching from the parent (not in the main vertical stack). */
  parentId?: string
  /** Main-phase loop target (e.g. post-session → in-session). Stored in DB; not drawn on canvas. */
  loopToId?: string
  /** Scenario blueprint layout; defaults to single-path view. */
  viewType?: SlideViewType
  /** Short scenario summary shown under the slide title. */
  description?: string | null
}

const PRE_SESSION_ID = 'a0000000-0000-4000-8000-000000000103'
const IN_SESSION_ID = 'a0000000-0000-4000-8000-000000000104'

/** Offline fallback matching supabase/seed.sql when Supabase is not configured. */
export const FALLBACK_SLIDES: Slide[] = [
  { id: 'a0000000-0000-4000-8000-000000000101', index: 1, label: 'Application' },
  { id: 'a0000000-0000-4000-8000-000000000102', index: 2, label: 'Onboarding' },
  { id: PRE_SESSION_ID, index: 3, label: 'Pre-session' },
  { id: IN_SESSION_ID, index: 4, label: 'in-session' },
  {
    id: 'a0000000-0000-4000-8000-000000000201',
    index: 1,
    label: 'Before Students Join',
    parentId: IN_SESSION_ID,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000202',
    index: 2,
    label: 'Student Just Joined',
    parentId: IN_SESSION_ID,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000203',
    index: 3,
    label: 'Warm-Up',
    parentId: IN_SESSION_ID,
    viewType: 'side-by-side',
    description:
      'Compare service blueprint paths as tutors greet students and move through the warm-up flow in breakout rooms.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000204',
    index: 4,
    label: 'Goal-Setting Phase',
    parentId: IN_SESSION_ID,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000205',
    index: 5,
    label: 'Help Request',
    parentId: IN_SESSION_ID,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000206',
    index: 6,
    label: 'Wrap-Up',
    parentId: IN_SESSION_ID,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000105',
    index: 5,
    label: 'post-session',
    loopToId: IN_SESSION_ID,
  },
]

export function getSlideDisplayLabel(
  slide: Slide,
  _slides: Slide[] = FALLBACK_SLIDES,
): string {
  return slide.label
}

export function isSubslide(slide: Slide): boolean {
  return Boolean(slide.parentId)
}

export function getSlideViewType(slide: Slide): SlideViewType {
  return slide.viewType ?? 'single'
}

export function isIntegratedBlueprintSlide(slide: Slide): boolean {
  return isSubslide(slide) && getSlideViewType(slide) === 'integrated'
}

export function isSideBySideBlueprintSlide(slide: Slide): boolean {
  return isSubslide(slide) && getSlideViewType(slide) === 'side-by-side'
}

export function getMainSlides(slides: Slide[] = FALLBACK_SLIDES): Slide[] {
  return slides.filter((s) => !s.parentId)
}

export function getSubslides(parentId: string, slides: Slide[] = FALLBACK_SLIDES): Slide[] {
  return slides.filter((s) => s.parentId === parentId)
}

/** Sidebar / filmstrip order: each main slide followed by its subslides. */
export function getSlidesInNavOrder(slides: Slide[] = FALLBACK_SLIDES): Slide[] {
  const ordered: Slide[] = []
  for (const main of getMainSlides(slides)) {
    ordered.push(main)
    ordered.push(...getSubslides(main.id, slides))
  }
  return ordered
}

export function getSlideById(id: string, slides: Slide[] = FALLBACK_SLIDES): Slide | undefined {
  return slides.find((s) => s.id === id)
}

export function getParentSlide(
  slide: Slide,
  slides: Slide[] = FALLBACK_SLIDES,
): Slide | undefined {
  if (!slide.parentId) return undefined
  return getSlideById(slide.parentId, slides)
}

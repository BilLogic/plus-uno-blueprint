import { hasBlueprintFallback } from '@/data/blueprintFallbacks'

export type EditorMode = 'stack' | 'canvas'

/** Toggle to expose the infinite-canvas editor mode in the UI. */
export const CANVAS_VIEW_ENABLED = false

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
  /** Main-phase loop target (e.g. post-session → pre-session). Stored in DB; not drawn on canvas. */
  loopToId?: string
  /** Scenario blueprint layout; defaults to single-path view. */
  viewType?: SlideViewType
  /** Short scenario summary shown under the slide title. */
  description?: string | null
}

const PRE_SESSION_ID = 'a0000000-0000-4000-8000-000000000103'
const IN_SESSION_ID = 'a0000000-0000-4000-8000-000000000104'
const POST_SESSION_ID = 'a0000000-0000-4000-8000-000000000105'

/** Offline fallback matching supabase/seed.sql when Supabase is not configured. */
export const FALLBACK_SLIDES: Slide[] = [
  {
    id: 'a0000000-0000-4000-8000-000000000101',
    index: 1,
    label: 'Application',
    description:
      'Potential Tutors discover, interview and receive an offer to join the PLUS Team',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000121',
    index: 1,
    label: 'Discovery',
    parentId: 'a0000000-0000-4000-8000-000000000101',
    viewType: 'side-by-side',
    description: 'Potential tutors discover plus',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000122',
    index: 2,
    label: 'Interview & Offer',
    parentId: 'a0000000-0000-4000-8000-000000000101',
    viewType: 'side-by-side',
    description: 'Potential Tutors Interview for role and receive an offer.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000102',
    index: 2,
    label: 'Onboarding',
    description:
      'The tutor goes through required onboarding before joining a tutoring session.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000120',
    index: 1,
    label: 'Tech Setup',
    parentId: 'a0000000-0000-4000-8000-000000000102',
    viewType: 'side-by-side',
    description:
      'The tutor sets up necessary tech and obtains required clearances.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000123',
    index: 2,
    label: 'Onboarding Modules',
    parentId: 'a0000000-0000-4000-8000-000000000102',
    viewType: 'side-by-side',
    description: 'The tutor completes required onboarding modules.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000124',
    index: 3,
    label: 'Lesson Modules',
    parentId: 'a0000000-0000-4000-8000-000000000102',
    viewType: 'side-by-side',
    description:
      'The tutor goes through required lessons before joining a tutoring session.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000125',
    index: 4,
    label: 'Session Sign Up',
    parentId: 'a0000000-0000-4000-8000-000000000102',
    viewType: 'side-by-side',
    description:
      'The tutor signs up for recurring sessions for the semester.',
  },
  { id: PRE_SESSION_ID, index: 3, label: 'Pre-session', description: 'Preparation before a live tutoring session' },
  {
    id: 'a0000000-0000-4000-8000-000000000126',
    index: 1,
    label: 'Standard Scheduling',
    parentId: PRE_SESSION_ID,
    viewType: 'side-by-side',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000127',
    index: 2,
    label: 'Fill-in Request',
    parentId: PRE_SESSION_ID,
    viewType: 'side-by-side',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000128',
    index: 3,
    label: 'Call-off Request',
    parentId: PRE_SESSION_ID,
    viewType: 'side-by-side',
  },
  {
    id: IN_SESSION_ID,
    index: 4,
    label: 'In-session',
    description:
      'This is the activities the regular tutor, lead tutor, and teacher go through during live tutoring sessions.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000201',
    index: 1,
    label: 'Before Students Join',
    parentId: IN_SESSION_ID,
    viewType: 'side-by-side',
    description:
      'Teachers and tutors prepare the session before students join.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000202',
    index: 2,
    label: 'Student Just Joined',
    parentId: IN_SESSION_ID,
    viewType: 'side-by-side',
    description:
      'Teachers and tutors welcome students as they join the session.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000203',
    index: 3,
    label: 'Warm-Up',
    parentId: IN_SESSION_ID,
    viewType: 'side-by-side',
    description:
      'Tutors greet and move students to breakout rooms as the session begins.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000204',
    index: 4,
    label: 'Goal-Setting Phase',
    parentId: IN_SESSION_ID,
    viewType: 'side-by-side',
    description:
      'Tutors guide students through goal setting in breakout sessions.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000205',
    index: 5,
    label: 'Help Request',
    parentId: IN_SESSION_ID,
    viewType: 'side-by-side',
    description:
      'Tutors receive and resolve student help requests during the session.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000206',
    index: 6,
    label: 'Wrap-Up',
    parentId: IN_SESSION_ID,
    viewType: 'side-by-side',
    description:
      'Teachers and tutors close breakout sessions, debrief, and complete wrap-up tasks.',
  },
  {
    id: POST_SESSION_ID,
    index: 5,
    label: 'Post-session',
    description: 'Wrap-up after session; may return to pre-session',
    loopToId: PRE_SESSION_ID,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000207',
    index: 1,
    label: 'Reporting an Issue',
    parentId: POST_SESSION_ID,
    viewType: 'side-by-side',
    description:
      'Tutors report session issues to the tutor supervisor team after the session.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000208',
    index: 2,
    label: 'Reporting Hours',
    parentId: POST_SESSION_ID,
    viewType: 'side-by-side',
    description: 'Tutors log their tutoring hours after the session.',
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

/** Scenario id for blueprint loading — subsides use their id; single-scenario phases use phase id. */
export function getBlueprintScenarioId(slide: Slide): string | undefined {
  if (isSubslide(slide)) return slide.id
  if (hasBlueprintFallback(slide.id)) return slide.id
  return undefined
}

export function getSlideViewType(slide: Slide): SlideViewType {
  if (slide.viewType) return slide.viewType
  if (isSubslide(slide)) return 'side-by-side'
  if (hasBlueprintFallback(slide.id)) return 'side-by-side'
  return 'single'
}

export function showsBlueprintFilters(slide: Slide): boolean {
  return getBlueprintScenarioId(slide) !== undefined
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

export type SlideSequenceNav = {
  prev: Slide | null
  next: Slide | null
  index: number
  total: number
}

function getPhaseLoopNextSlide(
  current: Slide,
  slides: Slide[],
): Slide | null {
  const parent = getParentSlide(current, slides)
  if (!parent?.loopToId) return null

  const subslides = getSubslides(parent.id, slides)
  const lastSubslide = subslides[subslides.length - 1]
  if (!lastSubslide || lastSubslide.id !== current.id) return null

  return getSlideById(parent.loopToId, slides) ?? null
}

/** Previous / next slide in phase + scenario sidebar order. */
export function getSlideSequenceNav(
  activeSlideId: string,
  slides: Slide[] = FALLBACK_SLIDES,
): SlideSequenceNav {
  const ordered = getSlidesInNavOrder(slides)
  const index = ordered.findIndex((slide) => slide.id === activeSlideId)

  if (index === -1) {
    return { prev: null, next: null, index: -1, total: ordered.length }
  }

  const current = ordered[index]!
  const linearNext = index < ordered.length - 1 ? ordered[index + 1]! : null
  const loopNext = linearNext ? null : getPhaseLoopNextSlide(current, slides)

  return {
    prev: index > 0 ? ordered[index - 1]! : null,
    next: linearNext ?? loopNext,
    index,
    total: ordered.length,
  }
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

export const WORKSPACE_BREADCRUMB_ID = '__workspace__'
export const WORKSPACE_BREADCRUMB_LABEL = 'PLUS Uno Blueprint'

export type SlideBreadcrumb = {
  id: string
  label: string
}

/** Breadcrumb trail from workspace root through parent phases to the active slide. */
export function getSlideBreadcrumbs(
  slide: Slide,
  slides: Slide[] = FALLBACK_SLIDES,
): SlideBreadcrumb[] {
  const crumbs: SlideBreadcrumb[] = [
    { id: WORKSPACE_BREADCRUMB_ID, label: WORKSPACE_BREADCRUMB_LABEL },
  ]

  const ancestors: Slide[] = []
  let parentId = slide.parentId
  while (parentId) {
    const parent = getSlideById(parentId, slides)
    if (!parent) break
    ancestors.unshift(parent)
    parentId = parent.parentId
  }

  for (const ancestor of ancestors) {
    crumbs.push({
      id: ancestor.id,
      label: getSlideDisplayLabel(ancestor, slides),
    })
  }

  crumbs.push({
    id: slide.id,
    label: getSlideDisplayLabel(slide, slides),
  })

  return crumbs
}

/** Default navigation target when the workspace breadcrumb is selected. */
export function getWorkspaceBreadcrumbTarget(
  slides: Slide[] = FALLBACK_SLIDES,
): string | undefined {
  const application = slides.find(
    (slide) => !slide.parentId && slide.label === 'Application',
  )
  return application?.id ?? getMainSlides(slides)[0]?.id
}

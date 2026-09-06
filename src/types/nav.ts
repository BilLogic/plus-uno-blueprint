import { hasBlueprintFallback } from '@/data/blueprintFallbacks'
import { ORG_NAME } from '@/config'

/**
 * landing = orientation homepage;
 * home = birds-eye service overview canvas;
 * detail = focused phase/scenario on the canvas.
 */
export type EditorView = 'landing' | 'home' | 'detail'

/**
 * How blueprint paths are laid out on a scenario slide.
 *
 * ONE vocabulary — the database stores these same tokens. It used to speak
 * `single | side-by-side | integrated` with `viewTypeVocabulary.ts` translating;
 * all 22 rows held `side-by-side` and the other two were unused, so the
 * translation was deleted rather than maintained.
 *
 * `'merged'` used to be the exception, session-only behind a `single | stacked`
 * CHECK. Since #280 it is stored like the other: `scenarios.layout` is
 * `stacked | merged`, the header toggle writes it, and a scenario left merged
 * opens merged. `single` went with that change — a one-path board was never a
 * different board, only a different renderer for one band — so there is no
 * third token anywhere for a write path to decide about.
 */
export type SlideViewType = 'stacked' | 'merged'

export type NavItem = {
  id: string
  index: number
  label: string
  /** When set, this slide is a subslide branching from the parent (not in the main vertical stack). */
  parentId?: string
  /** Main-phase loop target (e.g. post-session → pre-session). Stored in DB; not drawn on canvas. */
  loopToId?: string
  /** `scenarios.layout` — what this scenario's board opens as. */
  viewType?: SlideViewType
  /** The row's summary, shown under the slide title. */
  summary?: string | null
  /**
   * `scenarios.note` — the aside a reader should know besides what the
   * scenario IS, carried on the title's definition popover. Today it says
   * which other scenarios this one can run beside; a deployment writes
   * whatever is true of its own board (#326 S6, #396 Q38).
   */
  note?: string | null
}

const PRE_SESSION_ID = 'a0000000-0000-4000-8000-000000000103'
const IN_SESSION_ID = 'a0000000-0000-4000-8000-000000000104'
const POST_SESSION_ID = 'a0000000-0000-4000-8000-000000000105'

export const APPLICATION_PHASE_ID = 'a0000000-0000-4000-8000-000000000101'
export const ONBOARDING_PHASE_ID = 'a0000000-0000-4000-8000-000000000102'
export const PRE_SESSION_PHASE_ID = 'a0000000-0000-4000-8000-000000000103'
export const IN_SESSION_PHASE_ID = 'a0000000-0000-4000-8000-000000000104'
export const POST_SESSION_PHASE_ID = 'a0000000-0000-4000-8000-000000000105'

const OVERVIEW_PHASE_FLOW_TRANSITIONS: ReadonlyArray<{
  fromId: string
  toId: string
  fromLabel: string
  toLabel: string
}> = [
  {
    fromId: APPLICATION_PHASE_ID,
    toId: ONBOARDING_PHASE_ID,
    fromLabel: 'Application',
    toLabel: 'Onboarding',
  },
  {
    fromId: ONBOARDING_PHASE_ID,
    toId: PRE_SESSION_PHASE_ID,
    fromLabel: 'Onboarding',
    toLabel: 'Pre-session',
  },
  {
    fromId: PRE_SESSION_PHASE_ID,
    toId: IN_SESSION_PHASE_ID,
    fromLabel: 'Pre-session',
    toLabel: 'In-session',
  },
  {
    fromId: IN_SESSION_PHASE_ID,
    toId: POST_SESSION_PHASE_ID,
    fromLabel: 'In-session',
    toLabel: 'Post-session',
  },
]

/** Whether the service overview canvas should draw a flow arrow between two phases. */
export function shouldShowOverviewPhaseFlowArrow(
  fromPhase: NavItem,
  toPhase: NavItem | undefined,
): boolean {
  if (!toPhase) return false

  return OVERVIEW_PHASE_FLOW_TRANSITIONS.some(
    ({ fromId, toId, fromLabel, toLabel }) =>
      (fromPhase.id === fromId && toPhase.id === toId) ||
      (fromPhase.label === fromLabel && toPhase.label === toLabel),
  )
}

/** Horizontal anchor for overview flow arrows (Application phase center). */
export function isOverviewFlowArrowAnchorPhase(phase: NavItem): boolean {
  return (
    phase.id === APPLICATION_PHASE_ID || phase.label === 'Application'
  )
}

/** Lifecycle loop arrow between main phases on the overview canvas. */
export function shouldShowOverviewPostToPreLoopArrow(
  phases: NavItem[],
): boolean {
  return getOverviewPostToPreLoopTransition(phases) !== null
}

/**
 * Loop transition detected from the data alone: the first phase carrying a
 * `loopToId` (DB `phases.loops_to_phase_id`) whose target phase exists. No
 * phase-ID or display-label heuristics — works for any org's IDs and any
 * language.
 */
export function getOverviewPostToPreLoopTransition(
  phases: NavItem[],
): { fromPhaseId: string; toPhaseId: string } | null {
  for (const phase of phases) {
    if (!phase.loopToId) continue

    const target = getSlideById(phase.loopToId, phases)
    if (!target) continue

    return { fromPhaseId: phase.id, toPhaseId: target.id }
  }

  return null
}

/** Offline fallback matching supabase/seed.sql when Supabase is not configured. */
export const FALLBACK_NAV: NavItem[] = [
  {
    id: 'a0000000-0000-4000-8000-000000000101',
    index: 1,
    label: 'Application',
    summary:
      'Potential tutors discover, interview and receive an offer to join the PLUS Team',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000121',
    index: 1,
    label: 'Discovery',
    parentId: 'a0000000-0000-4000-8000-000000000101',
    viewType: 'stacked',
    summary: 'Potential tutors discover plus',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000122',
    index: 2,
    label: 'Interview & Offer',
    parentId: 'a0000000-0000-4000-8000-000000000101',
    viewType: 'stacked',
    summary: 'Potential Tutors Interview for role and receive an offer.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000102',
    index: 2,
    label: 'Onboarding',
    summary:
      'The tutor goes through required onboarding before joining a tutoring session.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000120',
    index: 1,
    label: 'Employment & Access',
    parentId: 'a0000000-0000-4000-8000-000000000102',
    viewType: 'stacked',
    summary:
      'The tutor sets up necessary tech and obtains required clearances.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000123',
    index: 2,
    label: 'Onboarding Modules',
    parentId: 'a0000000-0000-4000-8000-000000000102',
    viewType: 'stacked',
    summary: 'The tutor completes required onboarding modules.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000124',
    index: 3,
    label: 'Lesson Modules',
    parentId: 'a0000000-0000-4000-8000-000000000102',
    viewType: 'stacked',
    summary:
      'The tutor goes through required lessons before joining a tutoring session.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000125',
    index: 4,
    label: 'Session Sign Up',
    parentId: 'a0000000-0000-4000-8000-000000000102',
    viewType: 'stacked',
    summary:
      'The tutor signs up for recurring sessions for the semester.',
  },
  { id: PRE_SESSION_ID, index: 3, label: 'Pre-session', summary: 'Preparation before a live tutoring session' },
  {
    id: 'a0000000-0000-4000-8000-000000000126',
    index: 1,
    label: 'Standard Scheduling',
    parentId: PRE_SESSION_ID,
    viewType: 'stacked',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000127',
    index: 2,
    label: 'Fill-in Request',
    parentId: PRE_SESSION_ID,
    viewType: 'stacked',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000128',
    index: 3,
    label: 'Call-off Request',
    parentId: PRE_SESSION_ID,
    viewType: 'stacked',
  },
  {
    id: IN_SESSION_ID,
    index: 4,
    label: 'In-session',
    summary:
      'Tutoring activities that occur during live sessions.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000201',
    index: 1,
    label: 'Before Students Join',
    parentId: IN_SESSION_ID,
    viewType: 'stacked',
    summary:
      'Teachers and tutors prepare the session before students join.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000202',
    index: 2,
    label: 'Student Just Joined',
    parentId: IN_SESSION_ID,
    viewType: 'stacked',
    summary:
      'Teachers and tutors welcome students as they join the session.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000203',
    index: 3,
    label: 'Warm-Up',
    parentId: IN_SESSION_ID,
    viewType: 'stacked',
    summary:
      'Tutors greet and move students to breakout rooms as the session begins.',
    /*
      `scenarios.note` for the three in-session scenarios that overlap. The
      database says this in the column; this list is what a board with no
      database reads, so it says it here — fixture content, beside every
      other sentence this file already holds (#326 S6).
    */
    note:
      'This scenario can run in parallel with the Goal Setting and Help Request scenarios.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000204',
    index: 4,
    label: 'Goal Setting',
    parentId: IN_SESSION_ID,
    viewType: 'stacked',
    summary:
      'Tutors guide students through goal setting in breakout sessions.',
    note:
      'This scenario can run in parallel with the Warm-Up and Help Request scenarios.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000205',
    index: 5,
    label: 'Help Request',
    parentId: IN_SESSION_ID,
    viewType: 'stacked',
    summary:
      'Tutors receive and resolve student help requests during the session.',
    note:
      'This scenario can run in parallel with the Warm-Up and Goal Setting scenarios.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000206',
    index: 6,
    label: 'Wrap-Up',
    parentId: IN_SESSION_ID,
    viewType: 'stacked',
    summary:
      'Teachers and tutors close breakout sessions, debrief, and complete wrap-up tasks.',
  },
  {
    id: POST_SESSION_ID,
    index: 5,
    label: 'Post-session',
    summary: 'Wrap-up after session; may return to pre-session',
    loopToId: PRE_SESSION_ID,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000207',
    index: 1,
    label: 'Reporting an Issue',
    parentId: POST_SESSION_ID,
    viewType: 'stacked',
    summary:
      'Tutors report session issues to the tutor supervisor team after the session.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000208',
    index: 2,
    label: 'Reporting Hours',
    parentId: POST_SESSION_ID,
    viewType: 'stacked',
    summary: 'Tutors log their tutoring hours after the session.',
  },
]

/**
 * The time-marker register's label: `01 · Application`. Phases and steps ARE
 * ordered sequences, so the zero-padded ordinal is information. One helper,
 * because five surfaces (phase badges, reader eyebrows, nav sheets) claim to
 * "name time the same way" — this is what makes that claim structural.
 */
export function ordinalLabel(ordinal: number, name: string): string {
  return `${String(ordinal).padStart(2, '0')} · ${name}`
}

export function getSlideDisplayLabel(
  slide: NavItem,
  _slides: NavItem[] = FALLBACK_NAV,
): string {
  return slide.label
}

export function isSubslide(slide: NavItem): boolean {
  return Boolean(slide.parentId)
}

/** Scenario id for blueprint loading — subsides use their id; single-scenario phases use phase id. */
export function getBlueprintScenarioId(slide: NavItem): string | undefined {
  if (isSubslide(slide)) return slide.id
  if (hasBlueprintFallback(slide.id)) return slide.id
  return undefined
}

/**
 * A raw `scenarios.layout` as a SlideViewType.
 *
 * Not a translation — the stored tokens ARE these tokens. It is a guard: a row
 * outside the CHECK constraint falls back to the stacked view rather than
 * crashing a render, which is the behaviour the old vocabulary map provided and
 * the only part of it worth keeping. `single`, which the column held until
 * 20260902120000, lands here too: a one-path scenario is stacked with one band.
 */
export function asSlideViewType(raw: string): SlideViewType {
  return raw === 'merged' ? 'merged' : 'stacked'
}

export function getSlideViewType(slide: NavItem): SlideViewType {
  // Already the stored token — see asSlideViewType.
  return slide.viewType ?? 'stacked'
}

export function showsBlueprintFilters(
  slide: NavItem,
  slides: NavItem[] = FALLBACK_NAV,
): boolean {
  if (getBlueprintScenarioId(slide) !== undefined) return true

  if (!isSubslide(slide)) {
    return getSubslides(slide.id, slides).some(
      (scenario) => getBlueprintScenarioId(scenario) !== undefined,
    )
  }

  return false
}

export function isIntegratedBlueprintSlide(_slide: NavItem): boolean {
  // Integrated view is disabled app-wide in uno.
  return false
}

export function isSideBySideBlueprintSlide(slide: NavItem): boolean {
  return isSubslide(slide) && getSlideViewType(slide) === 'stacked'
}

export function getMainSlides(slides: NavItem[] = FALLBACK_NAV): NavItem[] {
  return slides
    .filter((s) => !s.parentId)
    .slice()
    .sort((a, b) => a.index - b.index || a.label.localeCompare(b.label))
}

export function getSubslides(parentId: string, slides: NavItem[] = FALLBACK_NAV): NavItem[] {
  return slides
    .filter((s) => s.parentId === parentId)
    .slice()
    .sort((a, b) => a.index - b.index || a.label.localeCompare(b.label))
}

/** Sidebar / filmstrip order: each main slide followed by its subslides. */
export function getSlidesInNavOrder(slides: NavItem[] = FALLBACK_NAV): NavItem[] {
  const ordered: NavItem[] = []
  for (const main of getMainSlides(slides)) {
    ordered.push(main)
    ordered.push(...getSubslides(main.id, slides))
  }
  return ordered
}

export type SlideSequenceNav = {
  prev: NavItem | null
  next: NavItem | null
  index: number
  total: number
}

function getAdjacentMainPhase(
  currentMain: NavItem,
  mains: NavItem[],
  slides: NavItem[],
  direction: 'prev' | 'next',
): NavItem | null {
  const phaseIndex = mains.findIndex((phase) => phase.id === currentMain.id)
  if (phaseIndex === -1) return null

  if (direction === 'prev') {
    return phaseIndex > 0 ? mains[phaseIndex - 1]! : null
  }

  if (phaseIndex < mains.length - 1) {
    return mains[phaseIndex + 1]!
  }

  if (currentMain.loopToId) {
    return getSlideById(currentMain.loopToId, slides) ?? null
  }

  return null
}

/** Previous / next target for phase- and scenario-level detail navigation. */
export function getSlideSequenceNav(
  activeSlideId: string,
  slides: NavItem[] = FALLBACK_NAV,
): SlideSequenceNav {
  const current = getSlideById(activeSlideId, slides)
  const mains = getMainSlides(slides)

  if (!current) {
    return { prev: null, next: null, index: -1, total: mains.length }
  }

  if (!isSubslide(current)) {
    const phaseIndex = mains.findIndex((phase) => phase.id === current.id)
    if (phaseIndex === -1) {
      return { prev: null, next: null, index: -1, total: mains.length }
    }

    return {
      prev: getAdjacentMainPhase(current, mains, slides, 'prev'),
      next: getAdjacentMainPhase(current, mains, slides, 'next'),
      index: phaseIndex,
      total: mains.length,
    }
  }

  const parent = getParentSlide(current, slides)
  if (!parent) {
    return { prev: null, next: null, index: -1, total: 0 }
  }

  const scenarios = getSubslides(parent.id, slides)
  const scenarioIndex = scenarios.findIndex((scenario) => scenario.id === current.id)
  if (scenarioIndex === -1) {
    return { prev: null, next: null, index: -1, total: scenarios.length }
  }

  const prev =
    scenarioIndex > 0
      ? scenarios[scenarioIndex - 1]!
      : getAdjacentMainPhase(parent, mains, slides, 'prev')

  let next: NavItem | null
  if (scenarioIndex < scenarios.length - 1) {
    next = scenarios[scenarioIndex + 1]!
  } else {
    next = getAdjacentMainPhase(parent, mains, slides, 'next')
  }

  return {
    prev,
    next,
    index: scenarioIndex,
    total: scenarios.length,
  }
}

export function getSlideById(id: string, slides: NavItem[] = FALLBACK_NAV): NavItem | undefined {
  return slides.find((s) => s.id === id)
}

export function getParentSlide(
  slide: NavItem,
  slides: NavItem[] = FALLBACK_NAV,
): NavItem | undefined {
  if (!slide.parentId) return undefined
  return getSlideById(slide.parentId, slides)
}

export const WORKSPACE_BREADCRUMB_ID = '__workspace__'
export const WORKSPACE_BREADCRUMB_LABEL = ORG_NAME

export type SlideBreadcrumb = {
  id: string
  label: string
}

/** Breadcrumb trail from workspace root through parent phases to the active slide. */
export function getSlideBreadcrumbs(
  slide: NavItem,
  slides: NavItem[] = FALLBACK_NAV,
): SlideBreadcrumb[] {
  const crumbs: SlideBreadcrumb[] = [
    { id: WORKSPACE_BREADCRUMB_ID, label: WORKSPACE_BREADCRUMB_LABEL },
  ]

  const ancestors: NavItem[] = []
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

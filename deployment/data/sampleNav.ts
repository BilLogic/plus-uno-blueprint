import type { NavItem } from '@/types/nav'

/**
 * The board this deployment shows before its own arrives.
 *
 * It lives here rather than in `@/types/nav` because it is a deployment's
 * CONTENT, not part of the navigation model: every repository built on this
 * kit ships a different one, and a module of types and pure helpers that
 * carries one repository's phases cannot be shared with the next. The kit
 * reads it through `DeploymentConfig.sample.nav`, which is what makes it
 * replaceable rather than baked in.
 */
const PRE_SESSION_ID = 'a0000000-0000-4000-8000-000000000103'
const IN_SESSION_ID = 'a0000000-0000-4000-8000-000000000104'
const POST_SESSION_ID = 'a0000000-0000-4000-8000-000000000105'

/** Offline fallback matching supabase/seed.sql when Supabase is not configured. */
export const SAMPLE_NAV: NavItem[] = [
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
    layout: 'stacked',
    summary: 'Potential tutors discover plus',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000122',
    index: 2,
    label: 'Interview & Offer',
    parentId: 'a0000000-0000-4000-8000-000000000101',
    layout: 'stacked',
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
    layout: 'stacked',
    summary:
      'The tutor sets up necessary tech and obtains required clearances.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000123',
    index: 2,
    label: 'Onboarding Modules',
    parentId: 'a0000000-0000-4000-8000-000000000102',
    layout: 'stacked',
    summary: 'The tutor completes required onboarding modules.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000124',
    index: 3,
    label: 'Lesson Modules',
    parentId: 'a0000000-0000-4000-8000-000000000102',
    layout: 'stacked',
    summary:
      'The tutor goes through required lessons before joining a tutoring session.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000125',
    index: 4,
    label: 'Session Sign Up',
    parentId: 'a0000000-0000-4000-8000-000000000102',
    layout: 'stacked',
    summary:
      'The tutor signs up for recurring sessions for the semester.',
  },
  { id: PRE_SESSION_ID, index: 3, label: 'Pre-session', summary: 'Preparation before a live tutoring session' },
  {
    id: 'a0000000-0000-4000-8000-000000000126',
    index: 1,
    label: 'Standard Scheduling',
    parentId: PRE_SESSION_ID,
    layout: 'stacked',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000127',
    index: 2,
    label: 'Fill-in Request',
    parentId: PRE_SESSION_ID,
    layout: 'stacked',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000128',
    index: 3,
    label: 'Call-off Request',
    parentId: PRE_SESSION_ID,
    layout: 'stacked',
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
    layout: 'stacked',
    summary:
      'Teachers and tutors prepare the session before students join.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000202',
    index: 2,
    label: 'Student Just Joined',
    parentId: IN_SESSION_ID,
    layout: 'stacked',
    summary:
      'Teachers and tutors welcome students as they join the session.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000203',
    index: 3,
    label: 'Warm-Up',
    parentId: IN_SESSION_ID,
    layout: 'stacked',
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
    layout: 'stacked',
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
    layout: 'stacked',
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
    layout: 'stacked',
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
    layout: 'stacked',
    summary:
      'Tutors report session issues to the tutor supervisor team after the session.',
  },
  {
    id: 'a0000000-0000-4000-8000-000000000208',
    index: 2,
    label: 'Reporting Hours',
    parentId: POST_SESSION_ID,
    layout: 'stacked',
    summary: 'Tutors log their tutoring hours after the session.',
  },
]

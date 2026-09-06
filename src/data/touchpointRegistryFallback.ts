import type { TouchpointRegistryEntry } from '@/lib/touchpointColors'

/**
 * The touchpoint registry a board that has no database to read falls back to.
 *
 * `src/lib/touchpointColors.ts` used to carry PLUS's twenty-odd tool names and
 * their colours in a literal. #396 Q48 moved the values to
 * `touchpoints.tone` and `touchpoints.aliases`, because a name like
 * `Handshake` or `PLUS App` is one university tutoring service's vocabulary
 * and has no business in machinery every deployment shares. Every board with a
 * database behind it now reads the columns.
 *
 * Some boards have no database behind them. The twenty-odd fixture files in
 * this directory are the offline blueprint — what `getBlueprintFallback` hands
 * over when Supabase is not configured — and their touchpoint lanes name the
 * tools by the spellings they were written with. There is no column for those
 * to read, so their colours would fall to the deterministic hash and every
 * offline board would repaint. This file is what stops that: the same
 * deployment-owned values, sitting beside the fixture boards they serve, in
 * the directory #326 already quarantines as uno's own data.
 *
 * IT IS A MIRROR, NOT A SOURCE. `touchpoints` is the source; this exists only
 * because a fixture cannot query. Deleting it is a one-line choice whose whole
 * cost is that a board opened with no Supabase configured draws its
 * touchpoints in hashed colours — every deployed and every seeded board is
 * unaffected, because both read the rows.
 *
 * THE SPELLINGS ARE THE FIXTURES', not production's. The hosted database has
 * since renamed some of these — `Google Docs/Slides` without the space,
 * `Clearance guide` without "obtainment" — and the fixtures were not migrated
 * with it. Matching production here would recolour the fixture boards, which
 * is the regression this file exists to prevent, so each name is spelled the
 * way the board that reads it spells it and the newer spelling rides along as
 * an alias.
 */
export const TOUCHPOINT_REGISTRY_FALLBACK: readonly TouchpointRegistryEntry[] =
  [
    { name: 'Bank', tone: 'tomato', aliases: null },
    { name: 'Clearance obtainment guide', tone: 'gold', aliases: null },
    { name: 'Dev Tools', tone: 'indigo', aliases: null },
    { name: 'Email', tone: 'purple', aliases: null },
    { name: 'Figma', tone: 'purple', aliases: null },
    {
      name: 'Google Docs/ Slides',
      tone: 'crimson',
      aliases: ['Google Docs/Slides'],
    },
    {
      name: 'Google Form',
      tone: 'gold',
      // A touchpoint names the THING; which form, which profile, which tooling
      // is the placement summary's job. These are the labels that carried
      // their own specification until Aug 2026, kept so an older fixture still
      // resolves.
      aliases: [
        'Google Form Application',
        'Acceptance Form (Google Form)',
        'Tutor Sign-up Form (Google Form)',
      ],
    },
    { name: 'Google Quiz', tone: 'red', aliases: null },
    {
      name: 'Handshake',
      tone: 'indigo',
      aliases: ['Handshake Employer Profile'],
    },
    { name: 'Marketing Website', tone: 'indigo', aliases: null },
    { name: 'Notion', tone: 'gold', aliases: null },
    { name: 'On-campus booth', tone: 'yellow', aliases: null },
    { name: 'PLUS App', tone: 'yellow', aliases: null },
    { name: 'Posters', tone: 'gold', aliases: null },
    { name: 'Slack', tone: 'tomato', aliases: null },
    { name: 'Social Media', tone: 'crimson', aliases: null },
    {
      name: 'Workday',
      tone: 'indigo',
      // One employer runs one Workday. Which view a person is looking at is
      // the placement's business, not a second touchpoint's.
      aliases: ['Workday (Employee View)', 'Workday (Employer View)'],
    },
    {
      name: 'Zoom',
      tone: 'indigo',
      // PLUS stopped using Pencil, and a fixture still spelling the old pair
      // should find the one tool that is left rather than mint a second. This
      // replaces a regular expression that matched the pair with any spacing;
      // the spellings the fixtures actually use are enumerated instead, which
      // is what a column can hold.
      aliases: ['Zoom/Pencil', 'Zoom/ Pencil', 'Zoom / Pencil'],
    },
    { name: 'Zoom Recording', tone: 'purple', aliases: null },
  ]

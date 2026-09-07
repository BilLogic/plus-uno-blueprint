/**
 * The stock logos the hand-written fallback boards draw.
 *
 * Template assets, shipped under `public/touchpoint-logos`. They live beside
 * the fixtures that name them rather than in `src/lib`, because that is the
 * only thing they are for: a fallback blueprint in this folder has no
 * database behind it, so it writes an asset path where a database board
 * reads `touchpoints.icon_url`.
 *
 * A tool's logo is a property of the touchpoint now (#326) — one string in a
 * column on the registry row, authored once and read off the row wherever
 * the tool appears. `TECH_ITEM_DETAIL_PICTURES` used to sit in
 * `blueprintTechPictures.ts` and match nine tool NAMES against these paths,
 * which meant the renderer decided what a tool looked like and no author
 * could say otherwise. It reached 126 of the 359 placements in production and
 * had nothing to offer the other 233. Authored screenshots were never in it:
 * they are the placement's featured attachment, in the bucket since #278.
 */

export const ZOOM_TECH_LOGO =
  '/touchpoint-logos/zoom-logo.png'

export const SLACK_TECH_LOGO =
  '/touchpoint-logos/slack-logo.png'

export const EMAIL_TECH_LOGO =
  '/touchpoint-logos/email-logo.png'

export const WORKDAY_TECH_LOGO =
  '/touchpoint-logos/workday-logo.png'

export const GOOGLE_FORM_TECH_LOGO =
  '/touchpoint-logos/google-form-logo.png'

export const NOTION_TECH_LOGO =
  '/touchpoint-logos/notion-logo.png'

export const FIGMA_TECH_LOGO =
  '/touchpoint-logos/figma-logo.png'

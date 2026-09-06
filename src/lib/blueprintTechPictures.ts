import { isBlueprintStepStoryboardPlaceholder } from '@/lib/blueprintStoryboardPlaceholder'

// Stock logos are template assets, shipped under `public/touchpoint-logos`.
// Authored screenshots are not: they live in the bucket since #278.

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

const TECH_ITEM_DETAIL_PICTURES: Record<string, readonly string[]> = {
  Zoom: [ZOOM_TECH_LOGO],
  Slack: [SLACK_TECH_LOGO],
  Email: [EMAIL_TECH_LOGO],
  Workday: [WORKDAY_TECH_LOGO],
  'Google Form Application': [GOOGLE_FORM_TECH_LOGO],
  'Shift Swap Google Form': [GOOGLE_FORM_TECH_LOGO],
  'Google Quizzes': [GOOGLE_FORM_TECH_LOGO],
  Notion: [NOTION_TECH_LOGO],
  Figma: [FIGMA_TECH_LOGO],
}


export function getTechItemDetailPictures(
  techItem: string,
): readonly string[] | null {
  return TECH_ITEM_DETAIL_PICTURES[techItem] ?? null
}

/**
 * The images for a detail panel: the tool's stock logo, then the cell's
 * frame. A placement's own picture is its featured attachment (#272), which
 * the panel draws ahead of these — the `screenshot` column that used to come
 * first left for `resources` in #276.
 *
 * This used to take the cell's raw content and links and pick through them,
 * with nine `content === '<tool>'` branches written out by hand — Zoom, PLUS
 * App, Slack, Email, Workday, Google Form, Notion, Google Quiz, Figma —
 * because the label lookup returned nothing for everything else and someone
 * patched the tools they noticed. A single-touchpoint cell now resolves to
 * its placement, so `techItem` carries the name in every one of those cases
 * and the branches said nothing the logo lookup does not.
 *
 * `TECH_ITEM_DETAIL_PICTURES` stays: a stock logo for a well-known tool is a
 * static asset, not authored content, and no placement should have to carry
 * one in order to show it.
 */
export function resolveCellDetailImages(input: {
  techItem?: string | null
  cellFrame?: string | null
}): readonly string[] | null {
  if (input.techItem) {
    const techPictures = getTechItemDetailPictures(input.techItem)
    if (techPictures) return techPictures
  }

  const frame = input.cellFrame?.trim()
  if (!frame || isBlueprintStepStoryboardPlaceholder(frame)) return null
  return [frame]
}

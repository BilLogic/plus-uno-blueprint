import { isBlueprintStepVisualPlaceholder } from '@/lib/blueprintVisualPlaceholder'

export const ZOOM_TECH_LOGO =
  '/blueprint-images/goal-setting/shared/front-stage-tech/zoom-logo.png'

export const SLACK_TECH_LOGO =
  '/blueprint-images/shared/front-stage-tech/slack-logo.png'

export const EMAIL_TECH_LOGO =
  '/blueprint-images/shared/front-stage-tech/email-logo.png'

export const WORKDAY_TECH_LOGO =
  '/blueprint-images/shared/front-stage-tech/workday-logo.png'

export const GOOGLE_FORM_TECH_LOGO =
  '/blueprint-images/shared/front-stage-tech/google-form-logo.png'

export const NOTION_TECH_LOGO =
  '/blueprint-images/shared/back-stage-tech/notion-logo.png'

export const FIGMA_TECH_LOGO =
  '/blueprint-images/shared/back-stage-tech/figma-logo.png'

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
 * The images for a detail panel: the placement's own screenshot first, then
 * the tool's stock logo, then the cell's picture.
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
export function resolveCellDetailPictures(input: {
  screenshot?: string | null
  techItem?: string | null
  cellPicture?: string | null
}): readonly string[] | null {
  if (input.screenshot?.trim()) return [input.screenshot.trim()]

  if (input.techItem) {
    const techPictures = getTechItemDetailPictures(input.techItem)
    if (techPictures) return techPictures
  }

  const picture = input.cellPicture?.trim()
  if (!picture || isBlueprintStepVisualPlaceholder(picture)) return null
  return [picture]
}

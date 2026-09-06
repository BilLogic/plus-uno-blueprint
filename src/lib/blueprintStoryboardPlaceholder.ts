/**
 * Shown in the Storyboard swimlane when a step has no partner/lead/regular
 * tutor frames yet.
 *
 * THE FILENAME KEEPS THE RETIRED WORD, and has to. It is a VALUE, written into
 * fourteen applied migrations as a `cells.frame`, so renaming the asset would
 * turn every placeholder on the board into a real frame. #391 moved the copy
 * inside the SVG and left its name where the data points.
 */
export const BLUEPRINT_STEP_STORYBOARD_PLACEHOLDER =
  '/step-visual-placeholder.svg'

export function isBlueprintStepStoryboardPlaceholder(
  frame: string | null | undefined,
): boolean {
  const trimmed = frame?.trim()
  if (!trimmed) return true
  return trimmed === BLUEPRINT_STEP_STORYBOARD_PLACEHOLDER
}

/** Returns frames as-is; the Storyboard swimlane stays empty when none are
 *  provided. */
export function withBlueprintStepStoryboardPlaceholder(
  frames: readonly string[] | undefined,
): readonly string[] {
  return frames ?? []
}

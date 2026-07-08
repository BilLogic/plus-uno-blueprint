/** Shown in the Visual swimlane when a step has no partner/lead/regular tutor pictures yet. */
export const BLUEPRINT_STEP_VISUAL_PLACEHOLDER =
  '/blueprint-images/shared/step-visual-placeholder.svg'

export function withBlueprintStepVisualPlaceholder(
  pictures: readonly string[] | undefined,
): readonly string[] {
  if (pictures && pictures.length > 0) return pictures
  return [BLUEPRINT_STEP_VISUAL_PLACEHOLDER]
}

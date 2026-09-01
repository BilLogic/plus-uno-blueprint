import { PathLabelBadge } from '@/components/blueprint/PathLabelBadge'
import {
  getPathTypeSectionBorderStyle,
} from '@/lib/pathTypeTheme'
import { blueprintPanelSectionFillColor } from '@/lib/blueprintTheme'
import {
  COMPARE_PATH_SECTION_H_INSET,
  COMPARE_PATH_SECTION_TOP_INSET,
  COMPARE_PATH_SECTION_BOTTOM_INSET,
  COMPARE_LABEL_TRACK_WIDTH,
} from '@/lib/sideBySideCompareLayout'
import { LAYER_COLUMN_WIDTH, STEP_COLUMN_GAP } from '@/lib/blueprintLayout'
import type { BlueprintData } from '@/types/blueprint'

/** Uniform inset for single-path service blueprint section frames. */
export const SERVICE_PATH_SECTION_INSET = 8
/**
 * The service grid's rail carries its own full-height divider, so the frame
 * starts where the step columns start rather than insetting back over it.
 * Without this the outline sat 8px INSIDE the rail, giving that view two
 * vertical lines 8px apart describing one edge.
 */
export const SERVICE_PATH_SECTION_LEFT_INSET = 0

type ComparePathSectionFrameProps = {
  blueprint: BlueprintData
  /** When false, only the colored path outline is rendered (service blueprint). */
  showTitle?: boolean
  /**
   * Overview mode: prefer a path-type badge for generic names (Happy Path, etc.).
   * Named paths (Set Goals, …) always show their title.
   */
  /** Compare uses extra top inset for the title badge; service uses uniform inset. */
  variant?: 'compare' | 'service'
  /** Row-axis labels sit outside the path boundary in every arrangement. */
  excludeLabelRail?: boolean
}

/** Figma-style section: path-type outline, grouped fill, optional title on the top edge. */
export function ComparePathSectionFrame({
  blueprint,
  showTitle = true,
  variant = 'compare',
  excludeLabelRail = false,
}: ComparePathSectionFrameProps) {
  const { path } = blueprint
  const pathBorder = getPathTypeSectionBorderStyle(path.kind, path)
  const { borderColor, borderStyle, borderWidth } = pathBorder
  const sectionFill = blueprintPanelSectionFillColor()
  const labelAxisOffset = excludeLabelRail
    ? variant === 'service'
      ? LAYER_COLUMN_WIDTH
      : COMPARE_LABEL_TRACK_WIDTH + STEP_COLUMN_GAP
    : 0

  const inset =
    variant === 'compare'
      ? {
          top: -COMPARE_PATH_SECTION_TOP_INSET,
          left: labelAxisOffset - COMPARE_PATH_SECTION_H_INSET,
          right: -COMPARE_PATH_SECTION_H_INSET,
          bottom: -COMPARE_PATH_SECTION_BOTTOM_INSET,
        }
      : {
          top: -SERVICE_PATH_SECTION_INSET,
          left: labelAxisOffset - SERVICE_PATH_SECTION_LEFT_INSET,
          right: -SERVICE_PATH_SECTION_INSET,
          bottom: -SERVICE_PATH_SECTION_INSET,
        }

  const titleTop =
    variant === 'compare'
      ? -COMPARE_PATH_SECTION_TOP_INSET
      : -SERVICE_PATH_SECTION_INSET
  const titleLeft =
    variant === 'compare'
      ? labelAxisOffset - COMPARE_PATH_SECTION_H_INSET + 10
      : labelAxisOffset - SERVICE_PATH_SECTION_LEFT_INSET + 10

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-xl"
        style={{
          ...inset,
          borderWidth,
          borderStyle,
          borderColor,
          backgroundColor: sectionFill,
        }}
      />
      {showTitle ? (
        <PathLabelBadge
          name={path.name}
          description={path.summary}
          pathKind={path.kind}
          className="pointer-events-auto absolute z-50 max-w-[calc(100%-12px)]"
          style={{
            top: titleTop,
            left: titleLeft,
            transform: 'translateY(-50%)',
          }}
        />
      ) : null}
    </>
  )
}

import { PathLabelBadge } from '@/components/blueprint/PathLabelBadge'
import { ScenarioTitleBadge } from '@/components/blueprint/ScenarioTitleBadge'
import { getPathTypeSectionBorderStyle } from '@/lib/pathTypeTheme'
import { BLUEPRINT_THEME } from '@/lib/blueprintTheme'
import {
  COMPARE_PATH_SECTION_INSET,
  COMPARE_PATH_SECTION_TOP_INSET,
} from '@/lib/sideBySideCompareLayout'
import type { BlueprintData } from '@/types/blueprint'

/** Uniform inset for single-path service blueprint section frames. */
export const SERVICE_PATH_SECTION_INSET = 8

type ComparePathSectionFrameProps = {
  blueprint: BlueprintData
  compact?: boolean
  /** When false, only the colored path outline is rendered (service blueprint). */
  showTitle?: boolean
  /** When set, replaces the path-type badge with a plain scenario title badge. */
  titleLabel?: string
  titleDescription?: string | null
  /** Compare uses extra top inset for the title badge; service uses uniform inset. */
  variant?: 'compare' | 'service'
}

/** Figma-style section: path-type outline, grouped fill, optional title on the top edge. */
export function ComparePathSectionFrame({
  blueprint,
  compact,
  showTitle = true,
  titleLabel,
  titleDescription,
  variant = 'compare',
}: ComparePathSectionFrameProps) {
  const { path } = blueprint
  const pathBorder = getPathTypeSectionBorderStyle(path.path_type)
  const borderColor = titleLabel ? 'var(--primary)' : pathBorder.borderColor
  const { borderStyle, borderWidth } = pathBorder
  const sectionFill = BLUEPRINT_THEME.sectionFill

  const inset =
    variant === 'compare'
      ? {
          top: -COMPARE_PATH_SECTION_TOP_INSET,
          left: -COMPARE_PATH_SECTION_INSET,
          right: -COMPARE_PATH_SECTION_INSET,
          bottom: -COMPARE_PATH_SECTION_INSET,
        }
      : {
          top: -SERVICE_PATH_SECTION_INSET,
          left: -SERVICE_PATH_SECTION_INSET,
          right: -SERVICE_PATH_SECTION_INSET,
          bottom: -SERVICE_PATH_SECTION_INSET,
        }

  const titleTop =
    variant === 'compare' ? -COMPARE_PATH_SECTION_TOP_INSET : -SERVICE_PATH_SECTION_INSET
  const titleLeft =
    variant === 'compare'
      ? COMPARE_PATH_SECTION_INSET + 2
      : SERVICE_PATH_SECTION_INSET + 2

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
        titleLabel ? (
          <ScenarioTitleBadge
            name={titleLabel}
            description={titleDescription}
            className="pointer-events-auto absolute z-50 max-w-[calc(100%-12px)]"
            style={{
              top: titleTop,
              left: titleLeft,
              transform: 'translateY(-50%)',
            }}
          />
        ) : (
          <PathLabelBadge
            name={path.name}
            description={path.description}
            pathType={path.path_type}
            compact={compact}
            className="pointer-events-auto absolute z-50 max-w-[calc(100%-12px)]"
            style={{
              top: titleTop,
              left: titleLeft,
              transform: 'translateY(-50%)',
            }}
          />
        )
      ) : null}
    </>
  )
}

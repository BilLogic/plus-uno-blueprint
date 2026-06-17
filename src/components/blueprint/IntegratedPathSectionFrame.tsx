import { PathLabelBadge } from '@/components/blueprint/PathLabelBadge'
import { BLUEPRINT_THEME } from '@/lib/blueprintTheme'
import {
  getPathTypeSectionBorderStyle,
  PATH_TYPE_SECTION_BORDER_WIDTH,
} from '@/lib/pathTypeTheme'
import {
  COMPARE_PATH_SECTION_INSET,
  COMPARE_PATH_SECTION_TOP_INSET,
} from '@/lib/sideBySideCompareLayout'
import type { PathType } from '@/types/database'

export type IntegratedPathSectionPath = {
  id: string
  name: string
  description: string | null
  path_type: PathType
}

type IntegratedPathSectionFrameProps = {
  paths: IntegratedPathSectionPath[]
  compact?: boolean
}

/** Integrated blueprint outline: nested path-type borders + active path labels on the top edge. */
export function IntegratedPathSectionFrame({
  paths,
  compact,
}: IntegratedPathSectionFrameProps) {
  const sectionFill = BLUEPRINT_THEME.sectionFill
  const borderW = PATH_TYPE_SECTION_BORDER_WIDTH

  if (paths.length === 0) {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-xl"
        style={{
          top: -COMPARE_PATH_SECTION_TOP_INSET,
          left: -COMPARE_PATH_SECTION_INSET,
          right: -COMPARE_PATH_SECTION_INSET,
          bottom: -COMPARE_PATH_SECTION_INSET,
          backgroundColor: sectionFill,
        }}
      />
    )
  }

  return (
    <>
      {paths.map((path, index) => {
        const offset = index * borderW
        const { borderColor, borderStyle, borderWidth } =
          getPathTypeSectionBorderStyle(path.path_type)
        const isInnermost = index === paths.length - 1

        return (
          <div
            key={path.id}
            aria-hidden
            className="pointer-events-none absolute rounded-xl"
            style={{
              top: -COMPARE_PATH_SECTION_TOP_INSET + offset,
              left: -COMPARE_PATH_SECTION_INSET + offset,
              right: -COMPARE_PATH_SECTION_INSET + offset,
              bottom: -COMPARE_PATH_SECTION_INSET + offset,
              borderWidth,
              borderStyle,
              borderColor,
              backgroundColor: isInnermost ? sectionFill : 'transparent',
            }}
          />
        )
      })}

      <div
        className="pointer-events-none absolute z-50 flex max-w-[calc(100%-12px)] flex-wrap items-center gap-2"
        style={{
          top: -COMPARE_PATH_SECTION_TOP_INSET,
          left: COMPARE_PATH_SECTION_INSET + 2,
          transform: 'translateY(-50%)',
        }}
      >
        {paths.map((path) => (
          <PathLabelBadge
            key={path.id}
            name={path.name}
            description={path.description}
            pathType={path.path_type}
            compact={compact}
            className="pointer-events-auto"
          />
        ))}
      </div>
    </>
  )
}

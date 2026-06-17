import {
  ARROW_CHEVRON_SIZE,
  ARROW_MARKER_PAD,
  ARROW_MARKER_REF_X,
  ARROW_MARKER_REF_Y,
  ARROW_STROKE_WIDTH,
} from '@/lib/blueprintArrowGeometry'
import { getPathTypeArrowColor } from '@/lib/pathTypeTheme'
import type { PathType } from '@/types/database'

const PATH_TYPES: PathType[] = ['happy', 'unhappy', 'exception', 'alternative']

type BlueprintArrowMarkerDefsProps = {
  markerIds: Record<PathType, string>
}

/** Lucide-style filled arrowheads — shared by blueprint arrow overlays. */
export function BlueprintArrowMarkerDefs({
  markerIds,
}: BlueprintArrowMarkerDefsProps) {
  const tip = ARROW_CHEVRON_SIZE
  const mid = ARROW_CHEVRON_SIZE / 2

  return (
    <>
      {PATH_TYPES.map((type) => (
        <marker
          key={type}
          id={markerIds[type]}
          viewBox={`${-ARROW_MARKER_PAD} ${-ARROW_MARKER_PAD} ${ARROW_CHEVRON_SIZE + ARROW_MARKER_PAD * 2} ${ARROW_CHEVRON_SIZE + ARROW_MARKER_PAD * 2}`}
          refX={ARROW_MARKER_REF_X}
          refY={ARROW_MARKER_REF_Y}
          markerWidth={ARROW_CHEVRON_SIZE}
          markerHeight={ARROW_CHEVRON_SIZE}
          orient="auto"
          markerUnits="userSpaceOnUse"
          overflow="visible"
        >
          <path
            d={`M 0 0 L ${tip} ${mid} L 0 ${tip} Z`}
            fill={getPathTypeArrowColor(type)}
          />
        </marker>
      ))}
    </>
  )
}

export function blueprintArrowPathProps(pathType: PathType) {
  return {
    fill: 'none' as const,
    stroke: getPathTypeArrowColor(pathType),
    strokeWidth: ARROW_STROKE_WIDTH,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
}

export const BLUEPRINT_ARROW_PATH_TYPES = PATH_TYPES

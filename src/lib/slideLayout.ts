import {
  getMainSlides,
  getSubslides,
  isSubslide,
  type Slide,
} from '@/types/slides'
import {
  getBlueprintArtboardSize,
  type ArtboardSize,
} from '@/lib/blueprintLayout'
import type { BlueprintData } from '@/types/blueprint'

export const CANVAS_WIDTH = 16000
export const CANVAS_HEIGHT = 6000
export const SLIDE_ARTBOARD_WIDTH = 960
export const SLIDE_ARTBOARD_HEIGHT = (SLIDE_ARTBOARD_WIDTH * 9) / 16
export const SLIDE_GAP = 160
export const SUBSLIDE_GAP = 96
/** Equal gray margin around blueprint artboards in the stack zoom viewport. */
export const BLUEPRINT_VIEWPORT_ARTBOARD_MARGIN = 48
/** Space between a canvas artboard and the header card above it. */
export const CANVAS_SLIDE_HEADER_GAP = 16
/** Reserved vertical space for the header card above each canvas artboard. */
export const CANVAS_SLIDE_HEADER_ESTIMATED_HEIGHT = 96
export const CANVAS_SLIDE_HEADER_BLOCK =
  CANVAS_SLIDE_HEADER_GAP + CANVAS_SLIDE_HEADER_ESTIMATED_HEIGHT

export const DEFAULT_ARTBOARD_SIZE: ArtboardSize = {
  width: SLIDE_ARTBOARD_WIDTH,
  height: SLIDE_ARTBOARD_HEIGHT,
}

export type SlidePosition = { x: number; y: number }
export type SlideLayout = SlidePosition & ArtboardSize

export function getSlideArtboardSize(
  slide: Slide,
  blueprintsByScenario: Map<string, BlueprintData>,
): ArtboardSize {
  if (!isSubslide(slide)) return DEFAULT_ARTBOARD_SIZE
  const blueprint = blueprintsByScenario.get(slide.id)
  if (blueprint) return getBlueprintArtboardSize(blueprint)
  return DEFAULT_ARTBOARD_SIZE
}

/** Main slides stacked vertically; scenarios extend horizontally with per-slide widths. */
export function computeSlideLayouts(
  slides: Slide[],
  blueprintsByScenario: Map<string, BlueprintData> = new Map(),
  layoutOverrides: Map<string, ArtboardSize> = new Map(),
): Map<string, SlideLayout> {
  const layouts = new Map<string, SlideLayout>()
  const mains = getMainSlides(slides)

  const stackHeight =
    mains.length * (CANVAS_SLIDE_HEADER_BLOCK + SLIDE_ARTBOARD_HEIGHT) +
    Math.max(0, mains.length - 1) * SLIDE_GAP
  const stackTop = (CANVAS_HEIGHT - stackHeight) / 2
  const mainX = (CANVAS_WIDTH - SLIDE_ARTBOARD_WIDTH) / 2

  let mainRowY = stackTop
  mains.forEach((slide) => {
    layouts.set(slide.id, {
      x: mainX,
      y: mainRowY + CANVAS_SLIDE_HEADER_BLOCK,
      ...DEFAULT_ARTBOARD_SIZE,
    })
    mainRowY +=
      CANVAS_SLIDE_HEADER_BLOCK + SLIDE_ARTBOARD_HEIGHT + SLIDE_GAP
  })

  for (const main of mains) {
    const parent = layouts.get(main.id)
    if (!parent) continue

    const children = getSubslides(main.id, slides)
    let cursorX = parent.x + parent.width + SUBSLIDE_GAP

    children.forEach((child) => {
      const size =
        layoutOverrides.get(child.id) ??
        getSlideArtboardSize(child, blueprintsByScenario)
      layouts.set(child.id, {
        x: cursorX,
        y: parent.y,
        ...size,
      })
      cursorX += size.width + SUBSLIDE_GAP
    })
  }

  return layouts
}

export function computeSlidePositions(
  slides: Slide[],
  blueprintsByScenario?: Map<string, BlueprintData>,
): Map<string, SlidePosition> {
  const layouts = computeSlideLayouts(slides, blueprintsByScenario)
  const positions = new Map<string, SlidePosition>()
  layouts.forEach((layout, id) => {
    positions.set(id, { x: layout.x, y: layout.y })
  })
  return positions
}

export function getSlideLayout(
  slideId: string,
  slides: Slide[],
  blueprintsByScenario?: Map<string, BlueprintData>,
): SlideLayout {
  const layouts = computeSlideLayouts(slides, blueprintsByScenario)
  return (
    layouts.get(slideId) ?? {
      x: (CANVAS_WIDTH - SLIDE_ARTBOARD_WIDTH) / 2,
      y: (CANVAS_HEIGHT - SLIDE_ARTBOARD_HEIGHT) / 2,
      ...DEFAULT_ARTBOARD_SIZE,
    }
  )
}

export function getSlideCanvasPosition(
  slideId: string,
  slides: Slide[],
  blueprintsByScenario?: Map<string, BlueprintData>,
): SlidePosition {
  const { x, y } = getSlideLayout(slideId, slides, blueprintsByScenario)
  return { x, y }
}

export function getSlideCanvasCenter(
  slideId: string,
  slides: Slide[],
  blueprintsByScenario?: Map<string, BlueprintData>,
) {
  const layout = getSlideLayout(slideId, slides, blueprintsByScenario)
  return {
    x: layout.x + layout.width / 2,
    y: layout.y + layout.height / 2,
  }
}

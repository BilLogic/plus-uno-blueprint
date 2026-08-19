import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const serviceOverview = readFileSync(
  fileURLToPath(
    new URL('../components/editor/ServiceOverviewView.tsx', import.meta.url),
  ),
  'utf8',
)
const zoomPanViewport = readFileSync(
  fileURLToPath(new URL('../hooks/useZoomPanViewport.ts', import.meta.url)),
  'utf8',
)

describe('focused comparison camera contract', () => {
  it('treats path and compare-mode changes as animated layout events', () => {
    expect(serviceOverview).toContain('focusedComparisonCameraKey')
    expect(serviceOverview).toContain('overviewSelectedPathIds.join')
    expect(serviceOverview).toContain('getScenarioDisplayViewType(activeSlide)')
    expect(serviceOverview).toContain(
      'animateFit={!skipCanvasFitAnimation && contentSettled}',
    )
    expect(zoomPanViewport).toContain(
      'useLayoutEffect(() => {\n    if (resetKey === undefined) return',
    )
  })

  it('keeps content visible at the fitted scale of a multi-path comparison', () => {
    expect(serviceOverview).toContain(
      'const COMPARE_SEMANTIC_ZOOM_THRESHOLD = 0.12',
    )
    expect(serviceOverview).toContain(
      'isDetail && overviewSelectedPathIds.length > 1',
    )
  })
})

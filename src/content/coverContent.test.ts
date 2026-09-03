import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { coverFigures, coverTabSections } from '@/components/cover/coverModel'
import { coverContent } from '@/content/coverContent'

/*
 * Uno's cover content contract.
 *
 * The renderers are shared with the agentic-service-blueprinting template,
 * where the equivalent test forbids deployment vocabulary (PLUS, uno,
 * tutor) to keep that skin generalized. This is the deployment, so that
 * gate is deliberately absent — uno's whole first tab is about PLUS. What
 * still has to hold is everything a reader would notice if it broke: the
 * figures resolve, the alt text says something, and the tab order is the
 * one the page was designed around.
 *
 * Assets are committed to `public/` here rather than synced from a
 * `docs/assets/` single source, so this test reads the served directory.
 */

const PUBLIC_DIR = fileURLToPath(new URL('../../public', import.meta.url))

describe('coverContent', () => {
  it('leads with uno’s own service, then the generalized tabs', () => {
    expect(coverContent.tabs.map((tab) => tab.label)).toEqual([
      'The service',
      'Overview',
      'Blueprints',
      'Slices',
      'Skills',
    ])
  })

  it('every figure it references is actually on disk', () => {
    const missing = coverFigures(coverContent)
      .map((figure) => figure.src)
      .filter((src) => !existsSync(join(PUBLIC_DIR, src)))
    expect(missing).toEqual([])
  })

  it('every image carries alt text that describes it', () => {
    for (const image of coverFigures(coverContent)) {
      // Long enough to be a description rather than a restated filename.
      expect(image.alt.length, image.src).toBeGreaterThan(10)
    }
  })

  it('every wide diagram figure carries its viewBox dimensions', () => {
    // Portrait images (the-service tab) are fixed-size by CSS, not by their
    // own dimensions, so this is scoped to sections with a `figure` slot.
    // `coverTabSections` flattens both a content tab's sections and the
    // services tab's per-service pages, so a figure on any page is still checked.
    const figures = coverContent.tabs
      .flatMap((tab) => coverTabSections(tab))
      .flatMap((section) => ('figure' in section && section.figure ? [section.figure] : []))
    expect(figures.length).toBeGreaterThan(0)
    for (const figure of figures) {
      expect(figure.width, figure.src).toBeGreaterThan(0)
      expect(figure.height, figure.src).toBeGreaterThan(0)
    }
  })

  it('names the service and its own call to action', () => {
    expect(coverContent.title).toBe('Uno Blueprint')
    expect(coverContent.primaryCtaLabel).toBe('View PLUS Blueprints')
  })

  it('drops the guide links, having no public repo docs to point at', () => {
    // `repoUrl` unset is what suppresses them — see coverModel.CoverGuideLink.
    expect(coverContent.repoUrl).toBeUndefined()
  })
})

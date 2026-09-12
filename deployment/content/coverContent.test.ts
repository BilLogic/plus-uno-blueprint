import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { coverFigures, coverTabSections } from '@/components/cover/coverModel'
import { packageCoverFigures } from '@/components/cover/packageCoverFigures'
import { coverContent } from '~/content/coverContent'

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
 * The images come from two places, and the split is authorship. The thirteen
 * model diagrams are the package's, imported as modules, so they are checked
 * against what the package supplies and against the files it authored them
 * from. The portraits are this deployment's own artwork and are named as
 * paths into `public/`, so those are checked on disk. A figure that reaches
 * neither test is what this pair exists to catch.
 */

const PUBLIC_DIR = fileURLToPath(new URL('../../public', import.meta.url))
/** Where the package authors its figures — the far side of the imports. */
const PACKAGE_ASSETS_DIR = fileURLToPath(
  new URL('../../node_modules/agentic-service-blueprinting/docs/assets', import.meta.url),
)

/** The figures the package brings, by the `src` an import resolves to. */
const SUPPLIED = new Set(Object.values(packageCoverFigures).map((figure) => figure.src))

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

  it('draws every diagram from the ones the package brings with it', () => {
    // Not a path this page names — a module it imports. A named path is served
    // by whatever tree holds the file, and for a deployment that tree is not
    // the package's: every `/cover/…` request fell through to the single-page
    // fallback and came back 200 with HTML in it. An import is resolved by the
    // bundler and fails the build when it is missing.
    // Membership in `SUPPLIED` is the test AND the discriminator below: what
    // an import resolves to is the bundler's business — a `/assets/…-hash.svg`
    // in a build, a path under `node_modules` in this suite — so nothing here
    // reads the shape of the string.
    const diagrams = coverFigures(coverContent).filter((figure) => SUPPLIED.has(figure.src))
    expect(diagrams.length).toBe(13)
  })

  it('resolves each of the package’s diagrams to the file it authored', () => {
    for (const figure of Object.values(packageCoverFigures)) {
      const name = basename(figure.src.split('?')[0])
      expect(existsSync(join(PACKAGE_ASSETS_DIR, name)), `missing ${name}`).toBe(true)
    }
  })

  it('serves its own portraits out of public/, and only those', () => {
    // This deployment's artwork: the logomark and the tutor illustration. They
    // are the only images it authors, so they are the only ones named as paths.
    const served = coverFigures(coverContent)
      .map((figure) => figure.src)
      .filter((src) => !SUPPLIED.has(src))
    expect(served).toEqual(['/homepage/plus-icon.png', '/homepage/tutor-illustration.png'])
    expect(served.filter((src) => !existsSync(join(PUBLIC_DIR, src)))).toEqual([])
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

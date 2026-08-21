import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PATH_BLUEPRINT_SELECT } from '@/lib/workflowQueries'

const src = (path: string) =>
  readFileSync(join(process.cwd(), 'src', path), 'utf8')

/**
 * `cells.maturity` replaced a `Planned — ` prefix on the cell's own label.
 *
 * That prefix was wrong — a maturity is not part of a touchpoint's NAME, and
 * the vocabulary had gained products called "Planned — swap flow UI" — but it
 * had one virtue: the canvas said it for free, on every one of the fifty cells
 * that carried it. A column that nothing renders is strictly worse than the
 * prefix was, because fifty design explorations then read as shipped surfaces.
 *
 * These assertions are the price of having moved it.
 */
describe('cell maturity survives the move off the label', () => {
  it('is read by the query the canvas draws from', () => {
    expect(PATH_BLUEPRINT_SELECT).toContain('maturity')
  })

  it('reaches the cell face, which marks itself', () => {
    const button = src('components/blueprint/BlueprintCellButton.tsx')
    expect(button).toContain('data-blueprint-cell-maturity')
    expect(button).toMatch(/maturity &&\s*'border-dashed/)
  })

  it('is passed by every component that draws a cell', () => {
    for (const path of [
      'components/blueprint/CompareCellBlock.tsx',
      'components/blueprint/ServiceBlueprintGrid.tsx',
      'components/blueprint/BlueprintTechPill.tsx',
    ]) {
      expect(src(path), path).toContain('maturity={')
    }
  })

  it('is named in the panel, not left to the summary prose', () => {
    expect(src('components/blueprint/CellContentSection.tsx')).toContain(
      'cell.maturity',
    )
  })

  it('no cell label carries the maturity it used to', () => {
    // The fallbacks are the offline copy of the board; a `Planned — ` here
    // would put the prefix back on a canvas no migration can reach.
    const dir = join(process.cwd(), 'src', 'data')
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => readFileSync(join(dir, f), 'utf8').includes('Planned \u2014 '))
    expect(offenders).toEqual([])
  })
})

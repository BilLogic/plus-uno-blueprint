import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PATH_BLUEPRINT_SELECT } from '@/lib/workflowQueries'
import {
  CELL_MATURITY,
  CELL_MATURITY_LABEL,
  CELL_MATURITY_MEANING,
} from '@/lib/cellMaturity'

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
    expect(button).toMatch(/isUnbuilt\(maturity\) &&\s*'border-dashed/)
    // Deprecated exists and works; a dashed edge would say the opposite.
    expect(button).toMatch(/maturity === 'deprecated' &&/)
  })

  it('loses NOTHING between the query and the canvas', () => {
    /*
      The general form of the bug, rather than one field's version of it.

      `normalizeBlueprint` builds a BlueprintCell by listing its fields by
      hand. A column added to the select and not added there arrives as
      `undefined`, and every check a developer would run stays green:
      typecheck passes because the field is optional, the tests pass because
      none of them look, and the canvas quietly does nothing. It has happened
      twice — `maturity`, caught the same day, and `position`, which was
      selected, typed and SORTED ON for two weeks while the sort compared
      undefined to undefined across 63 slots.

      So: every field the query asks for must appear in the mapper. Not a
      field-by-field assertion that has to be remembered; a comparison of the
      two lists, which cannot be forgotten.
    */
    const open = PATH_BLUEPRINT_SELECT.indexOf('cells (')
    expect(open, 'the select no longer has a cells block').toBeGreaterThan(-1)
    let depth = 0
    let end = -1
    for (let i = PATH_BLUEPRINT_SELECT.indexOf('(', open); i < PATH_BLUEPRINT_SELECT.length; i += 1) {
      const ch = PATH_BLUEPRINT_SELECT[i]
      if (ch === '(') depth += 1
      else if (ch === ')') {
        depth -= 1
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    const inner = PATH_BLUEPRINT_SELECT.slice(
      PATH_BLUEPRINT_SELECT.indexOf('(', open) + 1,
      end,
    )
    // Drop the embedded relations — those are mapped separately.
    const selected = inner
      .replace(/[a-z_]+:[^(]*\([\s\S]*?\)/g, '')
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean)

    const source = src('lib/normalizeBlueprint.ts')
    const mapStart = source.indexOf('rawCells.map((cell) => ({')
    expect(mapStart, 'the cell mapper moved').toBeGreaterThan(-1)
    const mapper = source.slice(mapStart, source.indexOf('}))', mapStart))

    const missing = selected.filter(
      (field) => !new RegExp(`(^|\\s)${field}:`, 'm').test(mapper),
    )
    expect(
      missing,
      `selected by the query and dropped by the mapper: ${missing.join(', ')}`,
    ).toEqual([])
    // And the reverse is worth knowing too: a mapper field nothing selects.
    expect(selected.length).toBeGreaterThan(5)
  })

  it('survives the normalizer between the query and the canvas', () => {
    // It did not, the first time: the query read the column, every component
    // passed it on, the tests were green, and the canvas drew nothing —
    // because the mapper that builds a BlueprintCell listed its fields by
    // hand and this one was not among them.
    const normalize = src('lib/normalizeBlueprint.ts')
    expect(normalize).toContain('maturity?: string | null')
    expect(normalize).toMatch(/CELL_MATURITY as readonly string\[\]\)\.includes/)
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

  it('has one rung per state the panel can name', () => {
    // The ladder, the label and the meaning are three lists that must agree.
    // They drifted once already: `planned` and `prototype` were two words for
    // "not built" that did not order, and the one marked `planned` was code
    // already in QA.
    for (const rung of CELL_MATURITY) {
      expect(CELL_MATURITY_LABEL[rung], rung).toBeTruthy()
      expect(CELL_MATURITY_MEANING[rung], rung).toBeTruthy()
    }
    expect(Object.keys(CELL_MATURITY_LABEL).sort()).toEqual(
      [...CELL_MATURITY].sort(),
    )
    expect(Object.keys(CELL_MATURITY_MEANING).sort()).toEqual(
      [...CELL_MATURITY].sort(),
    )
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

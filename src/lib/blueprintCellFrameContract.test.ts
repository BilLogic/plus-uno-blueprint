import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CELL_CONTENT_TARGET,
  CELL_CONTENT_WARNING,
  getCellContentLengthGuidance,
} from '@/lib/cellContentLimits'
import {
  STORYBOARD_ROW_MIN_HEIGHT,
  STORYBOARD_ROW_MIN_HEIGHT_COMPACT,
  getStoryboardCellButtonMaxHeight,
} from '@/lib/blueprintLayout'

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

const visual = source('../components/blueprint/BlueprintStepVisual.tsx')
// The one-path board is a stacked board with one band since #280; the
// classic single-path grid that used to sit here is gone (#285).
const labelRail = source('../components/blueprint/BlueprintLabelRail.tsx')
const compareCell = source('../components/blueprint/CompareCellBlock.tsx')
const scenarioPanel = source(
  '../components/blueprint/ScenarioBlueprintPanel.tsx',
)
const phaseOverview = source(
  '../components/blueprint/PhaseScenarioOverview.tsx',
)
const compareDecorations = source(
  '../components/blueprint/CompareTrackDecorations.tsx',
)
const pathFrame = source(
  '../components/blueprint/ComparePathSectionFrame.tsx',
)
const pathBand = source('../components/blueprint/BlueprintPathBand.tsx')
const touchpointCell = source(
  '../components/blueprint/BlueprintTouchpointCell.tsx',
)
const laneHeader = source(
  '../components/blueprint/LaneHeaderAffordance.tsx',
)
const stepHeader = source(
  '../components/blueprint/StepHeaderAffordance.tsx',
)
const css = source('../styles/blueprint.css')
const agentRegistry = source('./agent/tools/registry.ts')
const agentSpecs = source('./agent/tools/specs.ts')

describe('stable blueprint cell frame contract', () => {
  it('keeps storyboard geometry at 4:3 and fits image pixels inside it', () => {
    expect(visual).toContain("'aspect-[4/3]")
    expect(visual).toContain('w-full max-w-full')
    /*
      `w-auto`, not `w-full`. The picture must be allowed to size its own box
      so the corner radius lands on the ARTWORK — stretched to the full cell
      the box is wider than the picture, `object-contain` letterboxes, and the
      radius rounds empty space while the artwork keeps square corners inside
      a cell rounded at 10px. `max-w-full` is what still keeps the pixels
      inside the frame, which is what this contract is really about.
    */
    expect(visual).toContain(
      "'h-full w-auto max-w-full rounded-[calc(var(--radius-lg)-var(--spacing)-1px)] object-contain",
    )
    expect(STORYBOARD_ROW_MIN_HEIGHT).toBe(176)
    expect(STORYBOARD_ROW_MIN_HEIGHT_COMPACT).toBe(168)
    expect(getStoryboardCellButtonMaxHeight()).toBe(144)
    expect(getStoryboardCellButtonMaxHeight(true)).toBe(144)
  })

  it('keeps one grid arrangement and geometry across overview and focus', () => {
    // #285: the single-path grid and the side-by-side grid are gone, not
    // merely unreached — a renderer nothing draws is a contract nothing holds.
    expect(existsSync(new URL('../components/blueprint/ServiceBlueprintGrid.tsx', import.meta.url))).toBe(false)
    expect(existsSync(new URL('../components/blueprint/SideBySideCompareGrid.tsx', import.meta.url))).toBe(false)
    expect(scenarioPanel).not.toContain('ServiceBlueprintGrid')
    expect(scenarioPanel).not.toContain('SideBySideCompareGrid')
    expect(scenarioPanel).not.toContain('isOverviewConstrained')
    expect(scenarioPanel).not.toContain('focusActive ?')
    expect(phaseOverview).toContain('displayViewType={scenarioViewType}')
    // Focus may not branch the panel's geometry props. The one height a
    // panel takes is `panelHeightFor`, and the focused panel's number comes
    // from `useAlignedPhaseRowPanelHeight` with its own estimate handed back
    // as the floor — so the number it has focused equals the one it had at
    // overview. The single-view swimlane height, which branched on focus,
    // went with the single view (#280).
    expect(phaseOverview).toContain('lockedPanelHeight={panelHeightFor(scenario.id)}')
    expect(phaseOverview).toContain('focusedPanelHeightFloor,')
    expect(phaseOverview).not.toContain('fixedSwimlaneBodyHeight')
    /*
      The frame CAN wrap the step-header row — `extraTopInset` arrived with
      the template's copy when #323 slice S4 made this file byte-identical to
      asb's. What is under contract is that no uno board ever asks for it: the
      band is the frame's only caller, it passes no inset, and the frame's own
      default is 0, so the geometry is the same one at overview and at focus.
    */
    expect(pathFrame).toContain('extraTopInset = 0')
    expect(pathBand).not.toContain('extraTopInset')
  })

  it('retains both header axes and skeletonizes their paint at blocks tier', () => {
    // Both axes are affordances now, and each carries its own attribute —
    // the one blueprint.css skeletonizes at the blocks tier.
    expect(compareDecorations).toContain('<StepHeaderAffordance')
    expect(stepHeader).toContain('data-blueprint-column-header=""')
    // The row-header axis moved into the lane affordance when the label
    // block became the control; the attribute is what blueprint.css
    // skeletonizes at the blocks tier, so it is the attribute under test —
    // not the file it happens to live in.
    expect(labelRail).toContain('<LaneHeaderAffordance')
    expect(laneHeader).toContain('data-blueprint-row-header=""')
    expect(css).toContain("[data-semantic-tier='blocks']")
    expect(css).toMatch(/\[data-blueprint-column-header\]\s*>\s*span/)
    expect(css).toContain('[data-blueprint-row-header]')
  })

  it('gates both axis headers on the board, not just the provider flag', () => {
    /*
      Reported three times. `detail.enabled` is ONE boolean on a provider
      mounted above the whole canvas, and every scenario board stays mounted
      behind the focused one — so focusing a single scenario made 176 lane and
      125 step headers live across 23 boards, and a click on a band the reader
      had never chosen opened "Nothing recorded for this lane yet."

      Both halves or nothing: the flag AND this board being the scoped one.
    */
    for (const header of [laneHeader, stepHeader]) {
      expect(header).toContain('useScenarioBoardInScope()')
      expect(header).toContain(
        'const isInteractive = Boolean(detail?.enabled) && boardInScope',
      )
    }
    // The one producer of that scope — the component that owns one scenario.
    expect(scenarioPanel).toContain('<ScenarioBoardScopeContext.Provider')
  })

  it('clamps only the narrative preview while retaining its full text node', () => {
    expect(compareCell).toContain(
      '<p className="line-clamp-4 w-full whitespace-pre-wrap">{content}</p>',
    )
  })

  it('clamps touchpoint labels to two lines and keeps the full accessible label', () => {
    expect(touchpointCell).toContain('aria-label={item}')
    expect(touchpointCell).toContain('className="line-clamp-2 break-words"')
  })

  it('semantic zoom paints actual faces, not variable group wrappers', () => {
    expect(css).toContain(
      "[data-semantic-tier='blocks'] [data-blueprint-cell-anchor]",
    )
    expect(css).not.toContain(
      "[data-semantic-tier='blocks'] [data-blueprint-cell] > *",
    )
  })

  it('warns on long copy without refusing or truncating it', () => {
    expect(CELL_CONTENT_TARGET).toBe(80)
    expect(CELL_CONTENT_WARNING).toBe(100)
    expect(getCellContentLengthGuidance('x'.repeat(100)).message).toBeNull()
    expect(getCellContentLengthGuidance('x'.repeat(101)).message).toContain(
      'preserved in full',
    )
    expect(agentRegistry).toContain('getCellContentLengthGuidance')
    expect(agentRegistry).not.toContain('throw new Error(lengthProblem)')
    expect(agentSpecs).toContain('non-blocking review warning')
    expect(agentSpecs).not.toContain('max 120 characters')
  })
})

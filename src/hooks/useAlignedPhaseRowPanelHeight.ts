import { useLayoutEffect, useState, type RefObject } from 'react'
import { getComparePanelScrollPaddingY } from '@/lib/sideBySideCompareLayout'

/**
 * Keeps every scenario panel in a phase row at one height: the larger of the
 * calculated shared height and the tallest measured blueprint content.
 * Aligned overview panels are height-locked (no resize handle), so measurement
 * uses the tighter locked scroll chrome.
 */
export function useAlignedPhaseRowPanelHeight(
  rowRef: RefObject<HTMLDivElement | null>,
  sharedPanelHeight: number | undefined,
  alignPanelHeights: boolean,
  measureKey: string,
) {
  const [rowPanelHeight, setRowPanelHeight] = useState<number | undefined>(
    sharedPanelHeight,
  )

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- layout-measurement flow: re-baselines to the shared height before the measuring effect below raises it
    setRowPanelHeight(sharedPanelHeight)
  }, [sharedPanelHeight])

  useLayoutEffect(() => {
    if (!alignPanelHeights || sharedPanelHeight === undefined) return

    const row = rowRef.current
    if (!row) return
    const scrollPad = getComparePanelScrollPaddingY({ lockHeight: true })

    const measureRow = () => {
      const contentNodes = row.querySelectorAll<HTMLElement>(
        '[data-blueprint-panel-content]',
      )
      let maxPanelHeight = sharedPanelHeight
      contentNodes.forEach((node) => {
        /*
          The focused scenario is excluded from the INPUT to the row height,
          not from the contract — it still receives the row height like every
          other panel, because focus must change as little geometry as
          possible (see "One writer per navigation" in
          design/interaction.md). What it must not do is drive its own floor:
          a comparison opened inside it would otherwise inflate its dimmed
          siblings, which is how six untouched panels once grew from 2218px
          to 4250px each.

          `PhaseScenarioOverview` applies the same exclusion to the two
          height ESTIMATES; the two must agree about whose height counts or
          the estimate and the measurement fight.
        */
        if (node.closest('[data-canvas-focus-active]')) return
        // Layout height only — `scrollHeight` also counts arrow overlays and
        // path frames bleeding past the board, which shows up as gray surplus.
        maxPanelHeight = Math.max(maxPanelHeight, node.offsetHeight + scrollPad)
      })
      setRowPanelHeight((current) =>
        current === maxPanelHeight ? current : maxPanelHeight,
      )
    }

    measureRow()
    const observer = new ResizeObserver(measureRow)
    row
      .querySelectorAll<HTMLElement>('[data-blueprint-panel-content]')
      .forEach((node) => observer.observe(node))

    return () => observer.disconnect()
  }, [alignPanelHeights, measureKey, rowRef, sharedPanelHeight])

  return rowPanelHeight
}

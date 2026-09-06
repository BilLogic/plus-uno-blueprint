// @vitest-environment jsdom
/**
 * What the cell panel draws above its tabs (#324, #396 Q26 + Q29).
 *
 * Neither this repository nor the template it is imported from had a rendering
 * test for `BlueprintCellDetailPanel`, which is the largest surface in the
 * cluster and the one two settled decisions change. The #324 survey called
 * that out and asked for one before either change shipped, so this file exists
 * to make the panel's picture rules checkable by a reader rather than only by
 * looking at it.
 *
 * It pins the two rules the decisions turn on, and nothing else about the
 * panel's appearance — a test that asserted the layout wholesale would fail on
 * every ordinary edit and teach the next author to delete it.
 *
 *   - **Q29.** A picture is a logo by the filename convention the stock assets
 *     follow, and by nothing else. Four touchpoint names used to be listed in
 *     the component, and every picture on such a cell was drawn as a small
 *     logo whatever it actually was. The assertion is that an authored frame
 *     on one of those very names now draws in the ordinary picture frame.
 *   - **Q26.** The panel elects no url as "the design". A cell carrying a
 *     figma.com resource gets no hover overlay and no "View in Figma" link —
 *     that affordance was deleted in #272 and stays deleted, with the featured
 *     resources answering the same need without naming a vendor.
 *
 * The panel's children are stubbed. Each of them reads the database through
 * its own hooks and each has, or deserves, its own test; standing them all up
 * here would mean mocking most of the app to assert two `<img>` elements.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BlueprintCellSelection } from '@/types/blueprintCellDetail'
import type { CellResource, CellTouchpoint } from '@/types/blueprint'

/*
  The panel's own context, handed to it directly.

  The provider resolves a selection out of a board, a canvas mode and a query;
  this file is about what the panel does WITH a selection, so the selection is
  the input and the provider is not in the picture.
*/
const detail = {
  selection: null as BlueprintCellSelection | null,
  blueprints: [],
  panelState: { surface: 'details' } as { surface: 'details' | 'differences' } | null,
  draftCell: null,
  isOpen: true,
  clearSelection: () => {},
  selectCell: () => {},
  setPanelSurface: () => {},
}

vi.mock('@/contexts/BlueprintCellDetailContext', () => ({
  useBlueprintCellDetail: () => detail,
}))

// View mode, and no write credential: the editor form never mounts, so the
// panel renders the read-only face these assertions are about.
vi.mock('@/contexts/SupabaseProvider', () => ({
  useSupabase: () => ({ client: null, configured: false, canWrite: false }),
}))
vi.mock('@/contexts/canvasModeContext', () => ({
  useCanvasModeValue: () => 'view',
}))

/*
  The panel's children, stubbed.

  Every one of them opens its own query. What is under test is the block the
  panel itself renders above the tab row, so the children are named placeholders
  — present enough that the panel's own tree is intact, inert enough that no
  database is needed.
*/
vi.mock('@/components/blueprint/CellContentSection', () => ({
  CellContentSection: () => <div data-stub="cell-content-section" />,
}))
vi.mock('@/components/blueprint/CellOverviewSpec', () => ({
  CellOverviewSpec: () => <div data-stub="cell-overview-spec" />,
}))
vi.mock('@/components/blueprint/CellDependencySections', () => ({
  CellDependencySections: () => <div data-stub="cell-dependency-sections" />,
}))
vi.mock('@/components/blueprint/CellDependencyEditor', () => ({
  CellDependencyEditor: () => <div data-stub="cell-dependency-editor" />,
}))
vi.mock('@/components/blueprint/CellEvidenceTab', () => ({
  CellEvidenceTab: () => <div data-stub="cell-evidence-tab" />,
}))
vi.mock('@/components/blueprint/CellResourcesTab', () => ({
  CellResourcesTab: () => <div data-stub="cell-resources-tab" />,
}))
vi.mock('@/components/blueprint/CellInSlicesFooter', () => ({
  CellInSlicesFooter: () => <div data-stub="cell-in-slices-footer" />,
}))
vi.mock('@/components/blueprint/CompareDifferencesSurface', () => ({
  CompareDifferencesSurface: () => <div data-stub="compare-differences" />,
}))
vi.mock('@/components/blueprint/StoryboardStepDetailStack', () => ({
  StoryboardStepDetailStack: () => <div data-stub="storyboard-stack" />,
}))

import { BlueprintCellDetailPanel } from '@/components/blueprint/BlueprintCellDetailPanel'

/** A bucket frame: an authored picture, named by the uuid it was stored under. */
const AUTHORED_FRAME =
  'https://example.supabase.co/storage/v1/object/public/cell-attachments/cells/c-1/6fc4f2fc.png'

/** A stock logo, named by the convention `public/touchpoint-logos` follows. */
const STOCK_LOGO = '/touchpoint-logos/zoom-logo.png'

function placement(name: string, id: string | null = 'ct-1'): CellTouchpoint {
  return { id, touchpointId: 'tp-1', name, kind: 'app', summary: null, role: null }
}

function selectionFor(options: {
  touchpointName: string
  frame?: string | null
  resources?: CellResource[]
}): BlueprintCellSelection {
  return {
    scenarioName: 'Discovery',
    phaseName: 'Application',
    // Resolves to a touchpoint role through the legacy name map, which is what
    // makes the touchpoint field render at all.
    laneName: 'Front Stage Tech',
    stepId: 'step-1',
    stepName: 'Hears about the service',
    stepIndex: 0,
    techItem: options.touchpointName,
    paths: [
      {
        cellId: 'cell-1',
        pathId: 'path-1',
        pathName: 'Happy path',
        pathKind: 'happy',
        content: options.touchpointName,
        summary: 'What the reader meets at this moment.',
        frame: options.frame ?? null,
        touchpoints: [placement(options.touchpointName)],
        resources: options.resources ?? [],
      },
    ],
  }
}

/** Every `<img>` the panel drew, in document order. */
function pictures(): HTMLImageElement[] {
  return Array.from(document.querySelectorAll('img'))
}

function pictureFor(src: string): HTMLImageElement {
  const found = pictures().find((image) => image.getAttribute('src') === src)
  expect(found, `no <img> drawn for ${src}`).toBeTruthy()
  return found!
}

beforeEach(() => {
  // jsdom ships no `matchMedia`, and the desktop posture is the one under
  // test — the same stand-in `panelDrawerShell.test.tsx` uses.
  window.matchMedia = ((query: string) => ({
    media: query,
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia
  detail.selection = null
  detail.panelState = { surface: 'details' }
})

afterEach(cleanup)

async function open(selection: BlueprintCellSelection) {
  detail.selection = selection
  render(<BlueprintCellDetailPanel />)
  // The drawer opens on a later frame than the first render.
  await screen.findByLabelText('Close cell details')
}

describe('the pictures a cell panel draws', () => {
  it('draws a stock logo at the one logo size', async () => {
    await open(selectionFor({ touchpointName: 'Zoom' }))

    const logo = pictureFor(STOCK_LOGO)
    expect(logo.className).toContain('size-32')
    // Not in a 4:3 frame — a logo is drawn at its own size, unframed.
    expect(logo.closest('[class*="aspect-"]')).toBeNull()
  })

  /*
    The Q29 assertion, and the reason this file was written.

    `Handshake` is one of the four names the component used to list. Its cell
    carries an authored frame, and until #396 Q29 that frame was drawn as a
    `6.5rem` logo because of the name beside it rather than because of anything
    about the picture. Now the filename decides, so it draws in the frame every
    other authored picture draws in.
  */
  it('draws an authored frame as a picture, whatever the touchpoint is called', async () => {
    await open(
      selectionFor({ touchpointName: 'Handshake', frame: AUTHORED_FRAME }),
    )

    const picture = pictureFor(AUTHORED_FRAME)
    expect(picture.closest('[class*="aspect-"]')).toBeTruthy()
    expect(picture.className).not.toContain('size-32')
  })

  it('sizes no picture by the touchpoint it belongs to', async () => {
    for (const name of [
      'Social Media',
      'On-campus booth',
      'Handshake',
      'Handshake Employer Profile',
    ]) {
      detail.selection = null
      cleanup()
      await open(selectionFor({ touchpointName: name, frame: AUTHORED_FRAME }))
      // The size the four names used to select. No touchpoint gets its own
      // size any more, so the class is nowhere in the panel.
      expect(document.body.innerHTML, name).not.toContain('6.5rem')
    }
  })
})

describe('the panel elects no url as "the design" (#272, #396 Q26)', () => {
  it('offers no vendor-named overlay over a picture', async () => {
    await open(
      selectionFor({
        touchpointName: 'Handshake',
        frame: AUTHORED_FRAME,
        resources: [
          {
            id: 'r-1',
            kind: 'link',
            name: 'Intake portal',
            url: 'https://www.figma.com/design/W0/intake-portal',
            placementId: 'ct-1',
            featured: false,
          },
        ],
      }),
    )

    expect(screen.queryByLabelText('View in Figma')).toBeNull()
    expect(screen.queryByText('View in Figma')).toBeNull()
    // The frame is drawn plainly: no anchor wraps it.
    expect(pictureFor(AUTHORED_FRAME).closest('a')).toBeNull()
  })
})

describe('the touchpoint a cell was opened on', () => {
  it('names it in a labelled field', async () => {
    await open(selectionFor({ touchpointName: 'Handshake' }))

    expect(screen.getByText('Touchpoint')).toBeTruthy()
    expect(screen.getAllByText('Handshake').length).toBeGreaterThan(0)
  })
})

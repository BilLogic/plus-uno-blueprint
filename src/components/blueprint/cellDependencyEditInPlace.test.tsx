// @vitest-environment jsdom
/**
 * One list, edited in place (#550).
 *
 * The tab used to show every connection twice: the read sections, and then the
 * editor's own `<ul>` of the same edges underneath. It is one list now, and
 * these are the three things that arrangement has to keep true.
 *
 *   1. A CELL EDITS ONLY THE ARROWS IT IS THE SOURCE OF. An inbound row
 *      belongs to the cell at the other end. It gets no fields — a select on
 *      it would be a control that cannot do what it looks like it does — and
 *      one pencil, which navigates to the cell that owns it.
 *   2. FAILURE IS LOCAL. A row that could not save says so under itself. At
 *      the top of the tab the message is as far from the row that produced it
 *      as the panel allows, and it makes seven rows look broken because the
 *      eighth is.
 *   3. THE NOTE TRAVELS WITH THE KIND. `update_cell_dependency` takes all
 *      three or none, so a kind change carries the sentence along; a write
 *      that dropped it would erase an author's words as a side effect of
 *      changing a dropdown.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BlueprintCellConnection } from '@/lib/blueprintCellConnections'

/*
  The write path, stubbed at the module boundary rather than under a fake
  Supabase client: what these tests are about is which call the row makes and
  with what, and a fake client would answer that question through a second
  layer of guesswork about PostgREST.

  The arguments are typed, not `any`, because the second one is the assertion
  in the first test — an untyped mock would let a renamed field pass.
*/
type UpdateInput = {
  dependencyId: string
  kind: string
  targetCellId: string
  note: string | null
}

const rpc = vi.hoisted(() => ({
  update: vi.fn(async (_client: unknown, _input: UpdateInput) => ({})),
  clear: vi.fn(async (_client: unknown, _dependencyId: string) => undefined),
  set: vi.fn(async (_client: unknown, _input: unknown) => 'dep-new'),
}))

vi.mock('@/contexts/SupabaseProvider', () => ({
  useSupabase: () => ({ client: {}, configured: true, canWrite: true }),
}))
vi.mock('@/hooks/useSupabaseQuery', () => ({ invalidateQueries: () => {} }))
vi.mock('@/lib/authoringRpc', () => ({
  updateCellDependency: rpc.update,
  clearCellDependency: rpc.clear,
  setCellDependency: rpc.set,
}))

import { CellDependencySections } from '@/components/blueprint/CellDependencySections'
import { TooltipProvider } from '@/components/ui/tooltip'

const SOURCE = { cellId: 'cell-source', pathId: 'path-1', label: 'Tutor · Step 1' }
const TARGET = { cellId: 'cell-target', pathId: 'path-1', label: 'Systems · Step 2' }
const OTHER = { cellId: 'cell-other', pathId: 'path-1', label: 'Systems · Step 3' }

const connection = (patch: Partial<BlueprintCellConnection> = {}): BlueprintCellConnection => ({
  dependencyId: 'dep-1',
  cellId: TARGET.cellId,
  laneName: 'Systems',
  laneRowPosition: 2,
  stepName: 'Confirm',
  stepIndex: 1,
  kind: 'connection',
  linkKind: 'leads_to',
  linkName: null,
  linkNote: 'the sentence this edge arrived with',
  isTech: false,
  techItems: [],
  contentPreview: 'Confirms the slot',
  ...patch,
})

const editing = (onEditFromOwner = () => {}) => ({
  source: SOURCE,
  candidates: [SOURCE, TARGET, OTHER],
  existing: [
    {
      id: 'dep-1',
      targetCellId: TARGET.cellId,
      targetLabel: TARGET.label,
      kind: 'leads_to',
      note: 'the sentence this edge arrived with',
    },
  ],
  onEditFromOwner,
})

function draw({
  outgoing = [] as BlueprintCellConnection[],
  incoming = [] as BlueprintCellConnection[],
  onEditFromOwner = () => {},
} = {}) {
  return render(
    <TooltipProvider>
      <CellDependencySections
        connections={{ incoming, outgoing }}
        otherTech={[]}
        editing={editing(onEditFromOwner)}
        onCellSelect={() => {}}
        onTechSelect={() => {}}
      />
    </TooltipProvider>,
  )
}

/*
  Driving `OptionSelect`, which is not a native `<select>` — it is Base UI's
  combobox, so `fireEvent.change` reaches nothing. Same three gestures
  `optionSelect.test.tsx` uses: a real mouse pick has to START on the item,
  because Base UI ignores a click whose pointer never went down there.
*/
const kindTrigger = () => screen.getByLabelText(/Connection kind for/)
const open = (element: HTMLElement) => fireEvent.mouseDown(element, { button: 0 })
function choose(name: string) {
  const option = screen.getByRole('option', { name })
  fireEvent.pointerDown(option, { pointerType: 'mouse', button: 0 })
  fireEvent.click(option)
}
async function pickKind(label: string) {
  open(kindTrigger())
  await waitFor(() => expect(screen.queryAllByRole('option')).not.toHaveLength(0))
  choose(label)
}

afterEach(() => {
  cleanup()
  rpc.update.mockReset()
  rpc.update.mockImplementation(async () => ({}))
  rpc.clear.mockReset()
})

describe('the row this cell owns', () => {
  it('is the fields for that row, and carries its note on a kind change', async () => {
    draw({ outgoing: [connection()] })
    await pickKind('Enables')
    await waitFor(() => expect(rpc.update).toHaveBeenCalledTimes(1))
    expect(rpc.update.mock.calls[0]?.[1]).toEqual({
      dependencyId: 'dep-1',
      kind: 'enables',
      targetCellId: TARGET.cellId,
      // Not dropped, and not re-sent as null: a kind change is not an
      // instruction to erase what somebody wrote about the edge.
      note: 'the sentence this edge arrived with',
    })
  })

  it('says what went wrong under itself, never at the top of the tab', async () => {
    rpc.update.mockRejectedValueOnce(new Error('That connection already exists'))
    const { container } = draw({ outgoing: [connection()] })
    await pickKind('Enables')
    const message = await screen.findByText(/That connection already exists/)
    // Inside the row's own `<li>`, which is the assertion — a message rendered
    // above the list would satisfy `findByText` just as happily.
    const row = container.querySelector('[data-dependency-row="dep-1"]')
    expect(row).not.toBeNull()
    expect(row?.contains(message)).toBe(true)
    expect(container.querySelectorAll('[data-dependency-row-error]')).toHaveLength(1)
  })
})

describe('the row the other cell owns', () => {
  it('renders no field and exactly one pencil', () => {
    const { container } = draw({ incoming: [connection({ dependencyId: 'dep-in' })] })
    // No select, no input: an inbound arrow is edited from the cell it leaves,
    // and a control here would be a promise this panel cannot keep. Asked of
    // `select-trigger` and `combobox` rather than of `<select>`, because
    // `OptionSelect` is not a native one and a tag-name search would pass on a
    // row full of them.
    expect(container.querySelectorAll('[data-slot="select-trigger"]')).toHaveLength(0)
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
    expect(container.querySelectorAll('input')).toHaveLength(0)
    expect(screen.getAllByLabelText(/^Edit in /)).toHaveLength(1)
  })

  it('navigates to the cell that owns it rather than opening a second panel', () => {
    const onEditFromOwner = vi.fn()
    draw({ incoming: [connection({ dependencyId: 'dep-in' })], onEditFromOwner })
    fireEvent.click(screen.getByLabelText(/^Edit in /))
    expect(onEditFromOwner).toHaveBeenCalledWith(TARGET.cellId)
  })

  it('states no fact where a control belongs', () => {
    // "Edited from the other cell" stood here. A control that states a fact is
    // not a control, and the fact only ever interested somebody who wanted to
    // change the row — which is what the pencil is for.
    draw({ incoming: [connection({ dependencyId: 'dep-in' })] })
    expect(screen.queryByText(/Edited from the other cell/)).toBeNull()
  })
})

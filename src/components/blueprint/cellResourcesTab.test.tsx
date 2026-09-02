// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CellResourcesTab } from '@/components/blueprint/CellResourcesTab'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { CellResource } from '@/types/blueprint'

const rpc = vi.fn()
vi.mock('@/contexts/SupabaseProvider', () => ({
  useSupabase: () => ({ client: { rpc }, canWrite: true }),
}))
vi.mock('@/contexts/canvasModeContext', () => ({ useCanvasModeValue: () => 'design' }))
vi.mock('@/hooks/useSupabaseQuery', () => ({ invalidateQueries: () => {} }))
vi.mock('@/lib/authoringSession', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/authoringSession')>()),
  recordChange: () => {},
}))
const uploadAttachment = vi.fn()
vi.mock('@/lib/attachmentUpload', () => ({
  uploadAttachment: (...args: unknown[]) => uploadAttachment(...args),
}))

const RESOURCES: CellResource[] = [
  {
    id: 'r-cell',
    name: 'Tracker',
    kind: 'link',
    url: 'https://tracker.dev/1',
    placementId: null,
    featured: false,
  },
]

beforeEach(() => {
  uploadAttachment.mockReset()
  rpc.mockReset()
  rpc.mockResolvedValue({ data: 1, error: null })
})
afterEach(cleanup)

describe('the Resources tab takes a file with no placement (#274)', () => {
  it('uploads to the cell, lists the attachment, and saves it as the cell’s own row', async () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/cell-attachments/cells/cell-1/o.pdf'
    uploadAttachment.mockResolvedValue({
      kind: 'attachment',
      name: 'Runbook',
      url,
      objectKey: 'cells/cell-1/o.pdf',
    })
    const { getByLabelText, getByText, container } = render(
      <TooltipProvider>
        <CellResourcesTab cellId="cell-1" resources={RESOURCES} />
      </TooltipProvider>,
    )
    const file = new File(['pdf'], 'Runbook.pdf', { type: 'application/pdf' })
    fireEvent.change(getByLabelText('Upload a file'), { target: { files: [file] } })
    await waitFor(() => expect(container.textContent).toContain('o.pdf'))
    expect(uploadAttachment).toHaveBeenCalledWith(expect.anything(), { cellId: 'cell-1', file })

    fireEvent.click(getByText('Save resources'))
    await waitFor(() => expect(rpc).toHaveBeenCalled())
    const [fn, args] = rpc.mock.calls[0]
    expect(fn).toBe('sync_cell_resources')
    expect(args.p_cell_id).toBe('cell-1')
    expect(args.p_rows).toEqual([
      { id: 'r-cell', kind: 'link', name: 'Tracker', url: 'https://tracker.dev/1' },
      { id: null, kind: 'attachment', name: 'Runbook', url },
    ])
  })

  it('a refused upload is shown, and no row is invented', async () => {
    uploadAttachment.mockRejectedValue(new Error('The file could not be uploaded: too large'))
    const { getByLabelText, container, queryByText } = render(
      <TooltipProvider>
        <CellResourcesTab cellId="cell-1" resources={RESOURCES} />
      </TooltipProvider>,
    )
    fireEvent.change(getByLabelText('Upload a file'), {
      target: { files: [new File(['x'], 'big.mov')] },
    })
    await waitFor(() => expect(container.textContent).toContain('too large'))
    expect(queryByText('Save resources')).toBeNull()
  })
})

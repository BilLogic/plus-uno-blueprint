// @vitest-environment jsdom
/**
 * The add-source form says what each of its boxes holds, and keeps saying it.
 *
 * It said it in placeholders once: four controls, four hints, every one of them
 * gone the moment someone typed into the field it described. The sibling
 * ticket measured what that costs — two identically-sized unlabelled boxes,
 * 2 excerpts and 0 notes across 66 rows. These assertions are here so a label
 * cannot quietly become a placeholder again (#548).
 */
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { QueryResult } from '@/hooks/useSupabaseQuery'
import type { Evidence } from '@/types/database'

const evidence = vi.hoisted(() => ({
  current: { status: 'ready', data: [], source: 'database' } as QueryResult<
    Evidence[]
  >,
}))

vi.mock('@/contexts/SupabaseProvider', () => ({
  useSupabase: () => ({ client: {}, configured: true, canWrite: true }),
}))
vi.mock('@/hooks/useEvidence', () => ({
  useEvidence: () => evidence.current,
  invalidateEvidence: () => {},
}))

import { CellEvidenceTab } from '@/components/blueprint/CellEvidenceTab'

/** Opens the form; it is behind the "Add source" button until asked for. */
function openForm() {
  const view = render(<CellEvidenceTab cellId="cell-1" />)
  fireEvent.click(view.getByText('Add source'))
  return view
}

afterEach(cleanup)

describe('every field in the add-source form is labelled', () => {
  it('names all four fields, and marks the two that may be left empty', () => {
    const { getByText, getByLabelText } = openForm()

    // The label a reader sees…
    expect(getByText('Kind')).toBeTruthy()
    expect(getByText('Title')).toBeTruthy()
    expect(getByText('Link or reference')).toBeTruthy()
    expect(getByText('Quote from the source')).toBeTruthy()

    // …and the name the control actually answers to.
    expect(getByLabelText('Kind')).toBeTruthy()
    expect(getByLabelText('Title')).toBeTruthy()
    expect(getByLabelText(/^Link or reference/)).toBeTruthy()
    expect(getByLabelText(/^Quote from the source/)).toBeTruthy()

    // Optional is a property of the field, so it is said on the label rather
    // than left for a refused submit to reveal.
    expect(getByLabelText(/^Link or reference · optional$/)).toBeTruthy()
    expect(getByLabelText(/^Quote from the source · optional$/)).toBeTruthy()
  })

  it('still names them once they are full — which a placeholder cannot', () => {
    const { getByText, getByLabelText } = openForm()

    fireEvent.change(getByLabelText('Title'), {
      target: { value: 'Session observation, P3' },
    })
    fireEvent.change(getByLabelText(/^Quote from the source/), {
      target: { value: 'P3 greeted the student by name.' },
    })

    expect(getByText('Title')).toBeTruthy()
    expect(getByText('Quote from the source')).toBeTruthy()
  })
})

describe('no control in the add-source form styles itself', () => {
  it('wears the shared input, the panel select and the panel textarea', () => {
    const { getByLabelText, container } = openForm()

    // The kind control is the panel's own select, not a bare `<select>`
    // wearing hand-written classes — which is what clipped its value and put
    // the one monospaced control in the panel.
    expect(container.querySelector('select')).toBeNull()
    expect(getByLabelText('Kind').getAttribute('data-slot')).toBe(
      'select-trigger',
    )
    expect(container.querySelector('.font-mono')).toBeNull()

    expect(getByLabelText('Title').getAttribute('data-slot')).toBe('input')
    expect(getByLabelText(/^Link or reference/).getAttribute('data-slot')).toBe(
      'input',
    )
    // The cell panel's multi-line treatment, shared from `panelShell`.
    expect(
      getByLabelText(/^Quote from the source/).className,
    ).toContain('rounded-md border border-input')
  })
})

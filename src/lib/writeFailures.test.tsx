// @vitest-environment jsdom
/**
 * A failed write says so — and says it where the person is looking.
 *
 * Two halves. The rendering half asserts the message a user actually reads,
 * because "the failure reached the console" is precisely the behaviour this
 * replaces. The contract half reads the four failing paths as source: each is
 * an event handler wired into a canvas, a sidebar or a window keydown, and
 * standing all of that up would test the harness rather than the honesty. The
 * question here is which channel each `catch` reports to, and that is a fact
 * about the source.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WriteFailureNotices } from '@/components/editor/WriteFailureNotices'
import { AuthoringError } from '@/lib/authoringErrors'
import {
  dismissWriteFailure,
  reportWriteFailure,
  resetWriteFailures,
  writeFailureSnapshot,
} from '@/lib/writeFailures'

afterEach(() => {
  cleanup()
  resetWriteFailures()
  vi.restoreAllMocks()
})

/** The store logs for developers too; the tests do not need the noise. */
const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {})

describe('WriteFailureNotices', () => {
  it('renders nothing until something fails', () => {
    render(<WriteFailureNotices />)
    expect(document.querySelector('[data-write-failures]')).toBeNull()
  })

  it('shows what did not happen and why', () => {
    quiet()
    render(<WriteFailureNotices />)
    act(() =>
      reportWriteFailure(
        'The cell was not deleted',
        new AuthoringError('That lane no longer exists.', 'cells: lane_id …'),
      ),
    )
    expect(
      screen.getByText('The cell was not deleted. That lane no longer exists.'),
    ).toBeDefined()
  })

  it('never shows an empty reason', () => {
    quiet()
    render(<WriteFailureNotices />)
    act(() => reportWriteFailure('The step was not added', 'not an Error'))
    expect(
      screen.getByText(
        'The step was not added. The details are in the console.',
      ),
    ).toBeDefined()
  })

  it('is dismissed by hand, not by a timer', () => {
    quiet()
    render(<WriteFailureNotices />)
    act(() => reportWriteFailure('The step was not added', new Error('nope')))
    const [failure] = writeFailureSnapshot()
    act(() => dismissWriteFailure(failure.id))
    expect(screen.queryByText(/The step was not added/)).toBeNull()
  })

  it('keeps the newest few rather than burying the canvas', () => {
    quiet()
    for (let i = 0; i < 6; i += 1) {
      reportWriteFailure(`Write ${i} failed`, new Error('nope'))
    }
    render(<WriteFailureNotices />)
    expect(screen.queryByText(/Write 0 failed/)).toBeNull()
    expect(screen.getByText(/Write 5 failed/)).toBeDefined()
  })
})

/**
 * The four paths that failed silently, and the `catch` in each. A path that
 * moves is a failing test rather than a quietly unaudited file — the anchors
 * are read eagerly and asserted present.
 */
const FAILING_PATHS = [
  {
    file: 'src/components/editor/CanvasCellContextMenu.tsx',
    subject: 'The cell was not deleted',
  },
  {
    file: 'src/components/blueprint/BlueprintColumnHandles.tsx',
    subject: 'The step was not added',
  },
  {
    file: 'src/components/editor/SlicesSidebarSection.tsx',
    subject: 'was not duplicated',
  },
  {
    file: 'src/components/editor/SessionChangesSheet.tsx',
    subject: 'was not taken back',
  },
] as const

describe('the paths that used to fail in silence', () => {
  for (const { file, subject } of FAILING_PATHS) {
    it(`${file} reports to the user, not the console`, () => {
      const source = readFileSync(join(process.cwd(), file), 'utf8')
      expect(source).toContain(`reportWriteFailure(`)
      expect(source).toContain(subject)
      // The old channel, gone from these paths: `console.error` alone is
      // indistinguishable from success at the user's altitude.
      expect(source).not.toContain("console.error('[authoring] delete_cell")
      expect(source).not.toContain("console.error('[authoring] add_step")
      expect(source).not.toContain("console.error(\n          '[slices] duplicate")
      expect(source).not.toContain("console.error('[authoring] ⌘Z revert")
    })
  }
})

/**
 * Rules for creating or copying a version of a journey.
 *
 * "Version" is the word in the UI; `paths` is the table. A journey has one
 * happy path and any number of alternatives, and they are *alternatives* — not
 * stages, not revisions. That is why nothing connects across them.
 */

export type VersionMode = 'blank' | 'duplicate'

/** `path_type` values in use. The seed writes `happy`; the RPCs default to
 * `alternative`. Anything else is free text the renderer colours generically. */
export const PATH_TYPES = ['happy', 'alternative', 'edge-case', 'sad'] as const
export type PathType = (typeof PATH_TYPES)[number]

export const PATH_TYPE_LABELS: Record<PathType, string> = {
  happy: 'Happy path',
  alternative: 'Alternative',
  'edge-case': 'Edge case',
  sad: 'Sad path',
}

export type DraftVersion = {
  mode: VersionMode
  name: string
  pathType: PathType
  /** Blank mode: copy lanes from here. Duplicate mode: the version to copy. */
  sourcePathId: string | null
  copyCells: boolean
  copyDependencies: boolean
}

export function validateDraftVersion(
  draft: DraftVersion,
  siblingNames: string[],
): string[] {
  const problems: string[] = []
  const name = draft.name.trim()

  if (!name) {
    problems.push('A version needs a name.')
  } else if (
    siblingNames.some((sibling) => sibling.trim().toLowerCase() === name.toLowerCase())
  ) {
    problems.push(
      `This journey already has a version called “${name}”. Two versions with the same name cannot be told apart in the sidebar or a slice.`,
    )
  }

  if (draft.mode === 'duplicate' && !draft.sourcePathId) {
    problems.push('Pick the version to copy.')
  }

  if (draft.mode === 'duplicate' && draft.copyDependencies && !draft.copyCells) {
    problems.push(
      'Arrows cannot be copied without the cells they connect — either copy the cells too, or leave the arrows behind.',
    )
  }

  return problems
}

/**
 * What the copy will contain, phrased as an outcome rather than as settings.
 *
 * Worth saying out loud because the arrow behaviour is the part people get
 * wrong: a copy whose arrows still pointed at the original's cells would draw
 * lines leaving the version they belong to.
 */
export function describeVersionOutcome(draft: DraftVersion): string {
  if (draft.mode === 'blank') {
    return draft.sourcePathId
      ? 'An empty grid with the same lanes as the version you picked.'
      : 'An empty grid with the same lanes as the rest of this journey.'
  }
  if (!draft.copyCells) return 'The lanes and columns only — no cell text.'
  return draft.copyDependencies
    ? 'Every cell and every arrow, with the arrows repointed onto the copies.'
    : 'Every cell, with no arrows between them.'
}

import type { AffectedSlice, DeletionImpact, DeletionKind } from '@/lib/authoringRpc'

/**
 * What a delete would destroy, and whether it could be undone.
 *
 * The plan's rule is that no delete affordance ships before its archive
 * exists. That is enforced structurally — `canDelete` below — rather than by
 * remembering, because a delete button on a schema with no `deleted_structure`
 * table destroys imported blueprint content with nothing behind it.
 */

/** Nouns for the confirm sentence. `path` is "version" in every user-facing string. */
export const DELETION_NOUNS: Record<DeletionKind, string> = {
  scenario: 'blueprint',
  path: 'version',
  step: 'column',
  lane: 'lane',
}

export type DeletionReadiness =
  | { canDelete: true }
  | { canDelete: false; reason: string }

/**
 * Whether deleting is available at all.
 *
 * `archiveAvailable` comes from the app checking that `deleted_structure` is
 * present. Absent, the affordance is hidden rather than disabled: a disabled
 * delete button invites someone to go looking for how to enable it, and there
 * is no safe way to.
 */
export function deletionReadiness(archiveAvailable: boolean): DeletionReadiness {
  if (!archiveAvailable) {
    return {
      canDelete: false,
      reason:
        'Deleting is unavailable until the recovery archive exists — without it a delete could not be undone.',
    }
  }
  return { canDelete: true }
}

export type FrameLoss = {
  /** Slices that would lose frames and can be restored by undo. */
  recoverable: AffectedSlice[]
  /**
   * Slices holding at least one cell with no stored key. Undo matches on keys,
   * so these frames cannot be put back — the delete is one-way for them.
   */
  unrecoverable: AffectedSlice[]
}

/**
 * Split affected slices by whether undo could actually restore them.
 *
 * A null key means the cell's authored key was never written, so nothing can
 * match it back after a restore. Presenting those together with the
 * recoverable ones would let a confirm dialog imply an undo it cannot perform.
 */
export function splitByRecoverability(slices: AffectedSlice[]): FrameLoss {
  const recoverable: AffectedSlice[] = []
  const unrecoverable: AffectedSlice[] = []
  for (const slice of slices) {
    if (slice.cell_keys.some((key) => key === null || key === '')) {
      unrecoverable.push(slice)
    } else {
      recoverable.push(slice)
    }
  }
  return { recoverable, unrecoverable }
}

/**
 * The sentences the confirm dialog shows, in the order they should be read.
 *
 * Counts come from `deletion_impact`, which counts what the cascade actually
 * destroys — including the arrows that die with the cells. A dialog that named
 * only the cells would be undercounting by design.
 */
export function describeImpact(
  kind: DeletionKind,
  impact: DeletionImpact,
): string[] {
  const lines: string[] = []
  const noun = DELETION_NOUNS[kind]

  lines.push(
    `Deleting this ${noun} removes ${plural(impact.cell_count, 'cell')}.`,
  )
  if (impact.dependency_count > 0) {
    lines.push(
      `${plural(impact.dependency_count, 'arrow')} connected to those cells will go with them.`,
    )
  }

  const { recoverable, unrecoverable } = splitByRecoverability(
    impact.affected_slices,
  )
  if (recoverable.length > 0) {
    lines.push(
      `${plural(recoverable.length, 'slice')} will lose frames: ${names(recoverable)}.`,
    )
  }
  if (unrecoverable.length > 0) {
    lines.push(
      `${plural(unrecoverable.length, 'slice')} cannot be restored by undo, because some of their cells have no stored key: ${names(unrecoverable)}.`,
    )
  }

  return lines
}

/**
 * Whether the typed confirmation matches.
 *
 * Exact after trimming, and case-sensitive. A case-insensitive match would let
 * "happy path" delete "Happy Path", which is most of the way to not asking.
 */
export function confirmationMatches(typed: string, label: string): boolean {
  return typed.trim() === label.trim() && label.trim().length > 0
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function names(slices: AffectedSlice[]): string {
  return slices.map((slice) => `“${slice.title}”`).join(', ')
}

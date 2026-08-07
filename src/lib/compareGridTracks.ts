import {
  buildCompareDisplayTracks,
  compareFoldPleatTitle,
  type CompareFoldState,
} from '@/lib/compareFold'
import type { CompareModel } from '@/lib/compareSlots'
import type { BlueprintData } from '@/types/blueprint'

/**
 * The compare canvas's column axis as the GRIDS consume it — one view model
 * shared by the stacked bands and the merged grid, so both are drawn against
 * the same canonical step axis, the same pleats and the same divergent-column
 * tint. Derived from the compare model + fold state, never the DOM.
 */

/** One canonical step column. */
export type CompareGridColumn = {
  key: string
  label: string
  /** This column's backing step id per path — absent path ⇒ inert spacer. */
  stepIdByPath: Readonly<Record<string, string>>
  /** Column-level verdict !== 'shared' (drives the light column tint). */
  divergent: boolean
  /** Pin rule (one-hop edge to a divergent cell) — never folds; Link2 glyph. */
  pinned: boolean
}

/**
 * One track of the column axis: a normal step column, or a pleat — a whole
 * run of folded shared columns compressed to one fixed-width track.
 */
export type CompareGridTrack =
  | ({ kind: 'column' } & CompareGridColumn)
  | {
      kind: 'pleat'
      /** The fold fragment's key (its first columnKey). */
      key: string
      /** How many shared columns this pleat hides — the `▸ N` label. */
      columnCount: number
      /** Tooltip copy: "N identical steps: First → Last". */
      title: string
    }

/**
 * With a model: the canonical axis under the current fold state. Without one
 * (a single path, or a selection whose blueprints have not all arrived) each
 * path's own steps become their own columns, in band order — there is
 * nothing to align yet.
 */
export function buildCompareGridTracks(
  model: CompareModel | null,
  blueprints: readonly BlueprintData[],
  pinnedColumns: ReadonlySet<string>,
  fold: CompareFoldState,
): CompareGridTrack[] {
  if (!model) {
    return blueprints.flatMap((blueprint) =>
      [...blueprint.steps]
        .sort((a, b) => a.column_position - b.column_position)
        .map(
          (step): CompareGridTrack => ({
            kind: 'column',
            key: `${blueprint.path.id}:${step.id}`,
            label: step.name,
            stepIdByPath: { [blueprint.path.id]: step.id },
            divergent: false,
            pinned: false,
          }),
        ),
    )
  }

  const columnByKey = new Map(
    model.columns.map((column) => [column.columnKey, column]),
  )
  return buildCompareDisplayTracks(model, pinnedColumns, fold).map(
    (track): CompareGridTrack => {
      if (track.kind === 'pleat') {
        return {
          kind: 'pleat',
          key: track.fragment.key,
          columnCount: track.fragment.columnKeys.length,
          title: compareFoldPleatTitle(track.fragment),
        }
      }
      const column = columnByKey.get(track.columnKey)
      return {
        kind: 'column',
        key: track.columnKey,
        label: column?.label ?? track.columnKey,
        stepIdByPath: column?.stepIdByPath ?? {},
        divergent: column ? column.verdict !== 'shared' : false,
        pinned: pinnedColumns.has(track.columnKey),
      }
    },
  )
}

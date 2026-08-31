import type { PathType } from '@/types/database'
import type { CellLink, CellResource } from '@/types/blueprint'

export type BlueprintCellPathEntry = {
  cellId: string
  pathId: string
  pathName: string
  pathDescription?: string | null
  pathType: PathType
  content: string
  frame?: string | null
  description?: string | null
  /** Fallback-only now: a database cell's resources arrive in `resources`,
   *  and `links` survives so a fallback cell's touchpoint detail still
   *  resolves through `cellTouchpointsFromLinks`. */
  links?: CellLink[]
  resources?: CellResource[]
}

/**
 * Which sibling surface the floating panel is showing. `details` is the cell
 * detail view (selection or draft); `differences` is the compare ledger,
 * which needs no selection at all.
 *
 * Lives here rather than beside the provider so pure helpers can reason about
 * the panel without importing React — `detailClickCloses` in cellPickGrammar
 * is the reason it moved.
 */
export type BlueprintPanelSurface = 'details' | 'differences'

export type BlueprintCellSelection = {
  scenarioName: string
  /** Parent phase label when known (e.g. Pre-Session). */
  phaseName?: string
  laneName: string
  stepId: string
  stepName: string
  stepIndex: number
  /** Set when a single tech pill is selected (Front Stage Tech, Back Stage Tech). */
  techItem?: string
  paths: BlueprintCellPathEntry[]
}

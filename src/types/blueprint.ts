import type { PathType } from '@/types/database'
import type { CellMaturity } from '@/lib/cellMaturity'

export type BlueprintPath = {
  id: string
  name: string
  /** When this route applies — the condition that puts someone on it.
   *  Renamed from `description` with the column; `note` is the author's aside,
   *  which is the distinction plan 006 draws between the two. */
  summary: string | null
  note: string | null
  path_type: PathType
}

export type BlueprintLane = {
  id: string
  /** Display label — free-form, any language. */
  name: string
  /** Semantic role key (`lanes.lane_role`); null/absent = generic swimlane. */
  role?: string | null
  position: number
}

export type BlueprintStep = {
  id: string
  name: string
  position: number
  /** What this moment is, across every lane — the one sentence that makes the
   *  column legible without reading five cells. Shown as the caption under the
   *  storyboard frame, and in the step header's hover card when there is no
   *  frame to caption. Optional because fallback data predates the column. */
  summary?: string | null
}

/** Structured link on a cell (stored as JSONB; type is usually "url"). */
export type CellLink = {
  type: string
  label: string
  url?: string
  /** Long-form copy for `tech_description` links keyed by tech pill label. */
  description?: string
  /** Screenshot or illustration for `tech_description` links keyed by tech pill label. */
  picture?: string
  /** Multiple images for a tech pill (e.g. logo + screenshot). Takes precedence over `picture`. */
  pictures?: string[]
}

export type BlueprintCell = {
  id: string
  lane_id: string
  step_id: string
  /** Cell Label — primary text shown in the blueprint grid. */
  content: string
  picture: string | null
  /** The tl;dr the detail fields add up to. Renamed from `description` with the
   *  column — CellPanelEditor already labelled it "Summary" and getCell already
   *  relabelled it on the way out, so this closes a documented workaround. */
  summary: string | null
  links: CellLink[]
  /**
   * Whether this cell describes something built. Absent means shipped.
   *
   * The state used to be a `Planned — ` prefix on `content`, which put a
   * maturity inside a touchpoint NAME: a pill read "Planned — swap flow UI"
   * and the vocabulary gained a product called that. Fifty cells carried it.
   */
  maturity?: CellMaturity | null
  /**
   * Order within a slot (one lane, one step). Tech lanes hold one cell per
   * touchpoint; everything else holds a single cell at 0. Optional because
   * rows predating the split never carry it — absent reads as 0.
   */
  position?: number
}

export type BlueprintCellDependency = {
  id: string
  source_cell_id: string
  target_cell_id: string
  /** `leads_to` (default) — this cell makes the other one happen; drawn as an
   *  arrow. `enables` — the other cell must already be true; recorded, never
   *  drawn. Not inverses: a loaded roster does not set off a greeting. */
  kind?: 'leads_to' | 'enables'
  /** Short edge label, e.g. a channel tag like "Email". */
  label?: string | null
  /** Why-line shown in the cell panel dependencies tab. */
  note?: string | null
}

export type BlueprintData = {
  path: BlueprintPath
  lanes: BlueprintLane[]
  steps: BlueprintStep[]
  cells: BlueprintCell[]
  dependencies: BlueprintCellDependency[]
}

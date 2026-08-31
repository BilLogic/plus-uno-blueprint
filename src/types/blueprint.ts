import type { Json } from '@/types/database'
import type { PathType } from '@/types/database'
import type { EntityStatus } from '@/lib/entityStatus'
import type { TouchpointProminenceValue } from '@/lib/touchpointProminence'

export type BlueprintPath = {
  id: string
  name: string
  /** When this route applies — the condition that puts someone on it.
   *  Renamed from `description` with the column; `note` is the author's aside,
   *  which is the distinction plan 006 draws between the two. */
  summary: string | null
  note: string | null
  path_type: PathType  /** How far along this route is. `live` unless somebody said otherwise. */
  status: EntityStatus
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

/**
 * One touchpoint, used at one cell.
 *
 * `name` and `kind` come from the catalog and are shared by every placement
 * of that touchpoint; `summary`, `screenshot`, `url` and `prominence` are
 * this moment's own. The same tool describes a different screen at a
 * different step, which is the distinction the old label-keyed links could
 * not hold. Built by `cellTouchpoints.ts` from either source.
 */
export type CellTouchpoint = {
  /**
   * The `cell_touchpoints` row this came from, and the only handle an editor
   * may write through — a placement is identified by its id, never by the
   * name it currently shows, because the catalog owns that name and a rename
   * moves it under every placement at once.
   *
   * Null from fallback data, which has no rows at all. That null is also what
   * makes the placement editor unavailable on a hand-written fixture board,
   * which is correct: there is nothing there to save into.
   */
  id: string | null
  name: string
  /** Null from fallback data, which has nowhere to record one. */
  kind: string | null
  summary: string | null
  screenshot: string | null
  url: string | null
  /**
   * Core or peripheral AT THIS MOMENT, or null for the unmarked majority.
   * Null is a state of its own, not a quiet `peripheral` — see
   * `src/lib/touchpointProminence.ts`.
   */
  prominence: TouchpointProminenceValue
}

/**
 * One thing a cell — or one touchpoint placement — points at.
 *
 * A link is one kind of resource, which is why `kind` carries the subtype and
 * the type is named for the parent. `name` is what the thing on the other end
 * is called; this vocabulary reserves `title` for authored content a reader
 * reads and gives a name to a thing a reader navigates to.
 *
 * Built by `cellResources.ts` from either source: `resources` rows in the
 * database, or the `url`-typed entries of a fallback blueprint's `links`.
 */
export type CellResource = {
  name: string
  /** `link` for everything the migration carried; the column allows `other`. */
  kind: string
  /** Null only for a kind that is not a link — the table refuses a link without one. */
  url: string | null
}

export type BlueprintCell = {
  id: string
  lane_id: string
  step_id: string
  /** Cell Label — primary text shown in the blueprint grid. */
  content: string
  frame: string | null
  /** The tl;dr the detail fields add up to. Renamed from `description` with the
   *  column — CellPanelEditor already labelled it "Summary" and getCell already
   *  relabelled it on the way out, so this closes a documented workaround. */
  summary: string | null
  links: CellLink[]
  /**
   * Resolved touchpoint placements, from `cell_touchpoints` or from fallback
   * links. Optional for the same reason the spec block below is: the twenty
   * hand-written fixture files do not carry it, the normalizer always sets
   * it, and requiring it here would mean editing all of them to write an
   * empty array. Read it as `?? []`.
   */
  touchpoints?: CellTouchpoint[]
  /**
   * What this cell points at, from `resources` or from fallback links.
   * Optional for the same reason `touchpoints` is: the hand-written fixtures
   * do not carry it and the normalizer always sets it. Read it as `?? []`.
   */
  resources?: CellResource[]
  /*
    The spec block and the owner pair.
  
    Optional because dev fallback content does not carry them — the database
    mapper always sets all five, and `cellSpecContract.test.ts` is what holds
    that, not the type. Requiring them here would mean editing twenty fixture
    files to write `null` five times each.
  */
  /** What this cell has to accomplish. */
  function?: string | null
  /** How it comes across. */
  form?: string | null
  /** Who gets what from it — `[{ for, value }]`. */
  value_props?: Json | null
  /** The team accountable for this moment. */
  owner?: string | null
  /** Who the person on the other side THINKS is accountable. */
  perceived_owner?: string | null
  /**
   * Whether this cell describes something built. Absent means shipped.
   *
   * The state used to be a `Planned — ` prefix on `content`, which put a
   * status inside a touchpoint NAME: a pill read "Planned — swap flow UI"
   * and the vocabulary gained a product called that. Fifty cells carried it.
   */
  status?: EntityStatus | null
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
  /** The word on the arrow, e.g. a channel tag like "Email". */
  name?: string | null
}

export type BlueprintData = {
  path: BlueprintPath
  lanes: BlueprintLane[]
  steps: BlueprintStep[]
  cells: BlueprintCell[]
  dependencies: BlueprintCellDependency[]
}

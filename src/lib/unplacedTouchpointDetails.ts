/**
 * The work queue for touchpoint detail that names nothing its cell shows.
 *
 * A touchpoint's description and screenshot used to find their way back to the
 * cell by matching a label against the words in the cell's text. When the two
 * stopped agreeing the detail was simply not found, and nothing said so: 57 of
 * the 117 authored details were in that state. `20260830140000` carried the 60
 * that still resolved into `cell_touchpoints`; `20260830260000` moved the rest
 * out of `cells.links` into `unplaced_touchpoint_details`, which is what this
 * module reads.
 *
 * THE ONE RULE. Nothing here matches a name against anything. A row's `name`
 * is the label that already failed to identify a touchpoint, and treating it
 * as an instruction — assigning the detail to the catalog entry it resembles —
 * would put a screenshot of one screen under a pill meaning another, on a cell
 * whose text does not name it and which the next content save would delete
 * again. That is the guess that made these 57. So the places a detail may go
 * are read from the placements its cell HAS, and the person chooses.
 *
 * A row is never dropped, however little came back with it. A queue that hides
 * what it cannot explain is the original defect wearing a different coat.
 */
import { parseCellContentItems } from '@/lib/parseCellContent'

/** A `cell_touchpoints` row as the queue query embeds it. */
type RawTarget = {
  position: number
  touchpoint_id: string
  touchpoints: { name: string } | null
}

/** One queue row with its cell, as PostgREST returns the nested select. */
export type RawUnplacedDetail = {
  id: string
  cell_id: string
  name: string
  summary?: string | null
  screenshot?: string | null
  url?: string | null
  cells?: {
    content?: string | null
    lanes?: { name?: string | null } | null
    steps?: { name?: string | null } | null
    paths?: {
      name?: string | null
      scenarios?: {
        name?: string | null
        phases?: { name?: string | null } | null
      } | null
    } | null
    cell_touchpoints?: RawTarget[] | null
  } | null
}

/** Somewhere a detail may be placed: a touchpoint the cell already displays. */
export type PlacementTarget = {
  touchpointId: string
  name: string
}

/** One row of the queue, with everything a person needs to decide. */
export type UnplacedDetail = {
  id: string
  cellId: string
  /** The name the detail claims, which matched nothing in its cell. */
  name: string
  summary: string | null
  screenshot: string | null
  url: string | null
  /** Where the cell is, in the segment order `BLUEPRINT_CONTRACT` fixes. */
  where: string
  /** What the cell's text actually shows, in reading order. */
  shows: string[]
  /** The only places this detail may go. Empty is a real answer. */
  targets: PlacementTarget[]
}

/**
 * Said when the cell could not be resolved.
 *
 * The row still lists — its id and its words are what matter for triage, and
 * a person can find the cell from them — but the breadcrumb must not print an
 * empty string, which reads as "nowhere" rather than "not loaded".
 */
const NOWHERE = 'Somewhere in this service'

function breadcrumb(cells: RawUnplacedDetail['cells']): string {
  if (!cells) return NOWHERE
  const path = cells.paths
  const scenario = path?.scenarios
  const segments = [
    scenario?.phases?.name,
    scenario?.name,
    path?.name,
    cells.steps?.name,
    cells.lanes?.name,
  ]
    .map((segment) => segment?.trim())
    .filter((segment): segment is string => Boolean(segment))

  // Values only, no `Phase:` labels. The segment ORDER is the contract's; the
  // labels are for a parser reading a chunk title, and every row in this list
  // is the same kind of thing, so repeating them five times a row would be
  // noise a person has to read past.
  return segments.length > 0 ? segments.join(' · ') : NOWHERE
}

/**
 * The touchpoints the cell places, in the order it draws them.
 *
 * Sorted here rather than trusted: PostgREST promises no order for an embedded
 * resource, and the list an author picks from must not shuffle between reads.
 */
function targetsOf(cells: RawUnplacedDetail['cells']): PlacementTarget[] {
  return (cells?.cell_touchpoints ?? [])
    .filter((placement) => placement.touchpoints?.name)
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((placement) => ({
      touchpointId: placement.touchpoint_id,
      name: placement.touchpoints!.name,
    }))
}

/**
 * The queue, grouped by where the work is and then by name.
 *
 * Grouped rather than newest-first because triage is done a cell at a time:
 * the question "which of these pills did this describe" is answered once per
 * cell, and rows for the same cell asked in sequence are one decision instead
 * of several.
 */
export function unplacedQueue(
  rows: readonly RawUnplacedDetail[] | null | undefined,
): UnplacedDetail[] {
  return (rows ?? [])
    .map((row) => ({
      id: row.id,
      cellId: row.cell_id,
      name: row.name,
      summary: row.summary ?? null,
      screenshot: row.screenshot ?? null,
      url: row.url ?? null,
      where: breadcrumb(row.cells),
      shows: parseCellContentItems(row.cells?.content ?? ''),
      targets: targetsOf(row.cells),
    }))
    .sort(
      (a, b) =>
        a.where.localeCompare(b.where) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    )
}

/**
 * What the queue says about itself.
 *
 * An empty queue says so out loud. Rendering nothing would make "everything is
 * placed" and "the read failed" the same picture, which is precisely how half
 * the authored detail went missing for months without anyone noticing.
 */
export function queueHeadline(count: number): string {
  if (count === 0) return 'No unplaced touchpoint details'
  return `${count} unplaced touchpoint detail${count === 1 ? '' : 's'}`
}

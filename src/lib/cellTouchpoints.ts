/**
 * A cell's touchpoints, resolved from whichever source the board came from.
 *
 * The database stores placements: one `cell_touchpoints` row per touchpoint
 * used at a cell, carrying its own summary and role, joined to a
 * catalog entry that owns the name. Nothing has to match a string.
 *
 * The hand-written fallback blueprints in `src/data` predate all of that.
 * They carry a delimited list in `content` and a parallel array of
 * `tech_description` links keyed by label — the arrangement this ticket
 * retires, and the reason 57 of the 117 authored details in production
 * resolve to nothing. That data is not migrating, so the label join has to
 * survive somewhere, and it lives here rather than in the components: the
 * normalizer is already the seam between how a source stored something and
 * what the app renders, and every reader downstream then sees placements.
 *
 * A link that names nothing in its cell's content is DROPPED. Attaching it to
 * whatever the cell does show would be the guess that produced the orphans in
 * the first place; #180 is where a person places them deliberately.
 */
import { parseCellContentItems } from '@/lib/parseCellContent'
import { TECH_DESCRIPTION_LINK_TYPE } from '@/lib/blueprintTechDescriptions'
import { orderedNamedRows } from '@/lib/orderedNamedRows'
import {
  normalizeRole,
  type TouchpointRoleValue,
} from '@/lib/touchpointRole'
import type {
  BlueprintCell,
  CellLink,
  CellResource,
  CellTouchpoint,
} from '@/types/blueprint'

/** A `cell_touchpoints` row as the board query selects it. */
export type RawCellTouchpoint = {
  /** The row's own id — the handle the placement editor writes through. */
  id?: string | null
  position: number
  summary?: string | null
  role?: string | null
  /** The registry entry, or null with `name` set — a name-only placement (#277). */
  touchpoint_id?: string | null
  name?: string | null
  /** The joined registry row. PostgREST names the embed after the table. */
  touchpoints?: { name: string; kind?: string | null; icon_url?: string | null } | null
}

/** Placements from database rows, in the order the author put them. */
export function cellTouchpointsFromRows(
  rows: readonly RawCellTouchpoint[] | null | undefined,
): CellTouchpoint[] {
  // The registry's spelling where there is a registry row; the placement's
  // own name where the registry lacks it (or a fallback board has none).
  const named = (rows ?? []).map((row) => ({
    ...row,
    name: row.touchpoints?.name ?? row.name ?? null,
  }))
  return orderedNamedRows(named, (row, name) => ({
      id: row.id ?? null,
      touchpointId: row.touchpoint_id ?? null,
      name,
      kind: row.touchpoints?.kind ?? null,
      iconUrl: row.touchpoints?.icon_url ?? null,
      summary: row.summary?.trim() || null,
      role: normalizeRole(row.role),
    }))
}

/**
 * Placements from fallback content and links.
 *
 * The content string decides what exists and in what order — it is what the
 * board draws — and a link contributes detail only when its label is one of
 * those items.
 */
export function cellTouchpointsFromLinks(
  content: string | undefined,
  links: readonly CellLink[] | null | undefined,
): CellTouchpoint[] {
  const items = parseCellContentItems(content ?? '')
  if (items.length === 0) return []

  const detail = new Map<string, CellLink>()
  for (const link of links ?? []) {
    if (link.type !== TECH_DESCRIPTION_LINK_TYPE) continue
    if (!detail.has(link.label)) detail.set(link.label, link)
  }

  return items.map((name) => {
    const link = detail.get(name)
    return {
      // No row, so no id, so no editor. A hand-written fixture board has
      // nowhere to save a placement's words into, and offering the form
      // there would be offering a Save that writes nothing.
      id: null,
      touchpointId: null,
      name,
      // The fallback shape has nowhere to record a kind, an icon or a role,
      // and inventing any of them would make this source disagree with the
      // database for the same board.
      kind: null,
      iconUrl: null,
      summary: link?.description ?? null,
      role: null,
    }
  })
}

/**
 * A placement the registry lacks: a real row that names its touchpoint by
 * name alone (#277). A fallback placement has no row and no registry, and is
 * not one of these — `cellTouchpointsFromLinks` mints it with both halves
 * null, so reading the registry link alone would call every touchpoint on a
 * hand-written board name-only and draw the whole lane dashed.
 */
export function isNameOnlyPlacement(placement: CellTouchpoint): boolean {
  return placement.id !== null && placement.touchpointId === null
}

/** The resources one placement points at, in author order, featured first. */
export function placementResources(
  resources: readonly CellResource[],
  placementId: string | null,
): CellResource[] {
  if (!placementId) return []
  const own = resources.filter((resource) => resource.placementId === placementId)
  return [
    ...own.filter((resource) => resource.featured),
    ...own.filter((resource) => !resource.featured),
  ]
}

/**
 * The touchpoints placed at a cell.
 *
 * THE ONE ACCESSOR, and the only place in the app that still has to know a
 * board can arrive from two sources. A cell the normalizer built already
 * carries placements, whichever source it came from. A cell taken straight
 * out of `src/data` never went through the normalizer — `getBlueprintFallback`
 * hands its fixtures over as they are written — so it carries the delimited
 * `content` string and the label-keyed `links` array instead, and the same
 * adapter the normalizer would have used resolves it here.
 *
 * Every reader downstream of this then sees placements and nothing else,
 * which is what lets `blueprintCellSelection.ts` carry `cellTouchpoints`
 * rather than `cellLinks` and be the template's file exactly.
 */
export function cellTouchpoints(
  cell: Partial<Pick<BlueprintCell, 'content' | 'links' | 'touchpoints'>>,
): CellTouchpoint[] {
  return cell.touchpoints ?? cellTouchpointsFromLinks(cell.content, cell.links)
}

/** The placement a touchpoint's label names, or null when nothing is placed there. */
export function touchpointNamed(
  touchpoints: readonly CellTouchpoint[],
  name: string,
): CellTouchpoint | null {
  return touchpoints.find((placement) => placement.name === name) ?? null
}

/** What the detail panel shows for one touchpoint at one cell. */
export type TouchpointDetail = {
  /**
   * The placement row behind this, when there is one. Null on a fallback
   * board — and the panel keys the placement editor's availability on it, so
   * "there is nothing to save into" is answered by the same value that says
   * "there is no row".
   */
  id: string | null
  name: string
  /** The placement's own words, else the cell's, else the name. */
  text: string
  kind: string | null
  role: TouchpointRoleValue
}

/**
 * WHICH placement a selection means, before anything is derived from it.
 *
 * Split out of `resolveTouchpointDetail` because the editor and the reader
 * need different things from the same choice. The reader wants the resolved
 * detail, where an empty summary falls back to the cell's; the editor wants
 * the placement's OWN summary, empty and all, because seeding a form with the
 * cell's sentence would save that sentence onto the placement the first time
 * anybody pressed Save. One selection rule, two readings of the row it picks.
 *
 * With no name given, a cell holding exactly one touchpoint resolves it —
 * that is the single-tool cell the panel opens directly. A cell holding
 * several resolves nothing rather than guessing at the first, because showing
 * one touchpoint's screenshot under another's heading is the confusion this
 * whole change is unwinding.
 */
export function findCellPlacement(
  cell: { touchpoints: readonly CellTouchpoint[] },
  name?: string | null,
): CellTouchpoint | null {
  const wanted = name?.trim()
  if (wanted) {
    return cell.touchpoints.find((entry) => entry.name === wanted) ?? null
  }
  return cell.touchpoints.length === 1 ? cell.touchpoints[0] : null
}

/**
 * The detail for one touchpoint at one cell, or null when there isn't one.
 *
 * Replaces a set of resolvers that read `cells.links` by label and had grown
 * two hardcoded tool names as fallbacks, because the lookup kept coming back
 * empty and the two most visible cases got patched. A placement carries its
 * own summary, so the rule is now the same for every touchpoint: its words,
 * else the cell's, else its name.
 *
 * Which placement it is about is `findCellPlacement`'s answer, not a second
 * copy of the same rule.
 */
export function resolveTouchpointDetail(
  cell: { summary?: string | null; touchpoints: readonly CellTouchpoint[] },
  name?: string | null,
): TouchpointDetail | null {
  const placement = findCellPlacement(cell, name)
  if (!placement) return null

  return {
    id: placement.id,
    name: placement.name,
    text: placement.summary?.trim() || cell.summary?.trim() || placement.name,
    kind: placement.kind,
    role: placement.role,
  }
}

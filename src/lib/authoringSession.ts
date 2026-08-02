/**
 * What has been changed since Edit was turned on.
 *
 * Every structural write in the app goes through one `call()` in
 * `authoringRpc.ts`, so the log is an append there — which is what makes it
 * trustworthy: it records calls that were actually made, not intentions. It
 * cannot drift from the database, because it *is* the list of things sent to
 * the database.
 *
 * Deliberately not an undo stack. Undo is positional — it reverses whatever
 * happened last — while this is addressable: having added a step, a lane and a
 * cell, wanting the lane back should not mean undoing two things you meant to
 * keep. Reverting a single entry is a later phase; knowing what you changed is
 * most of the value and arrives first.
 *
 * Module-level rather than React state because `call()` is a plain function
 * with no component around it. Subscribers read through `useSyncExternalStore`.
 */

export type ChangeEntry = {
  id: string
  /** The RPC that ran, e.g. `add_step`. */
  fn: string
  /** Exactly what was sent. Ids, not names — names are resolved at render. */
  args: Record<string, unknown>
  at: number
}

/** Operations that cannot be taken back once the session is saved. */
const DESTRUCTIVE = new Set([
  'delete_scenario',
  'delete_path',
  'delete_cell',
  'remove_step',
  'remove_lane',
])

/**
 * Operations with no inverse at all. `Discard all` reverts around these and
 * names them rather than refusing to run — one un-revertible change must not
 * kill the escape hatch for everything else.
 */
const IRREVERSIBLE = new Set<string>([])

let entries: ChangeEntry[] = []
let listeners: Array<() => void> = []
let counter = 0

function emit() {
  for (const listener of listeners) listener()
}

export function subscribeToSession(listener: () => void): () => void {
  listeners = [...listeners, listener]
  return () => {
    listeners = listeners.filter((entry) => entry !== listener)
  }
}

/** Stable snapshot — `useSyncExternalStore` compares by identity. */
export function sessionSnapshot(): ChangeEntry[] {
  return entries
}

export function recordChange(fn: string, args: Record<string, unknown>): void {
  counter += 1
  entries = [...entries, { id: `c${counter}`, fn, args, at: Date.now() }]
  emit()
}

/** Save: the changes are wanted, so stop tracking them. Writes nothing. */
export function clearSession(): void {
  if (entries.length === 0) return
  entries = []
  emit()
}

export function forgetChange(id: string): void {
  const next = entries.filter((entry) => entry.id !== id)
  if (next.length === entries.length) return
  entries = next
  emit()
}

/** True when saving would put anything permanently out of reach. */
export function sessionHasDestructive(list: readonly ChangeEntry[]): boolean {
  return list.some((entry) => DESTRUCTIVE.has(entry.fn))
}

export function isIrreversible(entry: ChangeEntry): boolean {
  return IRREVERSIBLE.has(entry.fn)
}

/**
 * One human sentence per change.
 *
 * Named by what was done, never by table — "Added a step" and not
 * `INSERT path_steps`. Where a name was supplied to the RPC it is quoted,
 * because that is the word the person typed and the one they will recognise.
 */
/** Rename args carry `new_name`, not `name` — quote what it became. */
function renameTo(entry: ChangeEntry): string {
  const name =
    typeof entry.args.new_name === 'string' ? entry.args.new_name.trim() : ''
  return name ? ` to “${name}”` : ''
}

export function describeChange(entry: ChangeEntry): string {
  const name = typeof entry.args.name === 'string' ? entry.args.name.trim() : ''
  const quoted = name ? ` “${name}”` : ''

  switch (entry.fn) {
    case 'create_phase':
      return `Added phase${quoted}`
    case 'create_scenario':
      return `Added scenario${quoted}`
    case 'create_path':
      return `Added path${quoted}`
    case 'duplicate_path':
      return `Duplicated a path as${quoted || ' a copy'}`
    case 'rename_phase':
      return `Renamed a phase${renameTo(entry)}`
    case 'rename_scenario':
      return `Renamed a scenario${renameTo(entry)}`
    case 'rename_path':
      return `Renamed a path${renameTo(entry)}`
    case 'add_step':
      return name ? `Added step${quoted}` : 'Added a step'
    case 'add_lane':
      return `Added lane${quoted}`
    case 'upsert_cell':
      return 'Added a cell'
    case 'set_cell_dependency':
      return 'Connected two cells'
    case 'clear_cell_dependency':
      return 'Removed a connection'
    case 'reorder_steps':
    case 'set_path_steps':
      return 'Reordered the steps'
    case 'reorder_lanes':
      return 'Reordered the lanes'
    case 'delete_scenario':
      return 'Deleted a scenario'
    case 'delete_path':
      return 'Deleted a path'
    case 'remove_step':
      return 'Deleted a step'
    case 'remove_lane':
      return 'Deleted a lane'
    case 'delete_cell':
      return 'Deleted a cell'
    default:
      // A new RPC that nobody taught this function about still shows up in the
      // list. Silence would be worse: an untracked change is the one case the
      // sheet exists to prevent.
      return entry.fn.replace(/_/g, ' ')
  }
}

/**
 * Group changes by the path they touched, falling back to a bucket for the
 * ones that name no path.
 *
 * A session can span blueprints, so a flat list puts two "Added a cell" rows
 * next to each other with nothing to tell them apart — the same defect as an
 * arrow picker offering three identical rows.
 */
export function groupChanges(
  list: readonly ChangeEntry[],
): Array<{ pathId: string | null; entries: ChangeEntry[] }> {
  const groups: Array<{ pathId: string | null; entries: ChangeEntry[] }> = []
  for (const entry of list) {
    const raw =
      entry.args.path_id ?? entry.args.source_path_id ?? entry.args.scenario_id
    const pathId = typeof raw === 'string' ? raw : null
    const existing = groups.find((group) => group.pathId === pathId)
    if (existing) existing.entries.push(entry)
    else groups.push({ pathId, entries: [entry] })
  }
  return groups
}

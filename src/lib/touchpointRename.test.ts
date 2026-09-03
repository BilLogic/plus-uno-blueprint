/**
 * A rename must survive the next content save.
 *
 * The defect this file exists for happens one save LATER than the rename. The
 * catalog row moves, the board redraws correctly, and nothing looks wrong —
 * until somebody edits any affected cell. That save re-derives placements
 * from `cells.content`, which still holds the OLD string, so
 * `sync_cell_touchpoints` is handed a name the renamed placement no longer
 * has, deletes it along with its per-moment summary and screenshot, and
 * creates a fresh catalog entry under the old name in its place. A test that
 * only checked the rename itself would pass throughout.
 *
 * ── Why there is a model here ──────────────────────────────────────────────
 *
 * Both halves of the fix are SQL — `rename_touchpoint` and
 * `sync_cell_touchpoints` are functions because the work has to be one
 * transaction, and PostgREST gives every statement its own. There is no
 * Postgres on the machines this repo is developed on, so the SQL proves
 * itself where it lives: `20260830220000` asserts the item match and the
 * survive-the-save sequence in `do` blocks that run on every apply, and the
 * empty-database replay runs the pure ones.
 *
 * What is left for this file is the seam SQL cannot reach: that the CLIENT
 * calls the rename once and records an inverse restoring both halves, and
 * that the ordinary content-save path — the real `updateCellContent`, the
 * real `parseCellContentItems` — leaves the writing alone once the text has
 * moved. The tables below are a faithful port of the two functions, and the
 * first test is a RED one: it drives the model with a catalog-only rename,
 * the naive fix, and shows the model losing the summary and the screenshot.
 * A model that cannot exhibit the bug would prove nothing about the fix.
 */
import { beforeEach, expect, test } from 'vitest'
import { updateCellContent } from '@/lib/cellContentMutations'
import { renameTouchpoint } from '@/lib/touchpointMutations'
import { executeRevert } from '@/lib/revertChange'
import { clearSession, sessionSnapshot } from '@/lib/authoringSession'
import { parseCellContentItems } from '@/lib/parseCellContent'

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

type TouchpointRow = { id: string; name: string }
type PlacementRow = {
  id: string
  cell_id: string
  touchpoint_id: string
  position: number
  summary: string | null
  screenshot: string | null
  url: string | null
  role: string | null
}
type CellRow = { id: string; lane_role: string; content: string }

type Db = {
  touchpoints: TouchpointRow[]
  placements: PlacementRow[]
  cells: CellRow[]
}

const TOUCHPOINT_LANES = new Set(['frontstage_touchpoints', 'backstage_touchpoints'])

let nextId = 0
const id = (prefix: string) => `${prefix}-${(nextId += 1)}`

/**
 * `rename_content_item`, ported.
 *
 * The match is against a whole ITEM of the delimited list, never a substring:
 * `cells.content` is what `parseCellContentItems` splits on newline or comma
 * and trims, so renaming `Zoom` has to leave `Zoom Recording` alone. Split
 * keeping the delimiters, map the items, join — which puts the author's
 * spacing back verbatim wherever nothing matched.
 */
function renameContentItem(content: string, from: string, to: string): string {
  return content
    .split(/([\n,])/)
    .map((part) => {
      if (part === '\n' || part === ',') return part
      if (part.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '') !== from) return part
      const lead = /^[ \t\r\n]*/.exec(part)![0]
      const tail = /[ \t\r\n]*$/.exec(part)![0]
      return `${lead}${to}${tail}`
    })
    .join('')
}

/** `sync_cell_touchpoints`, ported. */
function syncCellTouchpoints(db: Db, cellId: string, names: string[]) {
  const cell = db.cells.find((row) => row.id === cellId)
  if (!cell) throw new Error(`cell ${cellId} is not attached to a service`)

  const bearing =
    TOUCHPOINT_LANES.has(cell.lane_role) ||
    db.placements.some((row) => row.cell_id === cellId)
  if (!bearing) return { skipped: true, removed: [] }

  // De-duplicated, keeping the first position each name took.
  const wanted = new Map<string, number>()
  names.forEach((name, index) => {
    if (!name.trim()) return
    if (!wanted.has(name)) wanted.set(name, index + 1)
  })

  for (const name of wanted.keys()) {
    if (!db.touchpoints.some((row) => row.name === name)) {
      // Minted by name alone: the catalog is the deployment's (ADR 0014).
      db.touchpoints.push({ id: id('tp'), name })
    }
  }

  const nameOf = (placement: PlacementRow) =>
    db.touchpoints.find((row) => row.id === placement.touchpoint_id)!.name

  const here = db.placements.filter((row) => row.cell_id === cellId)
  const removed = here
    .filter((row) => !wanted.has(nameOf(row)))
    .map((row) => ({
      name: nameOf(row),
      position: row.position,
      summary: row.summary,
      screenshot: row.screenshot,
      url: row.url,
      role: row.role,
    }))
  db.placements = db.placements.filter(
    (row) => row.cell_id !== cellId || wanted.has(nameOf(row)),
  )

  // Kept names are REPOSITIONED, never deleted and re-added — the whole
  // reason the sync is a diff and not a rebuild.
  for (const row of db.placements.filter((entry) => entry.cell_id === cellId)) {
    row.position = wanted.get(nameOf(row))!
  }
  for (const [name, position] of wanted) {
    const touchpoint = db.touchpoints.find((row) => row.name === name)!
    if (
      db.placements.some(
        (row) => row.cell_id === cellId && row.touchpoint_id === touchpoint.id,
      )
    ) {
      continue
    }
    db.placements.push({
      id: id('ct'),
      cell_id: cellId,
      touchpoint_id: touchpoint.id,
      position,
      summary: null,
      screenshot: null,
      url: null,
      role: null,
    })
  }

  return { skipped: false, removed }
}

/** `rename_touchpoint`, ported — both halves, or an exception. */
function renameTouchpointRpc(db: Db, touchpointId: string, name: string) {
  const wanted = name.trim()
  if (!wanted) throw new Error('a touchpoint needs a name')

  const touchpoint = db.touchpoints.find((row) => row.id === touchpointId)
  if (!touchpoint) throw new Error(`touchpoint ${touchpointId} does not exist`)
  if (
    db.touchpoints.some(
      (row) => row.id !== touchpointId && row.name === wanted,
    )
  ) {
    throw new Error('duplicate key value violates unique constraint')
  }

  const previous = touchpoint.name
  touchpoint.name = wanted

  const cellIds: string[] = []
  if (previous !== wanted) {
    // Identity, not text search: the placements say which cells bear it.
    for (const placement of db.placements.filter(
      (row) => row.touchpoint_id === touchpointId,
    )) {
      const cell = db.cells.find((row) => row.id === placement.cell_id)!
      const next = renameContentItem(cell.content, previous, wanted)
      if (next !== cell.content) {
        cell.content = next
        cellIds.push(cell.id)
      }
    }
    const stale = db.placements.filter(
      (row) =>
        row.touchpoint_id === touchpointId &&
        parseCellContentItems(
          db.cells.find((cell) => cell.id === row.cell_id)!.content,
        ).includes(previous),
    ).length
    if (stale !== 0) {
      throw new Error(`${stale} cells still name "${previous}"`)
    }
  }

  return {
    touchpoint_id: touchpointId,
    name: wanted,
    previous_name: previous,
    cell_ids: cellIds,
  }
}

/** `restore_cell_touchpoints`, ported. */
function restoreCellTouchpoints(
  db: Db,
  cellId: string,
  rows: Array<{ name: string; summary: string | null; screenshot: string | null }>,
) {
  for (const row of rows) {
    const touchpoint = db.touchpoints.find((entry) => entry.name === row.name)
    if (!touchpoint) continue
    const placement = db.placements.find(
      (entry) => entry.cell_id === cellId && entry.touchpoint_id === touchpoint.id,
    )
    if (!placement) continue
    placement.summary = row.summary
    placement.screenshot = row.screenshot
  }
}

/** The PostgREST builder chain, over the model. */
function clientFor(db: Db) {
  return {
    rpc(name: string, args: Record<string, unknown>) {
      try {
        if (name === 'sync_cell_touchpoints') {
          return Promise.resolve({
            data: syncCellTouchpoints(db, args.p_cell_id as string, args.p_names as string[]),
            error: null,
          })
        }
        if (name === 'rename_touchpoint') {
          return Promise.resolve({
            data: renameTouchpointRpc(db, args.p_touchpoint_id as string, args.p_name as string),
            error: null,
          })
        }
        if (name === 'restore_cell_touchpoints') {
          restoreCellTouchpoints(
            db,
            args.p_cell_id as string,
            args.p_rows as Array<{
              name: string
              summary: string | null
              screenshot: string | null
            }>,
          )
          return Promise.resolve({ data: null, error: null })
        }
        throw new Error(`no function ${name}`)
      } catch (thrown) {
        return Promise.resolve({ data: null, error: { message: (thrown as Error).message } })
      }
    },
    from(table: string) {
      return {
        update(values: Record<string, unknown>) {
          return {
            eq(_column: string, value: string) {
              return {
                select() {
                  if (table !== 'cells') return Promise.resolve({ data: [], error: null })
                  const cell = db.cells.find((row) => row.id === value)
                  if (!cell) return Promise.resolve({ data: [], error: null })
                  cell.content = values.content as string
                  return Promise.resolve({ data: [{ id: cell.id }], error: null })
                },
              }
            },
          }
        },
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a stand-in, not a SupabaseClient
  } as any
}

/**
 * One cell on a touchpoint lane naming two tools whose names overlap, the
 * shorter one carrying a summary and a screenshot.
 *
 * `Zoom` and `Zoom Recording` are both real entries in this catalog — the
 * second arrived from a Support Actions cell in 20260830140000 — so the near
 * miss is not hypothetical. They share a cell here so one save can show it.
 */
function fixture() {
  nextId = 0
  const db: Db = {
    touchpoints: [
      { id: 'tp-zoom', name: 'Zoom' },
      { id: 'tp-recording', name: 'Zoom Recording' },
    ],
    placements: [
      {
        id: 'ct-zoom',
        cell_id: 'cell-1',
        touchpoint_id: 'tp-zoom',
        position: 1,
        summary: 'The tutor opens the room from the session card',
        screenshot: 'https://example.invalid/zoom.png',
        url: null,
        role: 'core',
      },
      {
        id: 'ct-recording',
        cell_id: 'cell-1',
        touchpoint_id: 'tp-recording',
        position: 2,
        summary: 'Reviewed afterwards by the lead',
        screenshot: 'https://example.invalid/recording.png',
        url: null,
        role: 'peripheral',
      },
    ],
    cells: [
      {
        id: 'cell-1',
        lane_role: 'frontstage_touchpoints',
        content: 'Zoom, Zoom Recording',
      },
    ],
  }
  return db
}

const cellOf = (db: Db) => db.cells.find((row) => row.id === 'cell-1')!
const placementOf = (db: Db, touchpointId: string) =>
  db.placements.find(
    (row) => row.cell_id === 'cell-1' && row.touchpoint_id === touchpointId,
  )

/** An ordinary content save, exactly as the panel makes it. */
const save = (client: unknown, content: string) =>
  updateCellContent(
    client as never,
    'cell-1',
    { content, summary: '', owner: '', perceivedOwner: '', status: 'live' },
    undefined,
    { record: false },
  )

beforeEach(() => {
  clearSession()
})

// ---------------------------------------------------------------------------
// The red case
// ---------------------------------------------------------------------------

test('a catalog-only rename is undone by the next content save', async () => {
  // The naive fix, and the defect stated as a sequence. Nothing here is what
  // the app does — it is what the app would do if the rename stopped at the
  // catalog row, and it is in this file so the tests below cannot be passing
  // against a model that could not tell the difference.
  const db = fixture()
  const client = clientFor(db)
  db.touchpoints.find((row) => row.id === 'tp-zoom')!.name = 'Zoom Meetings'

  // The cell still says "Zoom", so this is the text an author saves.
  await save(client, cellOf(db).content)

  expect(placementOf(db, 'tp-zoom')).toBeUndefined()
  // And the old name is back in the catalog, placed, with nothing written on
  // it — the rename gone and the authored detail with it.
  const resurrected = db.touchpoints.find((row) => row.name === 'Zoom')
  expect(resurrected).toBeDefined()
  expect(placementOf(db, resurrected!.id)!.summary).toBeNull()
})

// ---------------------------------------------------------------------------
// The fix
// ---------------------------------------------------------------------------

test('a rename moves the catalog row and the cell text together', async () => {
  const db = fixture()
  const result = await renameTouchpoint(clientFor(db), 'tp-zoom', 'Zoom Meetings')

  expect(db.touchpoints.find((row) => row.id === 'tp-zoom')!.name).toBe('Zoom Meetings')
  expect(cellOf(db).content).toBe('Zoom Meetings, Zoom Recording')
  expect(result.previousName).toBe('Zoom')
  expect(result.cellIds).toEqual(['cell-1'])
})

test('a longer name containing the renamed one is left alone', async () => {
  const db = fixture()
  await renameTouchpoint(clientFor(db), 'tp-zoom', 'Zoom Meetings')

  // The near miss. A substring replace would have made this "Zoom Meetings
  // Recording" and orphaned the second placement on the next save.
  expect(parseCellContentItems(cellOf(db).content)).toEqual([
    'Zoom Meetings',
    'Zoom Recording',
  ])
  expect(db.touchpoints.find((row) => row.id === 'tp-recording')!.name).toBe(
    'Zoom Recording',
  )
})

test('editing an affected cell after a rename keeps its summary and screenshot', async () => {
  // The load-bearing one, and the exact sequence the issue describes: rename,
  // then an ordinary save of the affected cell through the same path the
  // panel uses.
  const db = fixture()
  const client = clientFor(db)
  await renameTouchpoint(client, 'tp-zoom', 'Zoom Meetings')

  await save(client, cellOf(db).content)

  const placement = placementOf(db, 'tp-zoom')
  expect(placement).toBeDefined()
  // The same ROW, not a replacement that happens to look like it.
  expect(placement!.id).toBe('ct-zoom')
  expect(placement!.summary).toBe('The tutor opens the room from the session card')
  expect(placement!.screenshot).toBe('https://example.invalid/zoom.png')
  expect(placement!.role).toBe('core')
  // And the neighbour, whose name merely contains the renamed one.
  expect(placementOf(db, 'tp-recording')!.screenshot).toBe(
    'https://example.invalid/recording.png',
  )
  // No stray catalog entry under the old name.
  expect(db.touchpoints.filter((row) => row.name === 'Zoom')).toEqual([])
})

test('a rename survives an author reordering the cell afterwards', async () => {
  // The other half of the same claim: the text is still the author's to edit,
  // and a reorder must keep both placements and their writing.
  const db = fixture()
  const client = clientFor(db)
  await renameTouchpoint(client, 'tp-zoom', 'Zoom Meetings')

  await save(client, 'Zoom Recording, Zoom Meetings')

  expect(placementOf(db, 'tp-recording')!.position).toBe(1)
  expect(placementOf(db, 'tp-zoom')!.position).toBe(2)
  expect(placementOf(db, 'tp-zoom')!.summary).toBe(
    'The tutor opens the room from the session card',
  )
})

// ---------------------------------------------------------------------------
// The ledger
// ---------------------------------------------------------------------------

test('the rename is recorded with an inverse that restores both halves', async () => {
  const db = fixture()
  const client = clientFor(db)
  await renameTouchpoint(client, 'tp-zoom', 'Zoom Meetings')

  const [entry] = sessionSnapshot()
  expect(entry.fn).toBe('rename_touchpoint')
  expect(entry.args.new_name).toBe('Zoom Meetings')
  expect(entry.args.cell_ids).toEqual(['cell-1'])
  // Keyed on the touchpoint's id, never on either name — the house rule that
  // stops an inverse landing on whatever carries that word now.
  expect(entry.revert).toEqual({
    fn: 'rename_touchpoint',
    args: { p_touchpoint_id: 'tp-zoom', p_name: 'Zoom' },
  })

  await executeRevert(client, entry)

  // BOTH halves. Restoring the catalog row alone would leave the cells saying
  // "Zoom Meetings" and the next save would orphan the placement all over
  // again — the defect, reintroduced by its own undo.
  expect(db.touchpoints.find((row) => row.id === 'tp-zoom')!.name).toBe('Zoom')
  expect(cellOf(db).content).toBe('Zoom, Zoom Recording')
  expect(placementOf(db, 'tp-zoom')!.summary).toBe(
    'The tutor opens the room from the session card',
  )
})

test('a revert records nothing of its own', async () => {
  const db = fixture()
  const client = clientFor(db)
  await renameTouchpoint(client, 'tp-zoom', 'Zoom Meetings')
  const [entry] = sessionSnapshot()

  await executeRevert(client, entry)

  // Undoing "Renamed a touchpoint" must not append a second rename to the
  // very list the first one is in.
  expect(sessionSnapshot()).toHaveLength(1)
})

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

test('a rename to nothing never reaches the database', async () => {
  const db = fixture()
  await expect(renameTouchpoint(clientFor(db), 'tp-zoom', '   ')).rejects.toThrow(
    /needs a name/,
  )
  expect(db.touchpoints.find((row) => row.id === 'tp-zoom')!.name).toBe('Zoom')
  expect(sessionSnapshot()).toHaveLength(0)
})

test('renaming a touchpoint that is gone throws instead of recording an inverse', async () => {
  const db = fixture()
  await expect(
    renameTouchpoint(clientFor(db), 'tp-vanished', 'Anything'),
  ).rejects.toThrow()
  // A zero-row write is a failure, not a no-op: an entry here would offer an
  // undo for a rename that never happened.
  expect(sessionSnapshot()).toHaveLength(0)
})

test('a rename onto a name the service already uses is refused whole', async () => {
  const db = fixture()
  await expect(
    renameTouchpoint(clientFor(db), 'tp-zoom', 'Zoom Recording'),
  ).rejects.toThrow()
  expect(db.touchpoints.find((row) => row.id === 'tp-zoom')!.name).toBe('Zoom')
  expect(cellOf(db).content).toBe('Zoom, Zoom Recording')
})

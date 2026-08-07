import { test, expect } from 'vitest'
import { describeChange, type ChangeEntry, type WriteFn } from '@/lib/authoringSession'

/**
 * The two guarantees `WriteFn` exists to make. Both are compile-time — this
 * file is type-checked by `npm run build` — so the runtime assertions below
 * exist only so a failure is reported by name rather than as a silent absence.
 */

/**
 * A read RPC's name may never be a member of `WriteFn`.
 *
 * The ledger used to hold a deny-list of these and silently drop anything
 * matching it. Silent dropping is the wrong shape of guard: it protects
 * against a read being recorded (harmless, cosmetic) by risking a write being
 * forgotten (data loss, invisible). The union inverts that — a read name at
 * the ledger's door is a type error at the call site instead.
 */
type ReadFn = 'deletion_impact' | 'cell_natural_key' | 'slices_referencing'
type ReadsThatAreWrites = Extract<WriteFn, ReadFn>
const NO_READ_IS_A_WRITE: ReadsThatAreWrites extends never ? true : false = true

test('no read RPC can be recorded as a change', () => {
  expect(NO_READ_IS_A_WRITE).toBe(true)
})

/**
 * Every `WriteFn` has a sentence. `describeChange` is a `Record<WriteFn, …>`,
 * so this cannot fail to compile — but it can fail at runtime if the record is
 * ever built dynamically, and the list below doubles as the readable inventory
 * of what the sheet can say.
 */
const EVERY_WRITE: WriteFn[] = [
  'create_phase',
  'create_scenario',
  'create_path',
  'duplicate_path',
  'duplicate_scenario',
  'rename_phase',
  'rename_scenario',
  'rename_path',
  'rename_owner_tag',
  'add_step',
  'add_lane',
  'upsert_cell',
  'update_cell_content',
  'update_cell_resources',
  'update_cell_spec',
  'add_evidence',
  'delete_evidence',
  'set_cell_dependency',
  'clear_cell_dependency',
  'reorder_steps',
  'set_path_steps',
  'reorder_lanes',
  'delete_scenario',
  'delete_path',
  'remove_step',
  'remove_lane',
  'delete_cell',
  'delete_slice',
]

test('every recordable operation reads as a sentence, not an identifier', () => {
  for (const fn of EVERY_WRITE) {
    const entry: ChangeEntry = { id: 'c1', fn, args: {}, at: 0 }
    const described = describeChange(entry)
    expect(described.length).toBeGreaterThan(0)
    // The old switch's `default` returned the lowercased function name, which
    // is what put "duplicate scenario" in the change list.
    expect(described).not.toBe(fn.replace(/_/g, ' '))
    // A sentence, so it starts like one.
    expect(described[0]).toBe(described[0].toUpperCase())
  }
})

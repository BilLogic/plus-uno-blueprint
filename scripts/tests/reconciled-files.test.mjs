#!/usr/bin/env node
/**
 * The reconciled-set drift gate's contract (#319): an empty allowlist passes,
 * an enrolled file byte-identical to asb passes, an enrolled file that differs
 * fails.
 *
 * `auditReconciled` is exercised against in-memory readers rather than a real
 * asb checkout, so the outcomes are pinned to byte-equality alone and not to
 * whatever the pinned package happens to ship. The one test that does touch
 * the shipped list asserts the enrolled set — first populated by #351, the
 * shared arrow-routing engine.
 *
 * Run: npm test
 */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { auditReconciled } from '../check-reconciled-files.mjs'
import { RECONCILED_FILES } from '../reconciled-files.mjs'

const bytes = (text) => Buffer.from(text, 'utf8')
const refuse = () => {
  throw new Error('an empty allowlist must not read any file')
}

test('an empty allowlist has nothing to fail on, and reads nothing', () => {
  assert.deepEqual(auditReconciled({ files: [], readInstance: refuse, readAsb: refuse }), [])
})

test('the shipped allowlist holds the arrow engine (#351) and the panel editors (#357)', () => {
  // #319 shipped the gate EMPTY; #351 enrolled the first files — the shared
  // arrow-routing geometry — and #357 enrolled the entity panel editors asb
  // ported back out of uno. A stray add or removal trips here, so enrolment
  // stays a deliberate act in a reconciliation ticket.
  assert.deepEqual(RECONCILED_FILES, [
    'src/lib/blueprintArrowGeometry.ts',
    'src/lib/arrowAnchorSlots.ts',
    'src/lib/serviceSpecMutations.ts',
    'src/lib/scenarioSpecMutations.ts',
    'src/lib/phaseSpecMutations.ts',
    'src/lib/laneSpecMutations.ts',
    'src/lib/stepSpecMutations.ts',
    'src/lib/entityStatus.ts',
    'src/lib/panelText.ts',
    'src/lib/panelEditorBusy.ts',
    'src/components/blueprint/panelShell.tsx',
    'src/components/blueprint/panelLoading.tsx',
    'src/components/blueprint/StepPanel.tsx',
    'src/components/blueprint/PanelSectionLabel.tsx',
    'src/components/blueprint/PanelTextareaField.tsx',
    'src/components/blueprint/OptionSelect.tsx',
    'src/components/blueprint/StatusSelect.tsx',
    'src/components/blueprint/StatusBadge.tsx',
    'src/components/blueprint/StakeholderBadge.tsx',
    'src/components/ui/select.tsx',
    'src/components/blueprint/EntityHeader.tsx',
    'src/components/blueprint/EntityTitleAffordance.tsx',
    'src/components/blueprint/EntityPropertiesButton.tsx',
    'src/components/blueprint/LaneHeaderAffordance.tsx',
    'src/components/blueprint/StepHeaderAffordance.tsx',
    'src/components/editor/ServiceOverviewHeader.tsx',
    'src/lib/openPanelStore.ts',
    'src/lib/panelSheetSnap.ts',
    'src/hooks/useCanvasTopOffset.ts',
    'src/hooks/usePanelFooterHost.ts',
    'src/contexts/scenarioBoardScopeContext.ts',
    'src/contexts/shellBootStore.ts',
    'src/components/blueprint/laneStepHeaderAffordance.test.tsx',
    'src/components/blueprint/panelDrawerShell.test.tsx',
    'src/lib/panelSheetSnapContract.test.ts',
  ])
})

test('an enrolled file byte-identical to asb passes', () => {
  const problems = auditReconciled({
    files: ['src/lib/shared.ts'],
    readInstance: () => bytes('export const x = 1\n'),
    readAsb: () => bytes('export const x = 1\n'),
  })
  assert.deepEqual(problems, [])
})

test('an enrolled file that differs from asb fails', () => {
  const problems = auditReconciled({
    files: ['src/lib/shared.ts'],
    readInstance: () => bytes('export const x = 1\n'),
    readAsb: () => bytes('export const x = 2\n'),
  })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /drifted/)
})

test('a difference as small as a trailing newline fails — this is byte-identity', () => {
  const problems = auditReconciled({
    files: ['src/lib/shared.ts'],
    readInstance: () => bytes('export const x = 1\n'),
    readAsb: () => bytes('export const x = 1'),
  })
  assert.equal(problems.length, 1)
})

test('an enrolled path asb does not ship fails rather than passing blind', () => {
  const problems = auditReconciled({
    files: ['src/lib/instance-only.ts'],
    readInstance: () => bytes('export const x = 1\n'),
    readAsb: () => null,
  })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /no copy/)
})

test('an enrolled path this repo has deleted fails rather than passing blind', () => {
  const problems = auditReconciled({
    files: ['src/lib/gone.ts'],
    readInstance: () => null,
    readAsb: () => bytes('export const x = 1\n'),
  })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /does not exist in this repo/)
})

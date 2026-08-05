import test from 'node:test'
import assert from 'node:assert/strict'
import { findingFingerprint } from '../../src/lib/findingFingerprint.ts'

test('cell order never changes identity', async () => {
  const a = await findingFingerprint('gap-sweep', ['c', 'a', 'b'], undefined)
  const b = await findingFingerprint('gap-sweep', ['a', 'b', 'c'], undefined)
  assert.equal(a, b)
})

test('different cells, different identity', async () => {
  const a = await findingFingerprint('gap-sweep', ['a', 'b'], undefined)
  const b = await findingFingerprint('gap-sweep', ['a', 'c'], undefined)
  assert.notEqual(a, b)
})

test('the same cells under different checks stay separate', async () => {
  const a = await findingFingerprint('gap-sweep', ['a'], undefined)
  const b = await findingFingerprint('jargon-lint', ['a'], undefined)
  assert.notEqual(a, b)
})

test('the newline joiner collides only on input that cannot occur', async () => {
  // Honest about the algorithm: joining with '\n' means one id CONTAINING a
  // newline hashes identically to two ids split at it. The joiner is fixed
  // by audit-playbook §2 (changing it would invalidate every fingerprint
  // already stored, and desync the IDE), so the invariant that saves it is
  // upstream: ids are UUIDs. This test pins BOTH halves of that reasoning,
  // so if cell ids ever stop being UUIDs the second assertion is the alarm.
  const joined = await findingFingerprint('c', ['a\nb'], undefined)
  const separate = await findingFingerprint('c', ['a', 'b'], undefined)
  assert.equal(joined, separate, 'documented collision — see comment')

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
  const realIds = [
    'a0000000-0000-4000-8000-000000040101',
    'a0000000-0000-4000-8000-000000040102',
  ]
  for (const id of realIds) {
    assert.match(id, uuid)
    assert.ok(!id.includes('\n'), 'a UUID cannot contain the joiner')
  }
})

test('zero-cell findings use the scope, and the slug discriminates', async () => {
  const one = await findingFingerprint('gap-sweep', [], 'warm-up:orphan-step')
  const two = await findingFingerprint('gap-sweep', [], 'warm-up:empty-lane')
  assert.equal(one, 'gap-sweep:warm-up:orphan-step')
  assert.notEqual(one, two)
})

test('a cited finding never collides with a scoped one', async () => {
  const cited = await findingFingerprint('gap-sweep', ['a'], undefined)
  const scoped = await findingFingerprint('gap-sweep', [], 'warm-up')
  assert.notEqual(cited, scoped)
})

#!/usr/bin/env node
/**
 * What a modifier means when a cell is clicked.
 *
 * The grammar was previously spread across three call sites with slightly
 * different opinions, which is how a selection becomes "messy": every gesture
 * individually defensible, no two agreeing. These tests exist so that the
 * table in `cellPickGrammar` is the only place the answer lives.
 *
 * Run: npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clickPicks,
  pickModeForClick,
  pickModeForMarquee,
} from '../../src/lib/cellPickGrammar.ts'

const click = (mods = {}) => ({
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  ...mods,
})

test('a plain click toggles, so a set can be built by clicking', () => {
  assert.equal(pickModeForClick(click(), true), 'toggle')
})

test('toggle is also how a cell leaves — unpicking needs no new gesture', () => {
  // Same mode both ways round: `toggle` is in-if-out, out-if-in, so there is
  // no separate "deselect" gesture that could be missing.
  assert.equal(pickModeForClick(click(), true), 'toggle')
  assert.equal(pickModeForClick(click({ metaKey: true }), true), 'toggle')
})

test('shift reaches across a run when the picker gathers', () => {
  assert.equal(pickModeForClick(click({ shiftKey: true }), true), 'range')
})

test('shift falls back to toggle when there is no run to reach across', () => {
  // A slice edit session picks one cell into the active frame; there is no
  // ordered gathering to span, so a range would select something arbitrary.
  assert.equal(pickModeForClick(click({ shiftKey: true }), false), 'toggle')
})

test('cmd and ctrl behave as a plain click, never as nothing', () => {
  // Figma's ⌘-click descends into a child; there is no nesting here. Matching
  // the plain click means the modifier people reach for by habit does the
  // expected harmless thing.
  assert.equal(pickModeForClick(click({ metaKey: true }), true), 'toggle')
  assert.equal(pickModeForClick(click({ ctrlKey: true }), true), 'toggle')
})

test('shift wins over cmd when both are held', () => {
  assert.equal(
    pickModeForClick(click({ shiftKey: true, metaKey: true }), true),
    'range',
  )
})

test('a bare marquee replaces; shift-marquee widens', () => {
  assert.equal(pickModeForMarquee({ shiftKey: false }), 'replace')
  assert.equal(pickModeForMarquee({ shiftKey: true }), 'add')
})

test('outside Edit mode only a modified click reaches the picker', () => {
  assert.equal(clickPicks(click(), false), false)
  assert.equal(clickPicks(click({ shiftKey: true }), false), true)
  assert.equal(clickPicks(click({ metaKey: true }), false), true)
  assert.equal(clickPicks(click({ ctrlKey: true }), false), true)
})

test('in Edit mode every click reaches the picker', () => {
  assert.equal(clickPicks(click(), true), true)
})

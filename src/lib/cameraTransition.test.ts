import { describe, expect, it } from 'vitest'
import {
  createCameraTransitionClock,
  easeCameraTransition,
  interpolateCameraTransform,
  transformCameraAroundPoint,
} from '@/lib/cameraTransition'

const viewport = { width: 1200, height: 800 }
const from = { pan: { x: -100, y: -50 }, zoom: 0.5 }
const to = { pan: { x: 240, y: 160 }, zoom: 1.4 }

describe('camera transition', () => {
  it('lands on exact endpoints', () => {
    expect(interpolateCameraTransform(from, to, viewport, 0)).toEqual(from)
    expect(interpolateCameraTransform(from, to, viewport, 1)).toEqual(to)
  })

  it('stays finite for pure pan and nearly equal zoom', () => {
    const value = interpolateCameraTransform(
      { pan: { x: 0, y: 0 }, zoom: 1 },
      { pan: { x: 300, y: -90 }, zoom: 1.0000001 },
      viewport,
      0.5,
    )
    expect(Number.isFinite(value.pan.x)).toBe(true)
    expect(Number.isFinite(value.pan.y)).toBe(true)
    expect(Number.isFinite(value.zoom)).toBe(true)
  })

  it('eases gently without making the camera hesitate at either end', () => {
    expect(easeCameraTransition(0)).toBe(0)
    expect(easeCameraTransition(0.1)).toBeGreaterThan(0.02)
    expect(easeCameraTransition(0.1)).toBeLessThan(0.03)
    expect(easeCameraTransition(0.5)).toBeCloseTo(0.5)
    expect(easeCameraTransition(0.9)).toBeGreaterThan(0.97)
    expect(easeCameraTransition(0.9)).toBeLessThan(0.98)
    expect(easeCameraTransition(1)).toBe(1)
  })

  it('starts elapsed time on the first drawable frame', () => {
    const progressAt = createCameraTransitionClock(420)

    // React may occupy the main thread for most of the nominal duration
    // before requestAnimationFrame can draw. That delay must not consume the
    // animation: the first frame is still the exact starting transform.
    expect(progressAt(338)).toBe(0)
    expect(progressAt(548)).toBeCloseTo(0.5)
    expect(progressAt(758)).toBe(1)
  })

  it('keeps the world point beneath a wheel cursor stationary', () => {
    const cursor = { x: 320, y: 240 }
    const next = transformCameraAroundPoint(from, cursor, cursor, 0.8)
    const world = {
      x: (cursor.x - from.pan.x) / from.zoom,
      y: (cursor.y - from.pan.y) / from.zoom,
    }

    expect(next.pan.x + world.x * next.zoom).toBeCloseTo(cursor.x)
    expect(next.pan.y + world.y * next.zoom).toBeCloseTo(cursor.y)
  })

  it('maps the old pinch midpoint directly to the moving midpoint', () => {
    const previousMidpoint = { x: 280, y: 210 }
    const currentMidpoint = { x: 340, y: 250 }
    const next = transformCameraAroundPoint(
      from,
      previousMidpoint,
      currentMidpoint,
      0.75,
    )
    const world = {
      x: (previousMidpoint.x - from.pan.x) / from.zoom,
      y: (previousMidpoint.y - from.pan.y) / from.zoom,
    }

    expect(next.pan.x + world.x * next.zoom).toBeCloseTo(currentMidpoint.x)
    expect(next.pan.y + world.y * next.zoom).toBeCloseTo(currentMidpoint.y)
  })
})

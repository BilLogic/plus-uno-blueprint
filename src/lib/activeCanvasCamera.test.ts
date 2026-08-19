import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  focusActiveCanvasSlide,
  registerActiveCanvasCamera,
} from '@/lib/activeCanvasCamera'

let cleanup: (() => void) | null = null

afterEach(() => {
  cleanup?.()
  cleanup = null
})

describe('active canvas camera ownership', () => {
  it('resolves the current owner and ignores stale cleanup', () => {
    const oldFocus = vi.fn()
    const currentFocus = vi.fn()
    const removeOld = registerActiveCanvasCamera({ focusSlide: oldFocus })
    cleanup = registerActiveCanvasCamera({ focusSlide: currentFocus })

    removeOld()
    focusActiveCanvasSlide('scenario-1')

    expect(oldFocus).not.toHaveBeenCalled()
    expect(currentFocus).toHaveBeenCalledWith('scenario-1')
  })
})

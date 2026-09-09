import { describe, expect, it } from 'vitest'
import {
  deleteCanvasViewStatesForTab,
  readCanvasViewState,
  writeCanvasViewState,
} from '@/lib/canvasViewState'

describe('session canvas view state', () => {
  it('restores isolated transform snapshots for each surface', () => {
    const transform = { pan: { x: 40, y: -25 }, zoom: 0.8 }
    writeCanvasViewState('desktop:slice:one', transform)
    transform.pan.x = 999

    expect(readCanvasViewState('desktop:slice:one')).toEqual({
      pan: { x: 40, y: -25 },
      zoom: 0.8,
    })
  })

  it('discards both surface variants when their tab closes', () => {
    writeCanvasViewState('desktop:slice:closed', {
      pan: { x: 10, y: 20 },
      zoom: 1,
    })
    writeCanvasViewState('mobile:slice:closed', {
      pan: { x: -10, y: -20 },
      zoom: 0.5,
    })

    deleteCanvasViewStatesForTab('slice:closed')

    expect(readCanvasViewState('desktop:slice:closed')).toBeUndefined()
    expect(readCanvasViewState('mobile:slice:closed')).toBeUndefined()
  })
})

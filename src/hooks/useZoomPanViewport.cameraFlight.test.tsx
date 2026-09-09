// @vitest-environment jsdom
/* eslint-disable react-hooks/globals, react-hooks/immutability -- the harness deliberately exposes and stamps an imperative camera surface */
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useZoomPanViewport } from '@/hooks/useZoomPanViewport'
import type { CameraTransitionResult } from '@/lib/cameraTransition'

type Rect = { left: number; top: number; width: number; height: number }

let nextFrameId = 1
let frames = new Map<number, FrameRequestCallback>()

function flushFrame(at: number) {
  const queued = [...frames.values()]
  frames.clear()
  for (const callback of queued) callback(at)
}

function stampBox(
  element: HTMLElement,
  size: { width: number; height: number },
) {
  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: size.width },
    clientHeight: { configurable: true, value: size.height },
    offsetWidth: { configurable: true, value: size.width },
    offsetHeight: { configurable: true, value: size.height },
    scrollWidth: { configurable: true, value: size.width },
    scrollHeight: { configurable: true, value: size.height },
  })
}

function rect(value: Rect): DOMRect {
  return {
    ...value,
    x: value.left,
    y: value.top,
    right: value.left + value.width,
    bottom: value.top + value.height,
    toJSON: () => value,
  }
}

let cameraState: () => {
  moving: boolean
  zoom: number
  pan: { x: number; y: number }
}
let panCamera: (dx: number, dy: number) => void
let refitCamera: () => false | Promise<CameraTransitionResult>

function Harness({
  resetKey,
  target,
  cameraStateKey,
  cameraDestinationKey,
}: {
  resetKey: string
  target: Rect
  cameraStateKey?: string
  cameraDestinationKey?: string
}) {
  const camera = useZoomPanViewport({
    resetKey,
    fitSelector: '[data-target]',
    fitMargin: 0,
    fitTopInset: 0,
    maxFitZoom: 4,
    animateFit: true,
    refitOnResize: false,
    cameraStateKey,
    cameraDestinationKey,
  })
  cameraState = camera.getCameraState
  panCamera = camera.panBy
  refitCamera = () => camera.fitToView({ animate: true })

  return (
    <div
      ref={(node) => {
        if (node) {
          stampBox(node, { width: 1000, height: 600 })
          node.getBoundingClientRect = () => rect({ left: 0, top: 0, width: 1000, height: 600 })
        }
        camera.containerRef(node)
      }}
    >
      <div
        ref={(node) => {
          camera.contentRef.current = node
          if (node) {
            stampBox(node, { width: 1200, height: 600 })
            node.getBoundingClientRect = () => {
              const camera = cameraState()
              return rect({
                left: camera.pan.x,
                top: camera.pan.y,
                width: 1200 * camera.zoom,
                height: 600 * camera.zoom,
              })
            }
          }
        }}
      >
        <div
          data-target=""
          ref={(node) => {
            if (!node) return
            stampBox(node, target)
            node.getBoundingClientRect = () => {
              const camera = cameraState()
              return rect({
                left: camera.pan.x + target.left * camera.zoom,
                top: camera.pan.y + target.top * camera.zoom,
                width: target.width * camera.zoom,
                height: target.height * camera.zoom,
              })
            }
          }}
        />
      </div>
    </div>
  )
}

function FocusHarness({ selected }: { selected: 'a' | 'b' }) {
  const camera = useZoomPanViewport({
    resetKey: selected,
    fitSelector: `[data-focus-slide-id="${selected}"]`,
    fitMargin: 0,
    fitTopInset: 0,
    maxFitZoom: 4,
    animateFit: true,
    refitOnResize: false,
  })
  cameraState = camera.getCameraState

  return (
    <div
      ref={(node) => {
        if (node) stampBox(node, { width: 1000, height: 600 })
        camera.containerRef(node)
      }}
    >
      <div
        ref={(node) => {
          camera.contentRef.current = node
          if (node) {
            stampBox(node, { width: 2000, height: 600 })
            node.getBoundingClientRect = () => {
              const camera = cameraState()
              return rect({
                left: camera.pan.x,
                top: camera.pan.y,
                width: 2000 * camera.zoom,
                height: 600 * camera.zoom,
              })
            }
          }
        }}
      >
        {(['a', 'b'] as const).map((id, index) => (
          <div
            key={id}
            data-focus-slide-id={id}
            data-canvas-focus-dimmed={selected === id ? undefined : ''}
            style={{ opacity: selected === id ? undefined : 0.3 }}
            ref={(node) => {
              if (!node) return
              stampBox(node, { width: 800, height: 500 })
              node.getBoundingClientRect = () => {
                const camera = cameraState()
                return rect({
                  left: camera.pan.x + index * 1000 * camera.zoom,
                  top: camera.pan.y,
                  width: 800 * camera.zoom,
                  height: 500 * camera.zoom,
                })
              }
            }}
          />
        ))}
      </div>
    </div>
  )
}

beforeEach(() => {
  frames = new Map()
  nextFrameId = 1
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextFrameId++
    frames.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('viewport camera flights', () => {
  it('finishes a nearby recenter inside the distance-aware timing floor', () => {
    const view = render(
      <Harness
        resetKey="initial"
        target={{ left: 0, top: 0, width: 1000, height: 600 }}
      />,
    )
    act(() => {
      flushFrame(0)
      flushFrame(16)
    })
    expect(cameraState().moving).toBe(false)

    view.rerender(
      <Harness
        resetKey="nearby"
        target={{ left: 10, top: 0, width: 1000, height: 600 }}
      />,
    )
    act(() => {
      flushFrame(32)
      flushFrame(48)
      flushFrame(64)
    })
    expect(cameraState().moving).toBe(true)

    act(() => flushFrame(364))
    expect(cameraState().moving).toBe(false)
    expect(cameraState().pan.x).toBeCloseTo(-10)
  })

  it('supersedes the active flight as soon as a newer intent is accepted', () => {
    const view = render(
      <Harness
        resetKey="initial"
        target={{ left: 0, top: 0, width: 1000, height: 600 }}
      />,
    )
    act(() => {
      flushFrame(0)
      flushFrame(16)
    })

    view.rerender(
      <Harness
        resetKey="first"
        target={{ left: 800, top: 0, width: 1000, height: 600 }}
      />,
    )
    act(() => {
      flushFrame(32)
      flushFrame(48)
      flushFrame(64)
      flushFrame(164)
    })
    expect(cameraState().moving).toBe(true)

    view.rerender(
      <Harness
        resetKey="second"
        target={{ left: -400, top: 0, width: 1000, height: 600 }}
      />,
    )

    expect(cameraState().moving).toBe(false)
  })

  it('waits for target position as well as target size to settle', () => {
    const target = { left: 0, top: 0, width: 1000, height: 600 }
    const view = render(<Harness resetKey="initial" target={target} />)
    act(() => {
      flushFrame(0)
      flushFrame(16)
    })

    view.rerender(<Harness resetKey="moving" target={target} />)
    act(() => flushFrame(32))
    target.left = 300
    act(() => flushFrame(48))

    expect(cameraState().moving).toBe(false)

    act(() => flushFrame(64))
    expect(cameraState().moving).toBe(true)
  })

  it('retargets a live flight from its current transform without a snap', () => {
    const target = { left: 0, top: 0, width: 1000, height: 600 }
    const view = render(<Harness resetKey="initial" target={target} />)
    act(() => {
      flushFrame(0)
      flushFrame(16)
    })

    target.left = 800
    view.rerender(<Harness resetKey="far" target={target} />)
    act(() => {
      flushFrame(32)
      flushFrame(48)
      flushFrame(64)
      flushFrame(164)
    })
    const beforeRetarget = cameraState().pan.x

    target.left = 400
    act(() => flushFrame(180))
    expect(cameraState().pan.x).toBe(beforeRetarget)
    expect(cameraState().moving).toBe(true)

    act(() => {
      flushFrame(900)
    })
    expect(cameraState().moving).toBe(false)
    expect(cameraState().pan.x).toBeCloseTo(-400)
  })

  it('restores the live transform before a returning canvas schedules a fit', () => {
    const target = { left: 0, top: 0, width: 1000, height: 600 }
    const first = render(
      <Harness
        resetKey="initial"
        target={target}
        cameraStateKey="desktop:slice:camera-flight-test"
        cameraDestinationKey="scenario-a"
      />,
    )
    act(() => {
      flushFrame(0)
      flushFrame(16)
      panCamera(125, -40)
    })
    expect(cameraState().pan).toEqual({ x: 125, y: -40 })
    first.unmount()

    render(
      <Harness
        resetKey="return"
        target={target}
        cameraStateKey="desktop:slice:camera-flight-test"
        cameraDestinationKey="scenario-a"
      />,
    )

    expect(cameraState()).toMatchObject({
      moving: false,
      pan: { x: 125, y: -40 },
      zoom: 1,
    })
    act(() => flushFrame(32))
    expect(cameraState()).toMatchObject({
      moving: false,
      pan: { x: 125, y: -40 },
      zoom: 1,
    })
  })

  it('rejects a stored transform for a different semantic destination', () => {
    const target = { left: 0, top: 0, width: 1000, height: 600 }
    const first = render(
      <Harness
        resetKey="initial"
        target={target}
        cameraStateKey="desktop:slice:destination-test"
        cameraDestinationKey="scenario-a"
      />,
    )
    act(() => {
      flushFrame(0)
      flushFrame(16)
      panCamera(125, -40)
    })
    first.unmount()

    render(
      <Harness
        resetKey="return"
        target={target}
        cameraStateKey="desktop:slice:destination-test"
        cameraDestinationKey="scenario-b"
      />,
    )

    expect(cameraState().pan).toEqual({ x: 0, y: 0 })
    act(() => {
      flushFrame(32)
      flushFrame(48)
    })
    expect(cameraState().pan).toEqual({ x: 0, y: 0 })
  })

  it('rejects a stored transform when the destination geometry changed', () => {
    const target = { left: 0, top: 0, width: 1000, height: 600 }
    const first = render(
      <Harness
        resetKey="initial"
        target={target}
        cameraStateKey="desktop:slice:geometry-test"
        cameraDestinationKey="scenario-a"
      />,
    )
    act(() => {
      flushFrame(0)
      flushFrame(16)
      panCamera(125, -40)
    })
    first.unmount()
    target.left = 250

    render(
      <Harness
        resetKey="return"
        target={target}
        cameraStateKey="desktop:slice:geometry-test"
        cameraDestinationKey="scenario-a"
      />,
    )

    expect(cameraState().pan).toEqual({ x: 0, y: 0 })
  })

  it('keeps a manual pan made while a new destination is still settling', () => {
    const target = { left: 0, top: 0, width: 1000, height: 600 }
    const view = render(<Harness resetKey="initial" target={target} />)
    act(() => {
      flushFrame(0)
      flushFrame(16)
    })

    target.left = 500
    view.rerender(<Harness resetKey="next" target={target} />)
    act(() => panCamera(75, 20))
    act(() => {
      flushFrame(32)
      flushFrame(48)
      flushFrame(64)
    })

    expect(cameraState()).toMatchObject({
      moving: false,
      pan: { x: 75, y: 20 },
    })
  })

  it('reports cancellation to a caller waiting on a camera fit', async () => {
    const target = { left: 0, top: 0, width: 1000, height: 600 }
    render(<Harness resetKey="initial" target={target} />)
    act(() => {
      flushFrame(0)
      flushFrame(16)
    })

    target.left = 600
    const outcome = refitCamera()
    expect(outcome).not.toBe(false)
    act(() => flushFrame(32))
    act(() => panCamera(10, 0))

    await expect(outcome).resolves.toMatchObject({ kind: 'cancelled' })
  })

  it('transfers visible focus using the flight sample instead of a second clock', () => {
    const view = render(<FocusHarness selected="a" />)
    act(() => {
      flushFrame(0)
      flushFrame(16)
    })

    view.rerender(<FocusHarness selected="b" />)
    const focus = (id: string) =>
      view.container.querySelector<HTMLElement>(
        `[data-focus-slide-id="${id}"]`,
      )!
    expect(Number(focus('a').style.opacity)).toBe(1)
    expect(Number(focus('b').style.opacity)).toBeCloseTo(0.3)
    act(() => {
      flushFrame(32)
      flushFrame(48)
      flushFrame(64)
    })
    expect(Number(focus('a').style.opacity)).toBe(1)
    expect(Number(focus('b').style.opacity)).toBeCloseTo(0.3)

    act(() => flushFrame(220))
    const originOpacity = Number(focus('a').style.opacity)
    const destinationOpacity = Number(focus('b').style.opacity)
    expect(originOpacity).toBeGreaterThan(0.3)
    expect(originOpacity).toBeLessThan(1)
    expect(destinationOpacity).toBeGreaterThan(0.3)
    expect(destinationOpacity).toBeLessThan(1)
    expect(originOpacity + destinationOpacity).toBeCloseTo(1.3)

    act(() => flushFrame(800))
    expect(cameraState().moving).toBe(false)
    expect(focus('a').dataset.canvasFocusDimmed).toBe('')
    expect(focus('a').style.opacity).toBe('0.3')
    expect(focus('b').style.opacity).toBe('')
  })

  it('clears the superseded emphasis before transferring the newer intent', () => {
    const view = render(<FocusHarness selected="a" />)
    act(() => {
      flushFrame(0)
      flushFrame(16)
    })

    view.rerender(<FocusHarness selected="b" />)
    act(() => {
      flushFrame(32)
      flushFrame(48)
      flushFrame(64)
      flushFrame(180)
    })
    view.rerender(<FocusHarness selected="a" />)
    act(() => {
      flushFrame(196)
      flushFrame(212)
      flushFrame(228)
    })

    const focus = (id: string) =>
      view.container.querySelector<HTMLElement>(
        `[data-focus-slide-id="${id}"]`,
      )!
    expect(Number(focus('b').style.opacity)).toBe(1)
    expect(Number(focus('a').style.opacity)).toBeCloseTo(0.3)

    act(() => flushFrame(900))
    expect(focus('b').style.opacity).toBe('0.3')
    expect(focus('a').style.opacity).toBe('')
  })
})

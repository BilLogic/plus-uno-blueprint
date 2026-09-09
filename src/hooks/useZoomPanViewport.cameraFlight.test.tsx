// @vitest-environment jsdom
/* eslint-disable react-hooks/globals, react-hooks/immutability -- the harness deliberately exposes and stamps an imperative camera surface */
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useZoomPanViewport } from '@/hooks/useZoomPanViewport'

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
let refitCamera: () => boolean

function Harness({
  resetKey,
  target,
  cameraStateKey,
}: {
  resetKey: string
  target: Rect
  cameraStateKey?: string
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
            node.getBoundingClientRect = () => rect({ left: 0, top: 0, width: 1200, height: 600 })
          }
        }}
      >
        <div
          data-target=""
          ref={(node) => {
            if (!node) return
            stampBox(node, target)
            node.getBoundingClientRect = () => rect(target)
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
            node.getBoundingClientRect = () =>
              rect({ left: 0, top: 0, width: 2000, height: 600 })
          }
        }}
      >
        {(['a', 'b'] as const).map((id, index) => (
          <div
            key={id}
            data-focus-slide-id={id}
            style={{ opacity: selected === id ? 1 : 0.3 }}
            ref={(node) => {
              if (!node) return
              stampBox(node, { width: 800, height: 500 })
              node.getBoundingClientRect = () =>
                rect({
                  left: index * 1000,
                  top: 0,
                  width: 800,
                  height: 500,
                })
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
    act(() => {
      expect(refitCamera()).toBe(true)
    })
    expect(cameraState().pan.x).toBe(beforeRetarget)
    expect(cameraState().moving).toBe(true)

    act(() => {
      flushFrame(180)
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

  it('transfers visible focus using the flight sample instead of a second clock', () => {
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
    })
    const focus = (id: string) =>
      view.container.querySelector<HTMLElement>(
        `[data-focus-slide-id="${id}"]`,
      )!
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
    expect(focus('a').style.opacity).toBe('0.3')
    expect(focus('b').style.opacity).toBe('1')
  })
})

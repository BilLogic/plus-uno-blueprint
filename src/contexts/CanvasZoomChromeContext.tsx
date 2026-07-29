import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type CanvasZoomChromeState = {
  onResetView?: () => void
}

type CanvasZoomChromeContextValue = {
  chrome: CanvasZoomChromeState | null
  setChrome: (next: CanvasZoomChromeState | null) => void
}

const CanvasZoomChromeContext =
  createContext<CanvasZoomChromeContextValue | null>(null)

export function CanvasZoomChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChromeState] = useState<CanvasZoomChromeState | null>(null)
  const setChrome = useCallback((next: CanvasZoomChromeState | null) => {
    setChromeState(next)
  }, [])

  const value = useMemo(
    () => ({ chrome, setChrome }),
    [chrome, setChrome],
  )

  return (
    <CanvasZoomChromeContext.Provider value={value}>
      {children}
    </CanvasZoomChromeContext.Provider>
  )
}

export function useCanvasZoomChrome() {
  return useContext(CanvasZoomChromeContext)
}

/** Publishes reset-view chrome from the active viewport; clears on unmount. */
export function usePublishCanvasZoomChrome(onResetView?: () => void) {
  const ctx = useContext(CanvasZoomChromeContext)

  useEffect(() => {
    if (!ctx) return
    ctx.setChrome({ onResetView })
    return () => ctx.setChrome(null)
  }, [ctx, onResetView])
}

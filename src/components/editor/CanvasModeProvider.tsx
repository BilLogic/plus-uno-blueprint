import { useMemo, useState, type ReactNode } from 'react'
import {
  CanvasModeContext,
  type CanvasMode,
} from '@/contexts/canvasModeContext'
import { useSupabase } from '@/contexts/SupabaseProvider'

/**
 * Holds one canvas surface's mode.
 *
 * Mounted per viewport rather than once at the shell, so the base canvas and
 * each slice tab keep their own. Deliberately not in the URL: mode is a
 * working state, not a destination, and a shared link should open in View —
 * the reader's mode — whatever the sender was doing.
 */
export function CanvasModeProvider({ children }: { children: ReactNode }) {
  const { canWrite } = useSupabase()
  const [mode, setMode] = useState<CanvasMode>('view')

  const value = useMemo(
    () => ({
      // Without write access there is no design mode to be in — falling back
      // to `view` means a session that loses access mid-edit degrades to
      // reading rather than to a broken editor.
      mode: canWrite ? mode : ('view' as CanvasMode),
      setMode,
      available: canWrite,
    }),
    [canWrite, mode],
  )

  return (
    <CanvasModeContext.Provider value={value}>
      {children}
    </CanvasModeContext.Provider>
  )
}

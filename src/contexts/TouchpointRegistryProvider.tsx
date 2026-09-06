import { useEffect, type ReactNode } from 'react'
import { TOUCHPOINT_REGISTRY_FALLBACK } from '@/data/touchpointRegistryFallback'
import { useTouchpointRegistryTones } from '@/hooks/useTouchpointRegistryTones'
import { setTouchpointRegistry } from '@/lib/touchpointColors'

/**
 * Reads the touchpoint registry once and publishes it to the tone store.
 *
 * Mounted high enough to cover the canvas, the compare grid and the detail
 * panel, the way `EntityExamplesProvider` covers every definition popover.
 *
 * It provides no context, and that is the point rather than an oversight. The
 * component that has to answer "what colour is this touchpoint" is
 * `TouchpointCellFace`, which is the template's file byte for byte
 * (`scripts/reconciled-files.mjs`) and takes a label and nothing else. A
 * context value cannot reach it without forking it. So the values go to the
 * module store in `touchpointColors.ts` — ADR 0005's second condition, state
 * non-React code must read — and the cells subscribe to that store through
 * `useTouchpointToneResolver`, which is what re-renders them when this
 * publishes.
 *
 * While the read is in flight the fixture answers, so a board never draws one
 * frame in hashed colours and the next frame in chosen ones. In this
 * deployment the two agree, so the swap is invisible; in one where they do not,
 * the fixture is only ever a first guess and the rows always win.
 */
export function TouchpointRegistryProvider({
  children,
}: {
  children: ReactNode
}) {
  const result = useTouchpointRegistryTones()
  // An EMPTY catalog is not an answer about colour, it is the absence of one,
  // and it gets the same treatment as no database at all. That is not a
  // hypothetical: `supabase/seed.sql` deliberately stands up no `touchpoints`
  // rows — its placements are all name-only — so a locally seeded board reads
  // zero rows back and would otherwise repaint every touchpoint in a hashed
  // colour. A deployment that has a catalog always wins over the fixture.
  const entries =
    result.status === 'ready' && result.data.length > 0
      ? result.data
      : TOUCHPOINT_REGISTRY_FALLBACK

  // In an effect, not the render body: publishing is a write to shared state,
  // and a concurrent render that React throws away must not leave this
  // deployment's colours installed from a pass nobody committed. `entries` is
  // referentially stable per query result, so this runs once per answer, and
  // `setTouchpointRegistry` is a no-op when the rows say what the store
  // already holds.
  useEffect(() => {
    setTouchpointRegistry(entries)
  }, [entries])

  return <>{children}</>
}

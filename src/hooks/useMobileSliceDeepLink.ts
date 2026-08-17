import { useEffect, useState } from 'react'
import { useViewState } from '@/contexts/viewStateStore'
import type { Slice } from '@/types/database'

/**
 * ?slice= deep links on the phone (uno-bot shares them into Slack, which
 * mostly opens on phones). Desktop resolves these in TabStrip; the mobile
 * shell never mounts it, so this hook resolves them there: present the slice
 * if it exists, otherwise the pending state just clears and the reader shows.
 *
 * Extracted from MobileShell as a Phase-2 seam (plan 2026-08-16-002).
 * Known defect carried over deliberately — the boot presentation is derived
 * from the live slices query, so it can appear late on a slow network and
 * vanish on a failed refetch (todo 025). Phase 4 replaces this whole hook
 * with the view-state store as the single source of truth; pinning the
 * current behaviour is this extraction's job, fixing it is not.
 */
export function useMobileSliceDeepLink(
  slices: Slice[],
  slicesLoading: boolean,
): {
  /** The slice currently presenting full-bleed, from tap or boot link. */
  activeSliceId: string | null
  /** Present a slice the user tapped (nav sheet). */
  presentSlice: (sliceId: string) => void
  /** Dismiss whatever is presenting, boot link included. */
  dismissSlice: () => void
} {
  const { pendingUrlState, resolvePending } = useViewState()
  const [presentingSliceId, setPresentingSliceId] = useState<string | null>(
    null,
  )
  const [bootSliceId] = useState(() =>
    pendingUrlState !== null && pendingUrlState.kind !== 'blueprint'
      ? pendingUrlState.sliceId
      : null,
  )
  const [bootSliceDismissed, setBootSliceDismissed] = useState(false)

  useEffect(() => {
    if (pendingUrlState === null) return
    if (slicesLoading) return
    resolvePending(slices.map((slice) => slice.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `slices` is derived from the query each render; keying on the loading flag avoids re-running on referentially fresh arrays
  }, [pendingUrlState, resolvePending, slicesLoading])

  const bootPresentingId = resolveBootSlice({
    bootSliceId,
    bootSliceDismissed,
    presentingSliceId,
    sliceIds: slices.map((slice) => slice.id),
  })

  return {
    activeSliceId: presentingSliceId ?? bootPresentingId,
    presentSlice: setPresentingSliceId,
    dismissSlice: () => {
      setPresentingSliceId(null)
      setBootSliceDismissed(true)
    },
  }
}

/**
 * The boot-link decision, pure so it can be pinned by a unit test: the boot
 * slice presents only while nothing else presents, it has not been
 * dismissed, and it actually exists in the loaded slice list.
 */
export function resolveBootSlice({
  bootSliceId,
  bootSliceDismissed,
  presentingSliceId,
  sliceIds,
}: {
  bootSliceId: string | null
  bootSliceDismissed: boolean
  presentingSliceId: string | null
  sliceIds: string[]
}): string | null {
  if (bootSliceDismissed) return null
  if (presentingSliceId !== null) return null
  if (bootSliceId === null) return null
  return sliceIds.includes(bootSliceId) ? bootSliceId : null
}

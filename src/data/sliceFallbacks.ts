/**
 * The offline slices registry, with nothing registered — the counterpart to
 * `blueprintFallbacks.ts`, and empty for the same reason. This deployment's
 * slices are rows; a database read always wins over this module, and there is
 * nothing here for it to win over.
 */
import type { Slice, Slide } from '@/types/database'

export const FALLBACK_SLICES: Slice[] = []

export const FALLBACK_SLICE_ITEMS: Record<string, Slide[]> = {}

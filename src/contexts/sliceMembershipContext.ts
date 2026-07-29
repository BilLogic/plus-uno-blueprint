import { createContext, useContext } from 'react'

/**
 * Cell ids belonging to the open slice (raw + resolved forms). Provided by
 * SliceView around its grid; BlueprintCellButton reads it to set the
 * `data-slice-member` attribute without restructuring the grid tree.
 */
export const SliceMembershipContext = createContext<ReadonlySet<string> | null>(
  null,
)

export function useSliceMembership(): ReadonlySet<string> | null {
  return useContext(SliceMembershipContext)
}

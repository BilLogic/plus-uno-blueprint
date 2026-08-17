import { ChevronRight, Link2 } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { STEP_COLUMN_GAP } from '@/lib/blueprintLayout'
import type { CompareGridTrack } from '@/lib/compareGridTracks'
import { cn } from '@/lib/utils'

/**
 * The chrome that belongs to the compare column AXIS rather than to any one
 * path: the step-name header row, the divergent-column tint, and the folded
 * pleat. Both compare canvases (stacked bands, merged grid) draw the same
 * axis, so they draw it with the same components.
 */

/** Step names above the canvas; divergent columns carry the header tint. */
export function CompareStepHeaderRow({
  tracks,
  showPinGlyph,
  diffTint = true,
}: {
  tracks: readonly CompareGridTrack[]
  /** The `🔗 pinned` explainer only means anything while the fold is on. */
  showPinGlyph: boolean
  /**
   * Stacked marks divergent columns with a header tint. Merged turns it
   * off: there divergence is already said twice (sub-cell stacking, path
   * wash), and with most columns divergent the tinted header read as a
   * wall of noise paint.
   */
  diffTint?: boolean
}) {
  return (
    <>
      {tracks.map((track, trackIndex) =>
        track.kind === 'pleat' ? null : (
          <div
            key={track.key}
            // `relative z-[1]`: when a path frame extends up to wrap this
            // row (single-path stacked, merged), the frame's opaque fill is
            // an absolutely-positioned later sibling — without a stacking
            // order the labels paint UNDER it and the header "vanishes".
            className="relative z-[1] flex min-w-0 items-end justify-center gap-1 overflow-hidden rounded-md px-2 pb-1.5"
            style={{ gridColumn: trackIndex + 2, gridRow: 1 }}
            {...(diffTint && track.divergent
              ? { 'data-blueprint-compare-diffcolumn': 'header' }
              : {})}
          >
            <span
              className="truncate text-xs font-medium text-muted-foreground"
              title={track.label}
            >
              {track.label}
            </span>
            {track.pinned && showPinGlyph ? (
              <Tooltip>
                <TooltipTrigger
                  render={<span className="inline-flex shrink-0 pb-px" />}
                >
                  <Link2
                    className="size-3 text-muted-foreground"
                    aria-label="Pinned column"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  kept expanded — feeds a divergent step
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        ),
      )}
    </>
  )
}

/**
 * The v3 diff signal on the canvas: a light tint over the full height of a
 * divergent column. Column-level by design — cells themselves never carry
 * paint. `relative` so the tint paints above the absolutely-positioned
 * section frame while staying under the z-[1] cells.
 */
export function CompareDiffColumnTint({
  gridColumn,
}: {
  gridColumn: number
}) {
  return (
    <div
      aria-hidden
      data-blueprint-compare-diffcolumn=""
      className="pointer-events-none relative rounded-md"
      style={{
        gridColumn,
        gridRow: '1 / -1',
        marginLeft: -STEP_COLUMN_GAP / 2,
        marginRight: -STEP_COLUMN_GAP / 2,
      }}
    />
  )
}

/**
 * One collapsed pleat, full band height — flat `--muted` with a single 1px
 * center crease (rib texture deliberately cut: it moirés under zoom),
 * chevron + mono count at the top, step range in the tooltip. Clicking
 * expands the pleat (adds it to the shared fold state's expandedPleats).
 *
 * The track-width change it triggers is INSTANT — `gridTemplateColumns`
 * is never animated (a full-subgrid relayout per frame, with arrows drawn
 * against intermediate geometry); only this cell's own chevron/opacity
 * may transition, on `--motion-micro`, and reduced motion drops even that.
 */
export function ComparePleatCell({
  track,
  gridColumn,
  onExpand,
}: {
  track: Extract<CompareGridTrack, { kind: 'pleat' }>
  gridColumn: number
  onExpand?: (pleatKey: string) => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-compare-pleat={track.key}
            aria-expanded={false}
            aria-label={`${track.title} — expand`}
            onClick={() => onExpand?.(track.key)}
            className={cn(
              'group/pleat relative z-[1] flex flex-col items-center gap-1 overflow-hidden rounded-md bg-muted pt-2',
              'text-muted-foreground hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            )}
            style={{ gridColumn, gridRow: '1 / -1' }}
          />
        }
      >
        <span
          aria-hidden
          className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-border"
        />
        <ChevronRight
          aria-hidden
          className="relative size-3 shrink-0 opacity-70 transition-opacity duration-(--motion-micro) group-hover/pleat:opacity-100 motion-reduce:transition-none"
        />
        <span className="relative shrink-0 font-mono text-2xs tabular-nums">
          {track.columnCount}
        </span>
      </TooltipTrigger>
      <TooltipContent>{track.title}</TooltipContent>
    </Tooltip>
  )
}

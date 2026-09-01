import { Info } from 'lucide-react'
import { EntityDefinitionPopover } from '@/components/blueprint/EntityDefinitionPopover'
import { useBlueprintCellDetailOptional } from '@/contexts/BlueprintCellDetailContext'
import { useScenarioBoardInScope } from '@/contexts/scenarioBoardScopeContext'
import { useEntityDetail } from '@/contexts/EntityDetailContext'
import {
  CANVAS_HEADER_BOX,
  CANVAS_HEADER_HINT,
  CANVAS_HEADER_NAME,
  CANVAS_HEADER_OPENER,
  CANVAS_HEADER_STATE,
  CANVAS_HEADER_TEXT,
} from '@/lib/canvasHeaderStyle'
import { cn } from '@/lib/utils'

/**
 * The step column header: the name, what a step IS, and the way into it.
 *
 * Same treatment as the lane's row header — same size, weight, radius,
 * padding, states and the same two targets — and centred rather than top-left,
 * because that is what a column label is. See `LaneHeaderAffordance` for why
 * the block holds a name that explains itself and an opener that fills the
 * rest of it.
 *
 * The ⓘ is positioned rather than laid out: an icon in the flex row shifts the
 * label off the column's centre by half its width. Out of flow, the label
 * stays centred over the cells it names and the hint sits at the box's right
 * edge.
 */
export function StepHeaderAffordance({
  stepId,
  name,
  className,
  style,
}: {
  stepId: string
  name: string
  className?: string
  style?: React.CSSProperties
}) {
  const { toggleEntity, selection } = useEntityDetail()
  const detail = useBlueprintCellDetailOptional()
  const boardInScope = useScenarioBoardInScope()
  /*
    Both halves, exactly as the lane header takes them — see the long note
    there. The provider flag alone left 125 step headers live across every
    mounted board, so a column on a scenario the reader had not chosen opened
    a panel with nothing in it. The board's own scope is what says this is the
    board they are looking at.
  */
  const isInteractive = Boolean(detail?.enabled) && boardInScope
  const open = selection?.kind === 'step' && selection.id === stepId

  // The definition rides on the word whether the panel is reachable or not —
  // "what is a step?" is not a question about which board is in scope.
  const label = (
    <EntityDefinitionPopover kind="step" side="top">
      <span
        className={cn(
          'min-w-0 truncate text-center text-muted-foreground',
          CANVAS_HEADER_TEXT,
          CANVAS_HEADER_NAME,
        )}
      >
        {name}
      </span>
    </EntityDefinitionPopover>
  )

  // Inert prose, not a disabled button — see LaneHeaderAffordance.
  if (!isInteractive) {
    return (
      <div
        data-blueprint-column-header=""
        style={style}
        className={cn(
          'group/step-header relative flex h-full min-w-0 items-center justify-center',
          CANVAS_HEADER_BOX,
          className,
        )}
      >
        {label}
      </div>
    )
  }

  return (
    <div
      data-blueprint-column-header=""
      data-open={open ? '' : undefined}
      style={style}
      className={cn(
        'group/step-header relative flex h-full min-w-0 items-center justify-center',
        CANVAS_HEADER_BOX,
        CANVAS_HEADER_STATE,
        className,
      )}
    >
      <button
        type="button"
        data-step-header-affordance=""
        aria-label={`View details: ${name}`}
        aria-pressed={open}
        onClick={(event) => {
          event.stopPropagation()
          toggleEntity({ kind: 'step', id: stepId })
        }}
        className={CANVAS_HEADER_OPENER}
      />
      {label}
      <Info
        className={cn(
          CANVAS_HEADER_HINT,
          'pointer-events-none absolute right-1.5 top-1/2 z-10 -translate-y-1/2',
          'group-hover/step-header:text-foreground',
        )}
        aria-hidden
      />
    </div>
  )
}

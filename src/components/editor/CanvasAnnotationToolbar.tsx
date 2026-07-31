import { useEffect, useState } from 'react'
import {
  Circle,
  Eraser,
  MousePointer2,
  Pencil,
  Square,
  StickyNote,
  Trash2,
  Type,
  SquarePen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCanvasAnnotations } from '@/contexts/canvasAnnotationContext'
import { CanvasDesignTools } from '@/components/editor/CanvasDesignTools'
import { useCanvasMode } from '@/contexts/canvasModeContext'
import {
  ANNOTATION_PEN_STROKE_WIDTHS,
  ANNOTATION_PEN_SWATCHES,
  type CanvasAnnotationTool,
} from '@/lib/canvasAnnotations'
import { cn } from '@/lib/utils'

type ToolDef = {
  id: CanvasAnnotationTool
  label: string
  icon: typeof Pencil
}

type DrawTool = 'pen' | 'eraser'

const SHAPE_TOOLS: ToolDef[] = [
  { id: 'rect', label: 'Rectangle', icon: Square },
  { id: 'ellipse', label: 'Ellipse', icon: Circle },
]

const CONTENT_TOOLS: ToolDef[] = [
  { id: 'text', label: 'Text', icon: Type },
  { id: 'sticky', label: 'Sticky note', icon: StickyNote },
]

const DRAW_SUBPANEL_TOOLS: ToolDef[] = [
  { id: 'pen', label: 'Pen', icon: Pencil },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
]

function ToolButton({
  id,
  label,
  icon: Icon,
  active,
  onSelect,
  className,
}: ToolDef & {
  active: boolean
  onSelect: (id: CanvasAnnotationTool) => void
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={label}
            aria-pressed={active}
            onClick={() => onSelect(id)}
            className={cn(
              'pointer-events-auto size-7 shrink-0 p-0 text-muted-foreground hover:text-foreground',
              active && 'bg-muted text-foreground',
              className,
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </Button>
        }
      />
      <TooltipContent side="top" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function ToolbarDivider() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-border/80" aria-hidden />
}

function StrokeWeightButton({
  width,
  selected,
  onSelect,
}: {
  width: number
  selected: boolean
  onSelect: () => void
}) {
  const label = width <= 6 ? 'Thin' : 'Thick'
  const previewWidth = width <= 6 ? 1.5 : 4.5
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-pressed={selected}
            onClick={(event) => {
              event.stopPropagation()
              onSelect()
            }}
            className={cn(
              'pointer-events-auto flex size-7 items-center justify-center rounded-md transition-colors',
              selected
                ? 'bg-violet-100 text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <svg viewBox="0 0 20 12" className="h-3.5 w-4" aria-hidden>
              <path
                d="M1 8.5 C4 2.5, 7 10.5, 10 5.5 S16 9, 19 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={previewWidth}
                strokeLinecap="round"
              />
            </svg>
          </button>
        }
      />
      <TooltipContent side="top" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function DrawSubpanel() {
  const {
    tool,
    setTool,
    penColor,
    setPenColor,
    penStrokeWidth,
    setPenStrokeWidth,
  } = useCanvasAnnotations()

  const penActive = tool === 'pen'
  const penOptionsDisabled = !penActive

  return (
    <div
      data-annotation-toolbar=""
      role="toolbar"
      aria-label="Pen and eraser options"
      className="pointer-events-none flex items-center gap-0.5 rounded-full border border-border/70 bg-card px-1.5 py-1 shadow-md"
    >
      {DRAW_SUBPANEL_TOOLS.map((item) => (
        <ToolButton
          key={item.id}
          {...item}
          active={tool === item.id}
          onSelect={setTool}
          className={cn(
            tool === item.id &&
              'bg-violet-100 text-foreground hover:bg-violet-100 hover:text-foreground',
          )}
        />
      ))}

      <ToolbarDivider />
      <div
        role="group"
        aria-label="Stroke weight"
        aria-disabled={penOptionsDisabled}
        className={cn(
          'pointer-events-auto flex items-center gap-0.5',
          penOptionsDisabled && 'pointer-events-none opacity-35',
        )}
      >
        {ANNOTATION_PEN_STROKE_WIDTHS.map((width) => (
          <StrokeWeightButton
            key={width}
            width={width}
            selected={penStrokeWidth === width}
            onSelect={() => setPenStrokeWidth(width)}
          />
        ))}
      </div>

      <ToolbarDivider />
      <div
        role="group"
        aria-label="Pen color"
        aria-disabled={penOptionsDisabled}
        className={cn(
          'pointer-events-auto flex items-center gap-1 px-1',
          penOptionsDisabled && 'pointer-events-none opacity-35',
        )}
      >
        {ANNOTATION_PEN_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={`Pen color ${swatch}`}
            aria-pressed={penColor.toUpperCase() === swatch.toUpperCase()}
            disabled={penOptionsDisabled}
            title={swatch}
            onClick={() => setPenColor(swatch)}
            className={cn(
              'size-4 shrink-0 rounded-full border border-black/10 transition-transform hover:scale-110',
              penColor.toUpperCase() === swatch.toUpperCase() &&
                !penOptionsDisabled &&
                'ring-2 ring-violet-400 ring-offset-1',
              swatch.toUpperCase() === '#FFFFFF' && 'border-border',
            )}
            style={{ backgroundColor: swatch }}
          />
        ))}
      </div>
    </div>
  )
}

export function CanvasAnnotationToolbar() {
  const { tool, setTool, annotations, clearAnnotations } =
    useCanvasAnnotations()

  const [lastDrawTool, setLastDrawTool] = useState<DrawTool>('pen')
  const drawActive = tool === 'pen' || tool === 'eraser'
  const mainDrawTool: DrawTool = drawActive ? tool : lastDrawTool
  const MainDrawIcon = mainDrawTool === 'eraser' ? Eraser : Pencil
  const mainDrawLabel = mainDrawTool === 'eraser' ? 'Eraser' : 'Draw'

  useEffect(() => {
    if (tool === 'pen' || tool === 'eraser') {
      setLastDrawTool(tool)
    }
  }, [tool])

  const canvasMode = useCanvasMode()
  const designing = canvasMode?.mode === 'design'

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
      {drawActive && !designing ? <DrawSubpanel /> : null}

      <div
        data-annotation-toolbar=""
        className="flex items-center gap-0.5 rounded-full border border-border/70 bg-card/95 px-1.5 py-1 shadow-md backdrop-blur-sm"
      >
        {/* Select holds the first slot in both modes — the one tool that means
            "do nothing special" should never move under the cursor. */}
        <ToolButton
          id="select"
          label={designing ? 'Select' : 'Select / pan'}
          icon={MousePointer2}
          active={tool === 'select'}
          onSelect={setTool}
        />

        <>

        {/* Single draw slot — swaps to eraser icon when eraser is active (FigJam). */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={mainDrawLabel}
                aria-pressed={drawActive}
                onClick={() => setTool(mainDrawTool)}
                className={cn(
                  'pointer-events-auto size-7 shrink-0 p-0 text-muted-foreground hover:text-foreground',
                  drawActive &&
                    'bg-violet-100 text-foreground hover:bg-violet-100 hover:text-foreground',
                )}
              >
                <MainDrawIcon
                  className={cn('size-3.5', drawActive && 'size-4')}
                  aria-hidden
                />
              </Button>
            }
          />
          <TooltipContent side="top" className="text-xs">
            {mainDrawLabel}
          </TooltipContent>
        </Tooltip>

        <ToolbarDivider />

        <div
          role="group"
          aria-label="Shapes"
          className="flex items-center gap-0.5"
        >
          {SHAPE_TOOLS.map((item) => (
            <ToolButton
              key={item.id}
              {...item}
              active={tool === item.id}
              onSelect={setTool}
            />
          ))}
        </div>

        <ToolbarDivider />

        {CONTENT_TOOLS.map((item) => (
          <ToolButton
            key={item.id}
            {...item}
            active={tool === item.id}
            onSelect={setTool}
          />
        ))}

        <ToolbarDivider />

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Clear annotations"
                disabled={annotations.length === 0}
                onClick={clearAnnotations}
                className="pointer-events-auto size-7 shrink-0 p-0 text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            }
          />
          <TooltipContent side="top" className="text-xs">
            Clear annotations
          </TooltipContent>
        </Tooltip>
        </>

        {designing ? (
          <>
            <ToolbarDivider />
            <CanvasDesignTools />
          </>
        ) : null}

        {/* Edit is not a tool, so it sits after a divider at the far end
            rather than in the tool run — and it is absent, never disabled,
            for sessions that cannot write. */}
        {canvasMode?.available ? (
          <>
            <ToolbarDivider />
            <CanvasEditToggle
              editing={designing}
              onChange={(next) => canvasMode.setMode(next ? 'design' : 'view')}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Edit: on or off.
 *
 * This was two segments, "view" and "design", on the reasoning that the
 * current mode has to be readable at a glance and a single button only ever
 * shows the mode you are *not* in. That reasoning holds for a mode picker and
 * this is not one: there is nothing to switch *between*, only a capability
 * that is on or off. The tools to its left already say what a click does.
 *
 * Pressed state is a filled pill rather than a shade of grey, because at the
 * far end of a bar this is the one control that has to read without being
 * looked for.
 */
function CanvasEditToggle({
  editing,
  onChange,
}: {
  editing: boolean
  onChange: (editing: boolean) => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={editing}
            aria-label={editing ? 'Turn off editing' : 'Turn on editing'}
            onClick={() => onChange(!editing)}
            className={cn(
              'pointer-events-auto h-7 shrink-0 gap-1.5 rounded-full px-2.5 text-xs',
              editing
                ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <SquarePen className="size-3.5" aria-hidden />
            Edit
          </Button>
        }
      />
      <TooltipContent side="top" className="text-xs">
        {editing
          ? 'Editing on — cells are selectable and handles are shown'
          : 'Turn on editing to change the blueprint'}
      </TooltipContent>
    </Tooltip>
  )
}

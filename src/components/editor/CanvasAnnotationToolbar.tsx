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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCanvasAnnotations } from '@/contexts/canvasAnnotationContext'
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
                ? 'bg-primary/15 text-foreground'
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
              'bg-primary/15 text-foreground hover:bg-primary/15 hover:text-foreground',
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
              'tap-target-24 size-4 shrink-0 rounded-full border border-black/10 transition-transform hover:scale-110',
              penColor.toUpperCase() === swatch.toUpperCase() &&
                !penOptionsDisabled &&
                'ring-2 ring-primary ring-offset-1',
              swatch.toUpperCase() === '#FFFFFF' && 'border-border',
            )}
            style={{ backgroundColor: swatch }}
          />
        ))}
      </div>
    </div>
  )
}

/** Floating tool palette for the annotation layer — tool, stroke weight, colour, clear. */
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

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
      {drawActive ? <DrawSubpanel /> : null}

      <div
        data-annotation-toolbar=""
        className="flex items-center gap-0.5 rounded-full border border-border/70 bg-card/95 px-1.5 py-1 shadow-md backdrop-blur-sm"
      >
        <ToolButton
          id="select"
          label="Select / pan"
          icon={MousePointer2}
          active={tool === 'select'}
          onSelect={setTool}
        />

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
                    'bg-primary/15 text-foreground hover:bg-primary/15 hover:text-foreground',
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
      </div>
    </div>
  )
}

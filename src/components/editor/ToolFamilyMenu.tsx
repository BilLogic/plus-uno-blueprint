import { ChevronDown, Check, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { CanvasAnnotationTool } from '@/lib/canvasAnnotations'

export type FamilyTool = {
  id: CanvasAnnotationTool
  label: string
  icon: LucideIcon
}

/**
 * One slot for a family of related tools — Draw, Shapes, Content.
 *
 * Two targets in one control, which is Figma's shape menu exactly: the icon
 * activates the family's *current* tool, the chevron opens the list, and
 * whatever you pick becomes the face. A family therefore costs one slot rather
 * than four, and the bar stops being a row of near-identical squares that has
 * to be read left to right before anything can be clicked.
 *
 * The face remembering the last choice is what makes the second use cheap:
 * having drawn one ellipse, the next one is a single click on the same pixel.
 */
export function ToolFamilyMenu({
  label,
  tools,
  active,
  onSelect,
}: {
  label: string
  tools: FamilyTool[]
  /** The whole toolbar's current tool; may belong to another family. */
  active: CanvasAnnotationTool
  onSelect: (tool: CanvasAnnotationTool) => void
}) {
  const inFamily = tools.some((tool) => tool.id === active)
  // The face is the family's active tool, or the last one used in it. Falling
  // back to the first entry keeps the slot from ever rendering empty.
  const face = tools.find((tool) => tool.id === active) ?? tools[0]
  const FaceIcon = face.icon

  return (
    <div
      className={cn(
        'pointer-events-auto flex shrink-0 items-center rounded-md',
        inFamily && 'bg-violet-100',
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={face.label}
              aria-pressed={inFamily}
              onClick={() => onSelect(face.id)}
              className={cn(
                'size-7 shrink-0 rounded-r-none p-0 text-muted-foreground hover:text-foreground',
                inFamily && 'text-foreground hover:bg-violet-100',
              )}
            >
              <FaceIcon className={cn('size-3.5', inFamily && 'size-4')} aria-hidden />
            </Button>
          }
        />
        <TooltipContent side="top" className="text-xs">
          {face.label}
        </TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`${label} tools`}
              className={cn(
                'h-7 w-4 shrink-0 rounded-l-none px-0 text-muted-foreground hover:text-foreground',
                inFamily && 'text-foreground hover:bg-violet-100',
              )}
            >
              <ChevronDown className="size-3" aria-hidden />
            </Button>
          }
        />
        <DropdownMenuContent align="center" side="top" className="min-w-40 text-xs">
          {tools.map((tool) => {
            const Icon = tool.icon
            return (
              <DropdownMenuItem key={tool.id} onClick={() => onSelect(tool.id)}>
                <Check
                  className={cn('size-3', tool.id !== active && 'invisible')}
                  aria-hidden
                />
                <Icon className="size-3.5" aria-hidden />
                {tool.label}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

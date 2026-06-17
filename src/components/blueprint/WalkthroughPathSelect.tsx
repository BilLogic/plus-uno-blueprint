import { ChevronDown } from 'lucide-react'
import { PathDescriptionTooltip } from '@/components/blueprint/PathDescriptionTooltip'
import { PathLabelBadge } from '@/components/blueprint/PathLabelBadge'
import { PathTypeColorKey } from '@/components/blueprint/PathTypeColorKey'
import { formatPathPickerLabel } from '@/components/blueprint/PathMultiSelect'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PATH_TYPE_BADGE_CLASSES } from '@/lib/pathTypeTheme'
import { cn } from '@/lib/utils'
import type { BlueprintData } from '@/types/blueprint'

type WalkthroughPathSelectProps = {
  blueprints: BlueprintData[]
  value: string
  onChange: (pathId: string) => void
  className?: string
}

export function WalkthroughPathSelect({
  blueprints,
  value,
  onChange,
  className,
}: WalkthroughPathSelectProps) {
  const selected = blueprints.find((blueprint) => blueprint.path.id === value)

  if (!selected) return null

  if (blueprints.length <= 1) {
    return (
      <PathLabelBadge
        name={selected.path.name}
        description={selected.path.description}
        pathType={selected.path.path_type}
        compact
        className={className}
      />
    )
  }

  const selectedLabel = formatPathPickerLabel(selected.path.name)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex h-auto max-w-full cursor-pointer items-center gap-1.5 rounded-full border-0 px-2.5 py-1 text-xs font-semibold outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/50',
          PATH_TYPE_BADGE_CLASSES[selected.path.path_type],
          className,
        )}
        aria-label={`Path: ${selectedLabel}. Choose a different path.`}
      >
        <PathTypeColorKey type={selected.path.path_type} />
        <span className="truncate leading-none tracking-tight">{selectedLabel}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(nextValue) => {
            if (nextValue) onChange(nextValue)
          }}
        >
          {blueprints.map((blueprint) => {
            const label = formatPathPickerLabel(blueprint.path.name)
            return (
              <DropdownMenuRadioItem
                key={blueprint.path.id}
                value={blueprint.path.id}
              >
                <PathTypeColorKey type={blueprint.path.path_type} />
                <PathDescriptionTooltip
                  description={blueprint.path.description}
                  pathName={blueprint.path.name}
                  side="right"
                >
                  <span className="truncate">{label}</span>
                </PathDescriptionTooltip>
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

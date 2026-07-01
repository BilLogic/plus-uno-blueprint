import { PathDescriptionTooltip } from '@/components/blueprint/PathDescriptionTooltip'
import { PathTypeColorKey } from '@/components/blueprint/PathTypeColorKey'
import {
  formatPathPickerLabel,
  type PathOption,
} from '@/components/blueprint/PathMultiSelect'
import {
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarTrigger,
} from '@/components/ui/menubar'
import {
  SCENARIO_VIEW_TYPE_OPTIONS,
  SLIDE_VIEW_TYPE_LABELS,
  type SlideViewType,
} from '@/types/slides'

type StackHeaderFilterMenuProps = {
  viewType: SlideViewType
  onViewTypeChange: (viewType: SlideViewType) => void
  paths: PathOption[]
  selectedPathIds: string[]
  onTogglePath: (pathId: string) => void
}

/** View and path filters as menubar menus — must be rendered inside `Menubar`. */
export function StackHeaderFilterMenu({
  viewType,
  onViewTypeChange,
  paths,
  selectedPathIds,
  onTogglePath,
}: StackHeaderFilterMenuProps) {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-0.5">
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent align="end">
          <MenubarGroup>
            <MenubarLabel>View type</MenubarLabel>
            <MenubarRadioGroup
              value={viewType}
              onValueChange={(value) =>
                onViewTypeChange(value as SlideViewType)
              }
            >
              {SCENARIO_VIEW_TYPE_OPTIONS.map((option) => (
                <MenubarRadioItem key={option} value={option}>
                  {SLIDE_VIEW_TYPE_LABELS[option]}
                </MenubarRadioItem>
              ))}
            </MenubarRadioGroup>
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>Paths</MenubarTrigger>
        <MenubarContent align="end" className="min-w-52">
          <MenubarGroup>
            <MenubarLabel>Visible paths</MenubarLabel>
            {paths.length === 0 ? (
              <MenubarLabel className="font-normal text-muted-foreground">
                No paths available
              </MenubarLabel>
            ) : (
              paths.map((path) => (
                <MenubarCheckboxItem
                  key={path.id}
                  checked={selectedPathIds.includes(path.id)}
                  onCheckedChange={() => onTogglePath(path.id)}
                  onSelect={(event) => event.preventDefault()}
                >
                  <PathTypeColorKey type={path.path_type} name={path.name} />
                  <PathDescriptionTooltip
                    description={path.description}
                    pathName={path.name}
                    side="left"
                  >
                    <span>{formatPathPickerLabel(path.name)}</span>
                  </PathDescriptionTooltip>
                </MenubarCheckboxItem>
              ))
            )}
          </MenubarGroup>
        </MenubarContent>
      </MenubarMenu>
    </div>
  )
}

import { useId, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

/**
 * The sidebar's one disclosure vocabulary — used by the PHASES / PATHS
 * section headers, the phase rows inside them, and the slice type groups, so
 * every twisty in the sidebar looks and behaves the same.
 *
 * Three rules, taken from Figma's layer tree:
 *
 * 1. **The chevron sits to the left of the label**, in a fixed-width slot.
 *    Rows with no children render the slot empty, so labels at the same depth
 *    always start at the same x whether or not they expand.
 * 2. **It points right when collapsed, down when open** (one icon, rotated).
 * 3. **It only appears on hover** (or keyboard focus) of its own row. At rest
 *    the sidebar is a list of names, not a field of arrows.
 *
 * Expansion is always available: the chevron is its own button, so a row can
 * be collapsed without first selecting it.
 */

/** Fixed chevron slot. Its width is also the indent step for child rows. */
const CHEVRON_SLOT_CLASS =
  'flex size-4 shrink-0 items-center justify-center rounded-sm'

/** Hidden at rest, revealed by hovering or focusing anywhere in the row. */
const CHEVRON_REVEAL_CLASS =
  'opacity-0 transition-opacity duration-(--motion-micro) group-hover/nav-row:opacity-100 group-focus-within/nav-row:opacity-100 motion-reduce:transition-none'

/** Child rows indent by exactly one chevron slot. */
export const NAV_CHILD_INDENT_CLASS = 'pl-4'

/**
 * A hover-revealed action at the right of a row or section header — the `+`
 * that creates a child, the `⋯` that opens a row menu.
 *
 * Revealed rather than permanent, and headers are no exception: a sidebar with
 * a `+` on every row is a column of plus signs, and this list is read far more
 * often than it is added to. It wears the same reveal the chevron does, so the
 * two appear together and the row has one hover state rather than two.
 *
 * Coarse pointers have no hover to reveal it with, so there it is always shown.
 * Keyboard focus reveals it through `group-focus-within`, and it stays in the
 * tab order either way — an affordance that only exists under a mouse is not an
 * affordance for everyone.
 */
export function NavRowAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        // The whole row is a button; without this the create would also
        // navigate to whatever it was attached to.
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        CHEVRON_SLOT_CLASS,
        CHEVRON_REVEAL_CLASS,
        'shrink-0 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        '[@media(pointer:coarse)]:opacity-100',
      )}
    >
      {children}
    </button>
  )
}

function NavChevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      aria-hidden
      className={cn(
        'size-3.5 text-sidebar-foreground/60 transition-transform duration-(--motion-fade) ease-out motion-reduce:transition-none',
        open && 'rotate-90',
      )}
    />
  )
}

type NavRowProps = {
  label: ReactNode
  /** Rendered between the chevron slot and the label (e.g. the slice ◇). */
  icon?: ReactNode
  /** Omit for a leaf row: the chevron slot renders empty but keeps its width. */
  open?: boolean
  onToggle?: () => void
  onSelect?: () => void
  /** Camera/tab target: accent fill + left rail. */
  selected?: boolean
  /**
   * Contains the selection. No longer drawn: the highlighted scenario one
   * line below already says it, and two markers for one fact read as two
   * facts. Kept in the type so call sites keep stating it, which is what
   * guards against `selected` and `ancestor` ever both being true.
   */
  ancestor?: boolean
  /** Accessible name for the chevron ("Expand X" / "Collapse X"). */
  toggleLabel?: string
  /** Id of the panel this row controls, for `aria-controls`. */
  panelId?: string
  /** Marks the row for the "scroll the selection into view" effect. */
  rowId?: string
  /** Emphasis for top-level rows; children read one step quieter. */
  size?: 'md' | 'sm'
  /** Hover-revealed action at the right edge — the `+` that creates a child. */
  trailing?: ReactNode
  className?: string
}

/**
 * One navigable row: chevron slot, optional icon, label. The label button
 * navigates; the chevron button expands. They are siblings rather than nested
 * (a button inside a button is invalid) which is also what lets the two
 * actions stay independent.
 */
export function NavRow({
  label,
  icon,
  open,
  onToggle,
  onSelect,
  selected = false,
  toggleLabel,
  panelId,
  rowId,
  size = 'md',
  trailing,
  className,
}: NavRowProps) {
  const expandable = open !== undefined && onToggle !== undefined

  // Arrow keys expand and collapse without navigating — the keyboard
  // equivalent of clicking the chevron rather than the row.
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!expandable) return
    if (event.key === 'ArrowRight' && !open) {
      event.preventDefault()
      onToggle()
    } else if (event.key === 'ArrowLeft' && open) {
      event.preventDefault()
      onToggle()
    }
  }

  return (
    <div
      data-nav-row={rowId}
      className={cn(
        'group/nav-row relative flex w-full min-w-0 items-center gap-1 rounded-md pl-1 transition-colors',
        selected
          ? 'bg-sidebar-selected text-sidebar-selected-foreground before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-selected-rail'
          : 'hover:bg-sidebar-accent',
        className,
      )}
    >
      {expandable ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${toggleLabel ?? ''}`.trim()}
          className={cn(
            CHEVRON_SLOT_CLASS,
            CHEVRON_REVEAL_CLASS,
            'hover:bg-sidebar-accent focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          )}
        >
          <NavChevron open={open} />
        </button>
      ) : (
        <span className={CHEVRON_SLOT_CLASS} aria-hidden />
      )}
      <button
        type="button"
        onClick={onSelect}
        onKeyDown={handleKeyDown}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'min-w-0 flex-1 truncate rounded-md py-1.5 pr-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          size === 'md' ? 'text-[13px]' : 'text-xs',
          selected
            ? 'font-medium text-sidebar-selected-foreground'
            : 'text-sidebar-foreground/85 group-hover/nav-row:text-sidebar-accent-foreground',
        )}
      >
        {icon ? (
          <span className="mr-1.5 text-sidebar-foreground/60" aria-hidden>
            {icon}
          </span>
        ) : null}
        {label}
      </button>
      {trailing}
    </div>
  )
}

type NavSectionProps = {
  /** Section name; rendered uppercase. */
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Right-aligned affordance in the header row (count, action button). */
  trailing?: ReactNode
  children: ReactNode
}

/**
 * A sidebar section (PHASES, PATHS, a slice type group). The whole header row
 * is the trigger — there is no second action competing with it — but it wears
 * the same left-hand, hover-revealed chevron as the rows inside it, and its
 * label starts at the same x as theirs.
 */
export function NavSection({
  title,
  open,
  onOpenChange,
  trailing,
  children,
}: NavSectionProps) {
  const panelId = useId()

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="group/nav-row flex items-center gap-1 pr-1">
        <CollapsibleTrigger
          aria-controls={panelId}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1 rounded-md pl-1 text-left transition-colors',
            'hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          )}
        >
          <span className={cn(CHEVRON_SLOT_CLASS, CHEVRON_REVEAL_CLASS)}>
            <NavChevron open={open} />
          </span>
          <span className="min-w-0 flex-1 truncate py-1.5 text-2xs font-medium tracking-wider text-sidebar-foreground/60 uppercase">
            {title}
          </span>
        </CollapsibleTrigger>
        {trailing}
      </div>
      <CollapsibleContent id={panelId}>
        <div className="flex flex-col gap-0.5 pb-1">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Indented child list under an expanded {@link NavRow}. */
export function NavChildren({
  id,
  children,
}: {
  id?: string
  children: ReactNode
}) {
  return (
    <ul id={id} className={cn('flex flex-col gap-0.5', NAV_CHILD_INDENT_CLASS)}>
      {children}
    </ul>
  )
}

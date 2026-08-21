import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  STAKEHOLDER_KIND_LABELS,
  useStakeholders,
  type StakeholderKind,
} from '@/hooks/useStakeholders'
import { PANEL_TEXT } from '@/lib/panelText'
import { cn } from '@/lib/utils'

/**
 * Which member of the cast this lane is.
 *
 * Read-only over the registry on purpose: the cast changes about once a
 * quarter, and creating or renaming one is an agent tool with a ledger entry,
 * not something to do by typing into a lane. Most lanes have nobody — the
 * structural rows (tech, support, storyboard) are scaffolding — so "Nobody" is
 * a first-class choice rather than an empty state.
 */
export function StakeholderSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null
  onChange: (next: string | null) => void
  disabled?: boolean
}) {
  const result = useStakeholders()
  const stakeholders = result.status === 'ready' ? result.data : []
  const [open, setOpen] = useState(false)
  const selected = stakeholders.find((entry) => entry.id === value) ?? null

  if (disabled) {
    return (
      <p className={PANEL_TEXT.value}>
        {selected ? (
          <>
            {selected.name}{' '}
            <span className="text-muted-foreground">
              · {STAKEHOLDER_KIND_LABELS[selected.kind as StakeholderKind]}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">Nobody — a structural row.</span>
        )}
      </p>
    )
  }

  const pick = (next: string | null) => {
    onChange(next)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 w-full justify-between px-2 text-xs font-normal"
          >
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>
              {selected ? selected.name : 'Nobody'}
            </span>
            <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-56 gap-0.5 p-1">
        <StakeholderRow
          label="Nobody"
          hint="A structural row — tech, support, storyboard."
          selected={value === null}
          onSelect={() => pick(null)}
        />
        {stakeholders.map((entry) => (
          <StakeholderRow
            key={entry.id}
            label={entry.name}
            hint={STAKEHOLDER_KIND_LABELS[entry.kind as StakeholderKind]}
            selected={entry.id === value}
            onSelect={() => pick(entry.id)}
          />
        ))}
      </PopoverContent>
    </Popover>
  )
}

function StakeholderRow({
  label,
  hint,
  selected,
  onSelect,
}: {
  label: string
  hint: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs',
        'transition-colors duration-(--motion-micro) hover:bg-accent',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
      )}
    >
      <Check
        className={cn('size-3 shrink-0', selected ? 'opacity-100' : 'opacity-0')}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-2xs text-muted-foreground">{hint}</span>
    </button>
  )
}

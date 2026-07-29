import { useState } from 'react'
import { ChevronRight, Landmark, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { InlineNotice } from '@/components/ui/inline-notice'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useProposition } from '@/hooks/useProposition'
import { updateWithConcurrency } from '@/lib/mutations'
import type { Database } from '@/types/database'

type PropositionField =
  | 'funding'
  | 'pricing'
  | 'delivery_cost'
  | 'revenue_model'
  | 'partners'

const PROPOSITION_FIELDS: Array<{ key: PropositionField; label: string }> = [
  { key: 'funding', label: 'Funding' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'delivery_cost', label: 'Delivery cost' },
  { key: 'revenue_model', label: 'Revenue model' },
  { key: 'partners', label: 'Partners' },
]

function FieldRow({
  label,
  value,
  canWrite,
  onEdit,
}: {
  label: string
  value: string | null
  canWrite: boolean
  onEdit: () => void
}) {
  return (
    <div className="group/prop-field flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        {canWrite ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Edit ${label.toLowerCase()}`}
            className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover/prop-field:opacity-100 focus-visible:opacity-100 hover:text-foreground"
            onClick={onEdit}
          >
            <Pencil className="size-2.5" />
          </Button>
        ) : null}
      </div>
      {value?.trim() ? (
        <p className="text-xs leading-snug whitespace-pre-wrap text-foreground/80">
          {value.trim()}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground/70 italic">Not specified</p>
      )}
    </div>
  )
}

function PropositionBody() {
  const { client, canWrite } = useSupabase()
  const [reloadToken, setReloadToken] = useState(0)
  const result = useProposition(reloadToken)
  const [editing, setEditing] = useState<PropositionField | null>(null)
  const [draftValue, setDraftValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  if (result.status === 'loading') {
    return <p className="text-xs text-muted-foreground">Loading proposition…</p>
  }
  if (result.status === 'error') {
    return (
      <InlineNotice variant="warning">
        The proposition could not be loaded: {result.message}
      </InlineNotice>
    )
  }

  const { lifecycleId, row } = result.data

  const beginEdit = (field: PropositionField) => {
    setNotice(null)
    setEditing(field)
    setDraftValue(row?.[field] ?? '')
  }

  const handleSave = async () => {
    if (!client || !editing || saving) return
    setSaving(true)
    setNotice(null)
    const patchValue = draftValue.trim() || null
    try {
      if (!row) {
        // First save creates the one-per-lifecycle row.
        const insertRow: Database['public']['Tables']['propositions']['Insert'] =
          { service_lifecycle_id: lifecycleId }
        insertRow[editing] = patchValue
        const { error } = await client
          .from('propositions')
          .upsert(insertRow, { onConflict: 'service_lifecycle_id' })
        if (error) throw new Error(error.message)
      } else {
        const patch: Database['public']['Tables']['propositions']['Update'] = {}
        patch[editing] = patchValue
        const outcome = await updateWithConcurrency(
          client,
          'propositions',
          lifecycleId,
          patch,
          row.updated_at,
          'service_lifecycle_id',
        )
        if (outcome.conflict) {
          setNotice(
            outcome.current === null
              ? 'The proposition record was removed — reloading.'
              : 'The proposition changed elsewhere — reloading the latest version.',
          )
          setEditing(null)
          setReloadToken((token) => token + 1)
          return
        }
      }
      setEditing(null)
      setReloadToken((token) => token + 1)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {notice ? <InlineNotice variant="warning">{notice}</InlineNotice> : null}
      {PROPOSITION_FIELDS.map(({ key, label }) =>
        editing === key ? (
          <div key={key} className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              {label}
            </p>
            <textarea
              autoFocus
              rows={2}
              value={draftValue}
              aria-label={label}
              className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs leading-snug outline-none focus:ring-1 focus:ring-ring"
              onChange={(event) => setDraftValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setEditing(null)
              }}
            />
            <div className="flex items-center justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={saving}
                onClick={() => {
                  void handleSave()
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        ) : (
          <FieldRow
            key={key}
            label={label}
            value={row?.[key] ?? null}
            canWrite={canWrite}
            onEdit={() => beginEdit(key)}
          />
        ),
      )}
    </div>
  )
}

/**
 * Compact business-proposition card floating on the service overview.
 * SELECT is restricted: no-DB sessions see an offline note and anonymous
 * sessions a sign-in prompt — never an empty-proposition state derived from
 * a restricted read. Writers edit the five fields inline (INSERT on first
 * save, optimistic-concurrency updates after).
 */
export function PropositionCard() {
  const { configured, client, canWrite } = useSupabase()

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-30 w-72 max-w-[calc(100%-2rem)]">
      <Collapsible className="pointer-events-auto rounded-xl border border-border bg-card/95 px-3 py-2 shadow-md">
        <CollapsibleTrigger className="group/proposition flex w-full items-center gap-1.5 text-xs font-medium text-foreground">
          <Landmark className="size-3.5 text-muted-foreground" aria-hidden />
          Proposition
          <ChevronRight
            className="ml-auto size-3 text-muted-foreground transition-transform group-aria-expanded/proposition:rotate-90"
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="max-h-72 overflow-y-auto pt-2 pb-1">
            {!configured || !client ? (
              <p className="text-xs text-muted-foreground">
                The proposition is unavailable offline.
              </p>
            ) : !canWrite ? (
              <p className="text-xs text-muted-foreground">
                Sign in to view the business proposition.
              </p>
            ) : (
              <PropositionBody />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

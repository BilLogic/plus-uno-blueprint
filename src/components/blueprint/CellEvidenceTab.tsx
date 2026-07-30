import { useState, type FormEvent } from 'react'
import {
  BarChart3,
  CalendarCheck,
  CircleDashed,
  ClipboardList,
  Eye,
  ExternalLink,
  FileText,
  Lightbulb,
  MessageSquare,
  Plus,
} from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { InlineNotice } from '@/components/ui/inline-notice'
import { Input } from '@/components/ui/input'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useEvidence } from '@/hooks/useEvidence'
import { resolveFirstLifecycleId } from '@/lib/sliceMutations'
import { safeExternalHref } from '@/lib/sliceCells'
import type { Database, Evidence } from '@/types/database'

const EVIDENCE_KINDS = [
  'interview',
  'survey',
  'analytics',
  'doc',
  'meeting',
  'decision',
  'observation',
  'other',
] as const

type EvidenceKind = (typeof EVIDENCE_KINDS)[number]

const KIND_ICONS: Record<EvidenceKind, typeof FileText> = {
  interview: MessageSquare,
  survey: ClipboardList,
  analytics: BarChart3,
  doc: FileText,
  meeting: CalendarCheck,
  decision: Lightbulb,
  observation: Eye,
  other: CircleDashed,
}

function kindIcon(kind: string) {
  const Icon = KIND_ICONS[kind as EvidenceKind] ?? CircleDashed
  return <Icon className="mt-px size-3.5 shrink-0 text-muted-foreground" aria-hidden />
}

function EvidenceRow({ row }: { row: Evidence }) {
  const refHref = safeExternalHref(row.ref)
  return (
    <li className="flex items-start gap-2 border-b border-border/35 py-2 last:border-0">
      {kindIcon(row.kind)}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-xs font-medium text-foreground">{row.title}</p>
        {refHref ? (
          <a
            href={refHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-fit min-w-0 items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{row.ref}</span>
          </a>
        ) : null}
        {row.excerpt ? (
          <p className="border-l-2 border-border pl-2 text-[11px] leading-snug text-muted-foreground italic">
            {row.excerpt}
          </p>
        ) : null}
        {row.note ? (
          <p className="text-[11px] leading-snug text-muted-foreground">
            {row.note}
          </p>
        ) : null}
      </div>
    </li>
  )
}

function AddSourceForm({
  client,
  cellId,
  onAdded,
}: {
  client: SupabaseClient<Database>
  cellId: string
  onAdded: () => void
}) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<EvidenceKind>('interview')
  const [title, setTitle] = useState('')
  const [ref, setRef] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-fit gap-1 text-xs text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-3" />
        Add source
      </Button>
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !title.trim()) return
    setBusy(true)
    setError(null)
    try {
      const lifecycleId = await resolveFirstLifecycleId(client)
      const { error: insertError } = await client.from('evidence').insert({
        service_lifecycle_id: lifecycleId,
        cell_id: cellId,
        // TODO(map-skill): id placeholder — real IR key-paths come from
        // the skill.
        cell_key: cellId,
        kind,
        title: title.trim(),
        ref: ref.trim() || null,
        excerpt: excerpt.trim() || null,
        note: note.trim() || null,
      })
      if (insertError) throw new Error(insertError.message)
      setOpen(false)
      setTitle('')
      setRef('')
      setExcerpt('')
      setNote('')
      onAdded()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : String(submitError),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-2.5"
      onSubmit={(event) => {
        void handleSubmit(event)
      }}
    >
      <select
        value={kind}
        aria-label="Source kind"
        className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        onChange={(event) => setKind(event.target.value as EvidenceKind)}
      >
        {EVIDENCE_KINDS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <Input
        required
        placeholder="Title"
        aria-label="Source title"
        className="h-7 text-xs"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <Input
        placeholder="Link or reference"
        aria-label="Source reference"
        className="h-7 text-xs"
        value={ref}
        onChange={(event) => setRef(event.target.value)}
      />
      <textarea
        rows={2}
        placeholder="Excerpt"
        aria-label="Source excerpt"
        className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
        value={excerpt}
        onChange={(event) => setExcerpt(event.target.value)}
      />
      <textarea
        rows={2}
        placeholder="Note"
        aria-label="Source note"
        className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      {error ? <InlineNotice variant="warning">{error}</InlineNotice> : null}
      <div className="flex items-center justify-end gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Adding…' : 'Add source'}
        </Button>
      </div>
    </form>
  )
}

function EvidenceList({
  client,
  cellId,
  onMutated,
}: {
  client: SupabaseClient<Database>
  cellId: string
  onMutated?: () => void
}) {
  const [reloadToken, setReloadToken] = useState(0)
  const result = useEvidence(cellId, reloadToken)

  if (result.status === 'loading') {
    return <p className="text-xs text-muted-foreground">Loading evidence…</p>
  }
  if (result.status === 'error') {
    return (
      <InlineNotice variant="warning">
        Evidence could not be loaded: {result.message}
      </InlineNotice>
    )
  }

  const rows = result.data

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {rows.length === 0 ? (
          <>
            <span aria-hidden>○ </span>
            assumption — no evidence yet
          </>
        ) : (
          <>
            {rows.length} {rows.length === 1 ? 'source' : 'sources'}
          </>
        )}
      </p>
      {rows.length > 0 ? (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <EvidenceRow key={row.id} row={row} />
          ))}
        </ul>
      ) : null}
      <AddSourceForm
        client={client}
        cellId={cellId}
        onAdded={() => {
          setReloadToken((token) => token + 1)
          onMutated?.()
        }}
      />
    </div>
  )
}

type CellEvidenceTabProps = {
  /** Canonical (resolved) cell id; null when the cell is fallback-only. */
  cellId: string | null
  /** Called after an evidence mutation (assumption-lens counts refresh). */
  onMutated?: () => void
}

/**
 * Evidence tab. Restricted SELECT means anonymous sessions must see a
 * sign-in prompt — never an all-assumption state derived from an empty
 * restricted read. No-DB sessions get an offline note.
 */
export function CellEvidenceTab({ cellId, onMutated }: CellEvidenceTabProps) {
  const { client, configured, canWrite } = useSupabase()

  if (!configured || !client) {
    return (
      <p className="text-xs text-muted-foreground">
        Evidence is unavailable offline.
      </p>
    )
  }
  if (!canWrite) {
    return (
      <p className="text-xs text-muted-foreground">
        Evidence requires a connected editor.
      </p>
    )
  }
  if (!cellId) {
    return (
      <p className="text-xs text-muted-foreground">
        This cell is not in the database yet, so it cannot carry evidence.
      </p>
    )
  }

  return <EvidenceList client={client} cellId={cellId} onMutated={onMutated} />
}

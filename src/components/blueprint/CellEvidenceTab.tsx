import { useState, type FormEvent } from 'react'
import {
  AlertTriangle,
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DeferredSkeleton } from '@/components/ui/deferred-skeleton'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { OptionSelect } from '@/components/blueprint/OptionSelect'
import { PANEL_TEXTAREA_CLASS } from '@/components/blueprint/panelShell'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { invalidateEvidence, useEvidence } from '@/hooks/useEvidence'
import { addEvidence } from '@/lib/evidenceMutations'
import { PANEL_TEXT } from '@/lib/panelText'
import { resolveFirstServiceId } from '@/lib/service'
import { safeExternalHref } from '@/lib/sliceCells'
import { errorMessage } from '@/lib/utils'
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

/**
 * The kinds, as the panel writes words: one capital, and nothing else.
 *
 * Derived from `EVIDENCE_KINDS` rather than listed a second time — a hand-kept
 * label table is a second place for the vocabulary to be true, and the only
 * difference between the stored word and the shown one is its first letter.
 */
const KIND_OPTIONS = EVIDENCE_KINDS.map((kind) => ({
  value: kind,
  label: kind.charAt(0).toUpperCase() + kind.slice(1),
}))

function kindIcon(kind: string) {
  const Icon = KIND_ICONS[kind as EvidenceKind] ?? CircleDashed
  return <Icon className="mt-px size-3.5 shrink-0 text-muted-foreground" aria-hidden />
}

function EvidenceRow({ row }: { row: Evidence }) {
  const refHref = safeExternalHref(row.ref)
  return (
    <li className="flex items-start gap-2 border-b border-muted py-2 last:border-0">
      {kindIcon(row.kind)}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-xs font-medium text-foreground">{row.title}</p>
        {refHref ? (
          <a
            href={refHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-fit min-w-0 items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="size-3 shrink-0" aria-hidden />
            {/* A citation ref or URL — machine data, and mono keeps a truncated
                one scannable character by character. */}
            <span className="truncate font-mono">{row.ref}</span>
          </a>
        ) : null}
        {row.excerpt ? (
          <p className="border-l-2 border-border pl-2 text-2xs leading-snug text-muted-foreground italic">
            {row.excerpt}
          </p>
        ) : null}
      </div>
    </li>
  )
}

/**
 * A field's name, in the panel's own eyebrow type, and — where the field can
 * be left empty — the word that says so.
 *
 * Every field in this form carries one. A placeholder cannot do this job: it
 * describes the field only until someone types into it, which is exactly when
 * a half-filled form most needs to say what its boxes hold.
 */
function FieldLabel({
  text,
  optional = false,
}: {
  text: string
  optional?: boolean
}) {
  return (
    <span className={PANEL_TEXT.sectionLabel}>
      {text}
      {optional ? (
        <span className="font-normal text-muted-foreground/70"> · optional</span>
      ) : null}
    </span>
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
      const serviceId = await resolveFirstServiceId(client)
      // Through the ledger wrapper, like every other write — an added source
      // shows in the session log and can be taken back.
      await addEvidence(client, {
        serviceId,
        cellId,
        // TODO(map-skill): id placeholder — real IR key-paths come from
        // the skill.
        cellKey: cellId,
        kind,
        title: title.trim(),
        ref: ref.trim() || null,
        excerpt: excerpt.trim() || null,
      })
      setOpen(false)
      setTitle('')
      setRef('')
      setExcerpt('')
      onAdded()
    } catch (submitError) {
      setError(
        errorMessage(submitError),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-2.5 rounded-lg border border-border bg-muted/20 p-2.5"
      onSubmit={(event) => {
        void handleSubmit(event)
      }}
    >
      {/* A kind is a short enum and a title is a sentence, so they share a
          row. Stacked, they were two of four full-width boxes in a panel 264px
          wide, and the enum was as wide as the sentence. */}
      <div className="flex items-start gap-2">
        {/* 128px: the widest label, "Observation", is 76px, and the trigger
            spends 42 on padding, gap and chevron. Measured, because at 112 it
            came up two pixels short and clipped the one kind nobody would
            notice was clipped. A title is free text and scrolls; a kind is
            chosen by reading it, so the enum takes the fixed column. */}
        <div className="flex w-32 shrink-0 flex-col gap-1">
          <FieldLabel text="Kind" />
          {/*
            The panel's own select — the same control the Status and Role
            fields wear, and the reason its trigger class exists. What stood
            here was a native `<select>` carrying its own radius, its own
            border token, no hover state and `font-mono`, which made a source
            kind read as machine data and clipped the value it was showing:
            28px of box, 8px of the forms plugin's padding at each end, and a
            16px line in the 10px that were left.
          */}
          <OptionSelect
            value={kind}
            onChange={setKind}
            options={KIND_OPTIONS}
            aria-label="Kind"
          />
        </div>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <FieldLabel text="Title" />
          <Input
            required
            placeholder="e.g. Session observation, P3"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <FieldLabel text="Link or reference" optional />
        <Input
          placeholder="A URL, or where in the document it sits"
          value={ref}
          onChange={(event) => setRef(event.target.value)}
        />
      </label>
      {/*
        Under a rule, because what the source SAYS is a different question from
        what the source IS, and the answer is written in someone else's words.

        The ticket asks for two fields here — the quote, and the author's own
        remark about it. This deployment has one: `evidence.note` was dropped
        by 20260830190000, which asserted it held nothing first, and
        `scripts/tests/one-spelling-each.test.mjs` owns that invariant. The
        group is the shape; the second field is upstream's to keep.
      */}
      <div className="flex flex-col gap-2 border-t border-border pt-2.5">
        <label className="flex flex-col gap-1">
          <FieldLabel text="Quote from the source" optional />
          <textarea
            rows={2}
            placeholder="Their words, not a summary of them"
            className={PANEL_TEXTAREA_CLASS}
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
          />
        </label>
      </div>
      {error ? (
        /* The source was not saved — an error, not a caution. */
        <Alert variant="destructive">
          <AlertTriangle className="size-3.5" aria-hidden />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      ) : null}
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

/** Reserves the summary line plus one source row while evidence loads. */
function EvidenceLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="h-4 w-24 rounded-full" />
      <div className="flex items-start gap-2 py-2">
        <Skeleton className="mt-px size-3.5 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Skeleton className="h-3 w-2/3 rounded-full" />
          <Skeleton className="h-3 w-1/3 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-7 w-28 rounded-md" />
    </div>
  )
}

function EvidenceList({
  client,
  cellId,
}: {
  client: SupabaseClient<Database>
  cellId: string
}) {
  const result = useEvidence(cellId)

  if (result.status === 'error') {
    return (
      /* The fetch failed and the list is empty — an error, not a caution. */
      <Alert variant="destructive">
        <AlertTriangle className="size-3.5" aria-hidden />
        <AlertDescription className="text-xs">
          Evidence could not be loaded: {result.message}
        </AlertDescription>
      </Alert>
    )
  }

  const rows = result.status === 'ready' ? result.data : []

  return (
    <DeferredSkeleton
      loading={result.status === 'loading'}
      skeleton={<EvidenceLoadingSkeleton />}
    >
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
          onAdded={() => invalidateEvidence(cellId)}
        />
      </div>
    </DeferredSkeleton>
  )
}

type CellEvidenceTabProps = {
  /** Canonical (resolved) cell id; null when the cell is fallback-only. */
  cellId: string | null
}

/**
 * Evidence tab. Restricted SELECT means anonymous sessions must see a
 * sign-in prompt — never an all-assumption state derived from an empty
 * restricted read. No-DB sessions get an offline note.
 */
export function CellEvidenceTab({ cellId }: CellEvidenceTabProps) {
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

  return <EvidenceList client={client} cellId={cellId} />
}

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import { updateCellContent } from '@/lib/cellContentMutations'

/**
 * Field label with its explanation folded into a hover tooltip — the caption
 * text under every input made the form read twice as long as it is.
 */
function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  const labelText = (
    <span className="w-fit text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
      {label}
    </span>
  )
  return (
    <label className="flex flex-col gap-1">
      {hint ? (
        <Tooltip>
          <TooltipTrigger render={labelText} />
          <TooltipContent side="left">{hint}</TooltipContent>
        </Tooltip>
      ) : (
        labelText
      )}
      {children}
    </label>
  )
}

/**
 * Inline editor for what a cell says.
 *
 * Two owner fields, not one, because they answer different questions and the
 * gap between them is usually the finding: *owner* is the team accountable for
 * the step; *perceived owner* is who the person on the other side thinks they
 * are dealing with. A blueprint where those differ everywhere is describing a
 * service that feels fragmented no matter how well each team performs.
 *
 * Resources are deliberately not here — they live on the Resources tab, which
 * edits in place. One concern per surface.
 */
export function CellContentEditor({
  cellId,
  content,
  description,
  owner,
  perceivedOwner,
  onDone,
}: {
  cellId: string
  content: string
  description: string
  owner: string
  perceivedOwner: string
  onDone: () => void
}) {
  const { client } = useSupabase()
  const [contentText, setContentText] = useState(content)
  const [descriptionText, setDescriptionText] = useState(description)
  const [ownerText, setOwnerText] = useState(owner)
  const [perceivedText, setPerceivedText] = useState(perceivedOwner)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blocked = !contentText.trim()

  const handleSave = async () => {
    if (!client || busy || blocked) return
    setBusy(true)
    setError(null)
    try {
      await updateCellContent(
        client,
        cellId,
        {
          content: contentText,
          description: descriptionText,
          owner: ownerText,
          perceivedOwner: perceivedText,
        },
        // The props are the pre-edit values — captured as the revert state.
        { content, description, owner, perceivedOwner },
      )
      // The grid holds the cell's text, so its read has to be dropped too —
      // invalidating only the panel's own query would leave the box on the
      // canvas showing the old label until the next full reload.
      invalidateQueries('lifecycle-phases')
      invalidateQueries(`cell-content:${cellId}`)
      onDone()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3" data-cell-content-editor="">
      <Field label="Text" hint="What this cell says on the grid.">
        <Input
          value={contentText}
          autoFocus
          onChange={(event) => setContentText(event.target.value)}
        />
      </Field>

      <Field label="Description" hint="The longer version, for the panel.">
        <Input
          value={descriptionText}
          onChange={(event) => setDescriptionText(event.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Owner" hint="The team accountable for this moment.">
          <Input
            value={ownerText}
            placeholder="Tutor Ops"
            onChange={(event) => setOwnerText(event.target.value)}
          />
        </Field>
        <Field
          label="Perceived owner"
          hint="Who the person on the other side thinks they are dealing with. A gap between the two is a finding."
        >
          <Input
            value={perceivedText}
            placeholder="PLUS"
            onChange={(event) => setPerceivedText(event.target.value)}
          />
        </Field>
      </div>

      {!contentText.trim() ? (
        <p className="text-xs text-muted-foreground">
          · A cell needs text — an empty one reads as a gap in the grid.
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={busy || blocked} onClick={handleSave}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

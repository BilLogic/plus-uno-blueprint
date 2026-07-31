import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { invalidateQueries } from '@/hooks/useSupabaseQuery'
import {
  updateCellContent,
  updateCellResources,
  type ResourceDraft,
} from '@/lib/cellContentMutations'
import { validateResourceUrl } from '@/lib/resourceUrl'
import type { CellLink } from '@/types/blueprint'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

/**
 * Inline editor for what a cell says, and what it links to.
 *
 * Two owner fields, not one, because they answer different questions and the
 * gap between them is usually the finding: *owner* is the team accountable for
 * the step; *perceived owner* is who the person on the other side thinks they
 * are dealing with. A blueprint where those differ everywhere is describing a
 * service that feels fragmented no matter how well each team performs.
 */
export function CellContentEditor({
  cellId,
  content,
  description,
  owner,
  perceivedOwner,
  links,
  onDone,
}: {
  cellId: string
  content: string
  description: string
  owner: string
  perceivedOwner: string
  links: CellLink[]
  onDone: () => void
}) {
  const { client } = useSupabase()
  const [contentText, setContentText] = useState(content)
  const [descriptionText, setDescriptionText] = useState(description)
  const [ownerText, setOwnerText] = useState(owner)
  const [perceivedText, setPerceivedText] = useState(perceivedOwner)
  const [resources, setResources] = useState<ResourceDraft[]>(() =>
    links
      .filter((link) => link.type === 'url' && link.url?.trim())
      .map((link) => ({ label: link.label, url: link.url ?? '' })),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Checked as they type rather than on save: a bad link is worth knowing
  // about while the cursor is still in the field that caused it.
  const urlProblems = resources.map((resource) =>
    resource.url.trim() ? validateResourceUrl(resource.url).ok === false : false,
  )
  const blocked = !contentText.trim() || urlProblems.some(Boolean)

  const setResource = (index: number, patch: Partial<ResourceDraft>) =>
    setResources((current) =>
      current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    )

  const handleSave = async () => {
    if (!client || busy || blocked) return
    setBusy(true)
    setError(null)
    try {
      await updateCellContent(client, cellId, {
        content: contentText,
        description: descriptionText,
        owner: ownerText,
        perceivedOwner: perceivedText,
      })
      await updateCellResources(
        client,
        cellId,
        links,
        resources.filter((resource) => resource.url.trim()),
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
        <Field label="Owner">
          <Input
            value={ownerText}
            placeholder="Tutor Ops"
            onChange={(event) => setOwnerText(event.target.value)}
          />
        </Field>
        <Field label="Perceived owner">
          <Input
            value={perceivedText}
            placeholder="PLUS"
            onChange={(event) => setPerceivedText(event.target.value)}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Resources
        </span>
        {resources.map((resource, index) => (
          <div key={index} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Input
                value={resource.label}
                placeholder="Label"
                className="h-7 w-28 text-xs"
                onChange={(event) =>
                  setResource(index, { label: event.target.value })
                }
              />
              <Input
                value={resource.url}
                placeholder="https://…"
                className="h-7 flex-1 text-xs"
                aria-invalid={urlProblems[index] || undefined}
                onChange={(event) =>
                  setResource(index, { url: event.target.value })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove resource ${index + 1}`}
                onClick={() =>
                  setResources((current) =>
                    current.filter((_, i) => i !== index),
                  )
                }
              >
                <X className="size-3" />
              </Button>
            </div>
            {urlProblems[index] ? (
              <p className="pl-1 text-xs text-destructive">
                {validateResourceUrl(resource.url).ok
                  ? null
                  : (validateResourceUrl(resource.url) as { problem: string })
                      .problem}
              </p>
            ) : null}
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 self-start px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() =>
            setResources((current) => [...current, { label: '', url: '' }])
          }
        >
          <Plus className="size-3" />
          Add resource
        </Button>
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

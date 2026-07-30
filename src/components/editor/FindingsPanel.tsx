import {
  useCallback,
  useEffect,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { ChevronDown, ShieldAlert, X } from 'lucide-react'
import { CELL_DETAIL_PANEL_TOP_CLASS } from '@/components/editor/menubarHeaderLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { InlineNotice } from '@/components/ui/inline-notice'
import { useBlueprintCellDetailOptional } from '@/contexts/BlueprintCellDetailContext'
import { useFindingsPanelOptional } from '@/contexts/findingsPanelContext'
import { SliceMembershipContext } from '@/contexts/sliceMembershipContext'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { updateWithConcurrency } from '@/lib/mutations'
import { resolveBlueprintCellId } from '@/lib/resolveBlueprintCellId'
import { cn } from '@/lib/utils'
import type { Finding } from '@/types/database'

type FindingStatus = 'open' | 'resolved' | 'dismissed'

const EMPTY_STATE_MESSAGE =
  'No findings yet — run an audit from your agent (audit skill) to populate this panel.'

/**
 * Toolbar toggle for the findings panel — sits in the same controls row as
 * the assumption-lens toggle. Shows the open-finding count as a badge.
 */
export function FindingsToggle() {
  const panel = useFindingsPanelOptional()
  const cellDetail = useBlueprintCellDetailOptional()

  if (!panel) return null

  const findings =
    panel.findings.status === 'ready'
      ? panel.findings.data
      : panel.findings.status === 'error'
        ? (panel.findings.fallback ?? [])
        : []
  const openCount = findings.filter(
    (finding) => finding.status === 'open',
  ).length

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={panel.open}
      className="pointer-events-auto gap-1.5 text-xs"
      onClick={() => {
        // The findings panel and the cell detail panel never open together.
        if (!panel.open) cellDetail?.clearSelection()
        panel.setOpen(!panel.open)
      }}
    >
      <ShieldAlert className="size-3.5" />
      Findings
      {openCount > 0 ? (
        <Badge
          variant="secondary"
          className="h-4 min-w-4 px-1 text-[10px] leading-none"
        >
          {openCount}
        </Badge>
      ) : null}
    </Button>
  )
}

/**
 * Wraps the blueprint canvas: while a finding is focused it supplies the
 * membership set (cells pick up `data-slice-member` outlines) and the
 * `data-finding-focus` / `data-slice-focus` attributes that drive the
 * focus CSS — the same mechanism the slice tab uses.
 */
export function FindingFocusScope({
  children,
  ...divProps
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  const panel = useFindingsPanelOptional()
  const memberCellIds = panel?.focusMemberCellIds ?? null

  return (
    <SliceMembershipContext.Provider value={memberCellIds}>
      <div
        {...divProps}
        {...(memberCellIds
          ? { 'data-slice-focus': 'focused', 'data-finding-focus': 'focused' }
          : {})}
      >
        {children}
      </div>
    </SliceMembershipContext.Provider>
  )
}

/** "Clear focus" pill mirroring the slice-focus pill (bottom-left). */
export function FindingFocusPill() {
  const panel = useFindingsPanelOptional()

  if (!panel?.focusedFindingId) return null

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        panel.focusFinding(null)
      }}
      className={cn(
        'absolute bottom-4 left-4 z-50 rounded-full border border-transparent',
        'bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-md',
        'transition-colors hover:bg-foreground/85',
      )}
    >
      <span aria-hidden>⚑ </span>
      Finding focus — clear
    </button>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === 'critical') {
    return <Badge variant="destructive">critical</Badge>
  }
  if (severity === 'warn') {
    // Amber treatment matches InlineNotice's warning variant.
    return (
      <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
        warn
      </Badge>
    )
  }
  return <Badge variant="secondary">{severity}</Badge>
}

function SourceChip({ source }: { source: string }) {
  return (
    <Badge variant="outline" className="text-[10px] text-muted-foreground">
      {source}
    </Badge>
  )
}

type FindingRowProps = {
  finding: Finding
  focused: boolean
  onFocusToggle: () => void
  /** Finding cell ids that don't resolve in the currently shown blueprints. */
  missingCellCount: number
  canWrite: boolean
  saving: boolean
  onStatus: (status: FindingStatus) => void
}

function FindingRow({
  finding,
  focused,
  onFocusToggle,
  missingCellCount,
  canWrite,
  saving,
  onStatus,
}: FindingRowProps) {
  const isOpen = finding.status === 'open'

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onFocusToggle()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={focused}
      onClick={onFocusToggle}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex w-full cursor-pointer flex-col gap-1.5 rounded-lg border px-2.5 py-2 text-left',
        'transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        focused
          ? 'border-ring bg-accent/60'
          : 'border-border/70 hover:bg-accent/40',
        !isOpen && 'opacity-80',
      )}
    >
      <div className="flex items-center gap-1.5">
        <SeverityBadge severity={finding.severity} />
        <span className="ml-auto" />
        <SourceChip source={finding.source} />
      </div>
      <p className="text-xs leading-snug whitespace-pre-wrap text-foreground/85">
        {finding.note?.trim() || 'No note recorded for this finding.'}
      </p>
      {missingCellCount > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {missingCellCount}{' '}
          {missingCellCount === 1 ? 'cell' : 'cells'} not on this view
        </p>
      ) : null}
      {canWrite ? (
        <div className="flex items-center gap-1">
          {isOpen ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                className="h-6 px-2 text-[11px]"
                onClick={(event) => {
                  event.stopPropagation()
                  onStatus('resolved')
                }}
              >
                Resolve
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                className="h-6 px-2 text-[11px] text-muted-foreground"
                onClick={(event) => {
                  event.stopPropagation()
                  onStatus('dismissed')
                }}
              >
                Dismiss
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving}
              className="h-6 px-2 text-[11px]"
              onClick={(event) => {
                event.stopPropagation()
                onStatus('open')
              }}
            >
              Reopen
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** Open findings grouped by `check_name`, preserving severity order. */
function groupByCheck(
  findings: readonly Finding[],
): Array<{ checkName: string; rows: Finding[] }> {
  const groups: Array<{ checkName: string; rows: Finding[] }> = []
  const byCheck = new Map<string, Finding[]>()

  for (const finding of findings) {
    const existing = byCheck.get(finding.check_name)
    if (existing) {
      existing.push(finding)
      continue
    }
    const rows = [finding]
    byCheck.set(finding.check_name, rows)
    groups.push({ checkName: finding.check_name, rows })
  }

  return groups
}

/**
 * Right-anchored non-modal drawer listing audit / whatif / import-sweep
 * findings — mirrors BlueprintCellDetailPanel's Drawer usage so the two
 * panels feel consistent (and never open at the same time).
 */
export function FindingsPanel() {
  const panel = useFindingsPanelOptional()
  const cellDetail = useBlueprintCellDetailOptional()
  const { client, canWrite } = useSupabase()
  const [notice, setNotice] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const panelOpen = panel?.open ?? false
  const setOpen = panel?.setOpen
  const reload = panel?.reload
  const cellDetailOpen = cellDetail?.isOpen ?? false

  // Mutual exclusion, other direction: selecting a cell closes findings.
  useEffect(() => {
    if (cellDetailOpen && panelOpen) setOpen?.(false)
  }, [cellDetailOpen, panelOpen, setOpen])

  const applyStatus = useCallback(
    async (finding: Finding, status: FindingStatus) => {
      if (!client || !reload || savingId) return
      setSavingId(finding.id)
      setNotice(null)
      try {
        // Column grant allows authenticated users to flip `status` only.
        const outcome = await updateWithConcurrency(
          client,
          'findings',
          finding.id,
          { status },
          finding.updated_at,
        )
        if (outcome.conflict) {
          setNotice(
            outcome.current === null
              ? 'That finding was deleted elsewhere — reloading the list.'
              : 'This finding changed elsewhere — reloading the latest version.',
          )
        }
        reload()
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error))
      } finally {
        setSavingId(null)
      }
    },
    [client, reload, savingId],
  )

  if (!panel) return null

  const result = panel.findings
  const findings =
    result.status === 'ready'
      ? result.data
      : result.status === 'error'
        ? (result.fallback ?? [])
        : []

  const openFindings = findings.filter((finding) => finding.status === 'open')
  const closedFindings = findings.filter(
    (finding) => finding.status !== 'open',
  )
  const groups = groupByCheck(openFindings)

  const missingCellCount = (finding: Finding) =>
    finding.cell_ids.filter(
      (cellId) => !panel.knownCellIds.has(resolveBlueprintCellId(cellId)),
    ).length

  const renderRow = (finding: Finding) => (
    <FindingRow
      key={finding.id}
      finding={finding}
      focused={panel.focusedFindingId === finding.id}
      onFocusToggle={() =>
        panel.focusFinding(
          panel.focusedFindingId === finding.id ? null : finding,
        )
      }
      missingCellCount={missingCellCount(finding)}
      canWrite={canWrite}
      saving={savingId === finding.id}
      onStatus={(status) => void applyStatus(finding, status)}
    />
  )

  return (
    <Drawer
      open={panelOpen}
      onOpenChange={(open) => panel.setOpen(open)}
      modal={false}
      disablePointerDismissal
      swipeDirection="right"
    >
      <DrawerContent
        data-findings-panel=""
        className={cn(
          CELL_DETAIL_PANEL_TOP_CLASS,
          '!right-4 !bottom-[61px] !left-auto !m-0 !h-auto !max-h-none w-[21rem] rounded-2xl border border-border/80 bg-popover shadow-sm after:hidden [--drawer-inset:1rem] md:!right-8 md:[--drawer-inset:2rem]',
        )}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <DrawerHeader className="flex-row items-center justify-between gap-2 pb-3 text-left">
          <div className="flex min-w-0 items-center gap-1.5">
            <ShieldAlert className="size-4 shrink-0 text-muted-foreground" />
            <DrawerTitle className="text-sm font-semibold">
              Findings
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              Audit, whatif, and import-sweep findings for this service
            </DrawerDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Close findings"
            onClick={() => panel.setOpen(false)}
          >
            <X />
          </Button>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 blueprint-scroll">
          {notice ? (
            <InlineNotice variant="warning">{notice}</InlineNotice>
          ) : null}

          {result.status === 'loading' ? (
            <p className="text-xs text-muted-foreground">Loading findings…</p>
          ) : result.status === 'error' && result.fallback === null ? (
            <p className="text-xs text-muted-foreground">
              Findings could not be loaded: {result.message}
            </p>
          ) : findings.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {EMPTY_STATE_MESSAGE}
            </p>
          ) : (
            <>
              {openFindings.length === 0 ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  No open findings — everything has been resolved or
                  dismissed.
                </p>
              ) : (
                groups.map((group) => (
                  <section
                    key={group.checkName}
                    className="flex flex-col gap-1.5"
                  >
                    <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {group.checkName}
                    </h3>
                    {group.rows.map(renderRow)}
                  </section>
                ))
              )}

              {closedFindings.length > 0 ? (
                <Collapsible className="mt-1 border-t border-border/70 pt-2">
                  <CollapsibleTrigger className="group flex w-full items-center gap-1 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground">
                    <ChevronDown className="size-3.5 transition-transform group-data-[panel-open]:rotate-180" />
                    Resolved &amp; dismissed ({closedFindings.length})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="flex flex-col gap-1.5 pt-2">
                    {closedFindings.map(renderRow)}
                  </CollapsibleContent>
                </Collapsible>
              ) : null}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

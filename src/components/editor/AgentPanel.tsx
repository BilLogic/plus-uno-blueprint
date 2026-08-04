import { useMemo, useRef, useState } from 'react'
import {
  ChevronLeft,
  Pencil,
  Plus,
  Search,
  SendHorizontal,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { NavSection } from '@/components/editor/SidebarNav'
import {
  createAgentSession,
  deleteAgentSession,
  renameAgentSession,
  useAgentSessions,
  type AgentSession,
} from '@/lib/agent/sessions'
import {
  AGENT_PROVIDERS,
  DEFAULT_MODELS,
  hasKey,
  modelFor,
  saveAgentSettings,
  useAgentSettings,
} from '@/lib/agent/settings'
import { cn } from '@/lib/utils'

/**
 * Case-insensitive subsequence match — the same forgiving filter the tag
 * pickers use: every query character must appear, in order, not necessarily
 * adjacent ("dwu" finds "Draft the Warm-Up").
 */
function fuzzyMatches(query: string, title: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const t = title.toLowerCase()
  let at = 0
  for (const char of q) {
    at = t.indexOf(char, at)
    if (at === -1) return false
    at += 1
  }
  return true
}

function isToday(iso: string): boolean {
  const then = new Date(iso)
  const now = new Date()
  return (
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate()
  )
}

/**
 * The ✦ surface: two views, one at a time — session info never crowds the
 * conversation. Step 1 picks (or creates) a session; step 2 is the chat,
 * full height.
 */
export function AgentPanel() {
  const sessions = useAgentSessions()
  const [openSessionId, setOpenSessionId] = useState<string | null>(null)

  const openSession =
    openSessionId !== null
      ? (sessions.find((session) => session.id === openSessionId) ?? null)
      : null

  return openSession ? (
    <AgentChatView
      session={openSession}
      onBack={() => setOpenSessionId(null)}
    />
  ) : (
    <AgentSessionsView
      sessions={sessions}
      onOpen={(id) => setOpenSessionId(id)}
      onCreate={() => {
        const session = createAgentSession()
        // ＋ drops straight into the conversation.
        setOpenSessionId(session.id)
      }}
    />
  )
}

function SessionRow({
  session,
  onOpen,
  onRename,
  onDelete,
}: {
  session: AgentSession
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const row = (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group/session flex w-full min-w-0 items-center gap-1.5 rounded-md py-1.5 pl-1.5 pr-2 text-left transition-colors',
        'hover:bg-sidebar-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
      )}
    >
      <Sparkles
        className="size-3 shrink-0 text-sidebar-foreground/50"
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-[13px] text-sidebar-foreground/85 group-hover/session:text-sidebar-accent-foreground">
        {session.title}
      </span>
      {session.changeCount > 0 ? (
        <span className="shrink-0 text-[10px] tabular-nums text-sidebar-foreground/50">
          {session.changeCount} chg
        </span>
      ) : null}
    </button>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block w-full">{row}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onRename}>
          <Pencil className="size-3.5" />
          Rename…
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-3.5" />
          Delete session…
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function AgentSessionsView({
  sessions,
  onOpen,
  onCreate,
}: {
  sessions: AgentSession[]
  onOpen: (id: string) => void
  onCreate: () => void
}) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [todayOpen, setTodayOpen] = useState(true)
  const [earlierOpen, setEarlierOpen] = useState(true)
  const [renameTarget, setRenameTarget] = useState<AgentSession | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AgentSession | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const searching = searchOpen && query.trim() !== ''
  const filtered = useMemo(
    () => sessions.filter((session) => fuzzyMatches(query, session.title)),
    [query, sessions],
  )
  const today = filtered.filter((session) => isToday(session.createdAt))
  const earlier = filtered.filter((session) => !isToday(session.createdAt))

  const rowFor = (session: AgentSession) => (
    <SessionRow
      key={session.id}
      session={session}
      onOpen={() => onOpen(session.id)}
      onRename={() => setRenameTarget(session)}
      onDelete={() => setDeleteTarget(session)}
    />
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-agent-panel="sessions">
      {/* Header: title, hover-priority actions — the Figma Pages row. */}
      <div className="flex h-9 shrink-0 items-center gap-1 px-2">
        {searchOpen ? (
          <Input
            ref={searchRef}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setQuery('')
                setSearchOpen(false)
              }
            }}
            placeholder="Filter sessions…"
            className="h-6 flex-1 text-xs"
            aria-label="Filter sessions"
          />
        ) : (
          <p className="min-w-0 flex-1 truncate pl-1 text-[11px] font-medium tracking-wider text-sidebar-foreground/60 uppercase">
            Sessions
          </p>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={searchOpen ? 'Close session filter' : 'Filter sessions'}
          aria-pressed={searchOpen}
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            setSearchOpen((open) => {
              if (open) setQuery('')
              return !open
            })
          }}
        >
          <Search className="size-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="New session"
          className="text-muted-foreground hover:text-foreground"
          onClick={onCreate}
        >
          <Plus className="size-3.5" aria-hidden />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 ? (
          <p className="px-1.5 pt-2 text-xs text-muted-foreground">
            No sessions yet — ＋ starts one. A session is one conversation
            plus the changes it made.
          </p>
        ) : searching ? (
          // A filter answers "where is it", so groups get out of the way.
          <div className="flex flex-col gap-0.5">
            {filtered.length === 0 ? (
              <p className="px-1.5 pt-2 text-xs text-muted-foreground">
                No session matches “{query.trim()}”.
              </p>
            ) : (
              filtered.map(rowFor)
            )}
          </div>
        ) : (
          <>
            {today.length > 0 ? (
              <NavSection
                title="Today"
                open={todayOpen}
                onOpenChange={setTodayOpen}
              >
                {today.map(rowFor)}
              </NavSection>
            ) : null}
            {earlier.length > 0 ? (
              <NavSection
                title="Earlier"
                open={earlierOpen}
                onOpenChange={setEarlierOpen}
              >
                {earlier.map(rowFor)}
              </NavSection>
            ) : null}
          </>
        )}
      </div>

      <RenameSessionDialog
        session={renameTarget}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
      />
      <DeleteSessionDialog
        session={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      />
    </div>
  )
}

function AgentChatView({
  session,
  onBack,
}: {
  session: AgentSession
  onBack: () => void
}) {
  const settings = useAgentSettings()
  const keyed = hasKey(settings)
  const [draft, setDraft] = useState('')

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-agent-panel="chat">
      {/* Header: back + title + change count. Nothing else — the
          transcript owns the rest of the height. */}
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border/60 px-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Back to sessions"
          className="text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          <ChevronLeft className="size-3.5" aria-hidden />
        </Button>
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {session.title}
        </p>
        {session.changeCount > 0 ? (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {session.changeCount} chg
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-y-auto p-3">
        {keyed ? (
          <p className="text-xs text-muted-foreground">
            Provider ready ({modelFor(settings)}). The conversation loop is
            the next unit — messages don't send yet.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            No provider key yet. Add one in the ⚙ settings at the bottom of
            the rail — the key stays in this browser only.
          </p>
        )}
      </div>

      <div className="shrink-0 border-t border-border/60 p-2">
        <div className="flex items-center gap-1.5">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Message the agent…"
            className="h-7 flex-1 text-xs"
            aria-label="Message the agent"
          />
          <Button
            type="button"
            size="icon-sm"
            variant="default"
            aria-label="Send"
            disabled
            title="The provider loop ships next — nothing sends yet"
          >
            <SendHorizontal className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}

function RenameSessionDialog({
  session,
  onOpenChange,
}: {
  session: AgentSession | null
  onOpenChange: (open: boolean) => void
}) {
  const [title, setTitle] = useState('')
  // Freeze the incoming title per dialog opening.
  const [lastId, setLastId] = useState<string | null>(null)
  if (session && session.id !== lastId) {
    setLastId(session.id)
    setTitle(session.title)
  }
  if (!session && lastId !== null) setLastId(null)

  const submit = () => {
    if (!session) return
    const trimmed = title.trim()
    if (trimmed && trimmed !== session.title)
      renameAgentSession(session.id, trimmed)
    onOpenChange(false)
  }

  return (
    <Dialog open={session !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Rename session</DialogTitle>
        </DialogHeader>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
          aria-label="Session title"
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={title.trim() === ''}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteSessionDialog({
  session,
  onOpenChange,
}: {
  session: AgentSession | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={session !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Delete “{session?.title}”?
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Removes the conversation. Changes it already made to the blueprint
          stay — revert those from the change sheet.
        </p>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (session) deleteAgentSession(session.id)
              onOpenChange(false)
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The ⚙ at the rail's bottom: provider, model, key. Pinned to the rail so
 * keys are reachable from any surface — and absent entirely when the
 * session cannot write (the deployed read-only site never offers it).
 */
export function AgentSettingsRailButton() {
  const settings = useAgentSettings()
  const [keyDraft, setKeyDraft] = useState('')
  const providerLabel =
    AGENT_PROVIDERS.find((entry) => entry.id === settings.provider)?.label ??
    settings.provider
  const savedKey = settings.keys[settings.provider]

  return (
    <TooltipProvider delay={300}>
      <Popover>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    aria-label="Agent settings"
                    className="flex size-9 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-hover hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                  >
                    <Settings className="size-4" aria-hidden />
                  </button>
                }
              />
            }
          />
          <TooltipContent side="right" className="text-xs">
            Agent settings
          </TooltipContent>
        </Tooltip>
        <PopoverContent side="right" align="end" className="w-72 p-3">
          <div className="flex flex-col gap-2.5">
            <p className="text-xs font-medium text-foreground">Agent</p>

            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] text-muted-foreground">
                Provider
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm" className="h-7 flex-1 justify-start text-xs">
                      {providerLabel}
                    </Button>
                  }
                />
                <DropdownMenuContent align="start">
                  {AGENT_PROVIDERS.map((entry) => (
                    <DropdownMenuItem
                      key={entry.id}
                      onClick={() => {
                        saveAgentSettings({ provider: entry.id })
                        setKeyDraft('')
                      }}
                    >
                      {entry.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] text-muted-foreground">
                Model
              </span>
              <Input
                value={
                  settings.models[settings.provider] ??
                  DEFAULT_MODELS[settings.provider]
                }
                onChange={(event) =>
                  saveAgentSettings({
                    models: { [settings.provider]: event.target.value },
                  })
                }
                className="h-7 flex-1 text-xs"
                aria-label="Model"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] text-muted-foreground">
                API key
              </span>
              <Input
                type="password"
                value={keyDraft}
                onChange={(event) => setKeyDraft(event.target.value)}
                placeholder={savedKey ? '••••••••  saved' : 'Paste key'}
                className="h-7 flex-1 text-xs"
                aria-label="API key"
              />
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={keyDraft.trim() === ''}
                onClick={() => {
                  saveAgentSettings({
                    keys: { [settings.provider]: keyDraft.trim() },
                  })
                  setKeyDraft('')
                }}
              >
                Save
              </Button>
            </div>

            <p className="text-[10px] leading-snug text-muted-foreground">
              Stored in this browser only — never the repo or a server. A key
              kept in the browser is readable by anyone with devtools on this
              machine; use a personal key, not a shared or production one.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  )
}

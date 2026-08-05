import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  ChevronLeft,
  Pencil,
  Plus,
  Search,
  SendHorizontal,
  Settings,
  Sparkles,
  Square,
  Trash2,
  X,
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
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import { Message, MessageContent } from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import { AgentMarkdown } from '@/components/editor/AgentMarkdown'
import { NavSection } from '@/components/editor/SidebarNav'
import { Badge } from '@/components/ui/badge'
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentTitle,
} from '@/components/ui/attachment'
import { useSupabase } from '@/contexts/SupabaseProvider'
import { useCanvasModeValue } from '@/contexts/canvasModeContext'
import { usePathSelectionContext } from '@/hooks/usePathSelection'
import {
  describeChange,
  sessionSnapshot,
  subscribeToSession,
} from '@/lib/authoringSession'
import {
  hydrateAgentTranscript,
  sendToAgent,
  stopAgent,
  useAgentRun,
  type TranscriptEvent,
} from '@/lib/agent/loop'
import {
  setPendingAgentAttachment,
  takePendingAgentAttachment,
  usePendingAgentAttachment,
} from '@/lib/agent/attachments'
import { attachAgentPersistence } from '@/lib/agent/persistence'
import {
  AGENT_SKILL_COMMANDS,
  parseSkillDraft,
  type AgentSkillCommand,
} from '@/lib/agent/skills'
import { listModels } from '@/lib/agent/providers/models'
import {
  createAgentSession,
  deleteAgentSession,
  hydrateAgentSessions,
  renameAgentSession,
  useAgentSessions,
  type AgentSession,
} from '@/lib/agent/sessions'
import {
  AGENT_PROVIDERS,
  MODEL_OPTIONS,
  hasKey,
  modelFor,
  openAgentSettings,
  saveAgentSettings,
  setAgentSettingsOpen,
  useAgentSettings,
  useAgentSettingsOpen,
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
  const { client, canWrite } = useSupabase()

  // Persistence rides the authenticated client: locally everything lands in
  // agent_sessions/agent_messages; read-only visitors stay on localStorage.
  useEffect(() => {
    attachAgentPersistence(canWrite ? client : null)
    if (canWrite && client) void hydrateAgentSessions()
    return () => attachAgentPersistence(null)
  }, [canWrite, client])

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
  const changeCount = useAgentChangeCount(session.id)
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
      {changeCount > 0 ? (
        <span className="shrink-0 text-[10px] tabular-nums text-sidebar-foreground/50">
          ✦ {changeCount} chg
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

  const pendingAttachment = usePendingAgentAttachment()
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

      {pendingAttachment ? (
        <p className="mx-2 mb-1 rounded-md bg-muted px-2 py-1.5 text-[11px] text-muted-foreground">
          ✎ {pendingAttachment.label} ready — open or start a session to send
          them.
        </p>
      ) : null}

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

/** Live count of ledger entries this agent session produced. */
function useAgentChangeCount(sessionId: string): number {
  const changes = useSyncExternalStore(subscribeToSession, sessionSnapshot)
  return changes.filter((entry) => entry.agentSessionId === sessionId).length
}

/**
 * One transcript row, built from the DS chat primitives: user turns are
 * tinted bubbles on the right, agent prose is a ghost bubble, tool calls
 * and status lines are Markers — the chat vocabulary shadcn ships, not a
 * hand-rolled lookalike.
 */
function TranscriptRow({ event }: { event: TranscriptEvent }) {
  switch (event.kind) {
    case 'user':
      return (
        <Message align="end">
          <MessageContent>
            {event.skill || event.attachmentLabel ? (
              <div className="mb-0.5 flex justify-end gap-1">
                {event.skill ? (
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    /{event.skill}
                  </Badge>
                ) : null}
                {event.attachmentLabel ? (
                  <Badge variant="outline" className="text-[10px]">
                    ✎ {event.attachmentLabel}
                  </Badge>
                ) : null}
              </div>
            ) : null}
            <Bubble variant="tinted">
              <BubbleContent className="text-xs whitespace-pre-wrap">
                {event.text}
              </BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      )
    case 'assistant':
      return (
        <Message>
          <MessageContent>
            <Bubble variant="ghost">
              <BubbleContent className="text-foreground/90">
                <AgentMarkdown text={event.text} className="text-xs" />
              </BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      )
    case 'tool':
      return (
        <Marker
          className={cn(
            'text-[11px]',
            event.isError && 'text-destructive',
          )}
        >
          <MarkerIcon>
            {event.isError ? (
              <XCircle className="size-3.5" aria-hidden />
            ) : (
              <CheckCircle2 className="size-3.5" aria-hidden />
            )}
          </MarkerIcon>
          <MarkerContent>
            <span className="font-mono">{event.name}</span>
            {event.summary ? <span className="ml-1.5">{event.summary}</span> : null}
          </MarkerContent>
        </Marker>
      )
    case 'status':
      return (
        <Marker variant="separator" className="text-[11px] italic">
          <MarkerContent>{event.text}</MarkerContent>
        </Marker>
      )
  }
}

function AgentChatView({
  session,
  onBack,
}: {
  session: AgentSession
  onBack: () => void
}) {
  const settings = useAgentSettings()
  const { client } = useSupabase()
  const mode = useCanvasModeValue()
  const { activePathKeys } = usePathSelectionContext()
  const changes = useSyncExternalStore(subscribeToSession, sessionSnapshot)
  const keyed = hasKey(settings)
  const [draft, setDraft] = useState('')
  const [pendingSkill, setPendingSkill] = useState<AgentSkillCommand | null>(
    null,
  )
  const attachment = usePendingAgentAttachment()
  const { events, running } = useAgentRun(session.id)
  const changeCount = useAgentChangeCount(session.id)
  const [renaming, setRenaming] = useState(false)

  // Reopening a session after a reload restores its transcript from
  // agent_messages (no-op for never-persisted sessions).
  useEffect(() => {
    void hydrateAgentTranscript(session.id)
  }, [session.id])

  // React-side context. What the user is *looking at* (view, selection,
  // open panel, Design picks) comes from the UI-context bridge, collected
  // live per round in the loop — this covers the rest: posture, filters,
  // and the session's edit history.
  const contextNote = useMemo(() => {
    const lines: string[] = [
      `Canvas mode: ${mode}${mode === 'design' ? ' (authoring)' : ' (read-only posture)'}`,
    ]
    if (activePathKeys.length > 0)
      lines.push(`Visible path variants: ${activePathKeys.join(', ')}`)
    const recent = [...changes].reverse().slice(0, 5)
    if (recent.length > 0) {
      lines.push(
        'Recent changes this browser session, newest first (get_change_history has all):',
        ...recent.map(
          (entry) =>
            `- ${entry.author === 'agent' ? 'agent' : 'user'}: ${describeChange(entry)}`,
        ),
      )
    }
    return lines.join('\n')
  }, [activePathKeys, changes, mode])

  // "/" at the start of an otherwise word-only draft is a skill lookup.
  const slashQuery =
    !pendingSkill && draft.startsWith('/') && !draft.includes(' ')
      ? draft.slice(1).toLowerCase()
      : null
  const slashMatches =
    slashQuery !== null
      ? AGENT_SKILL_COMMANDS.filter((command) =>
          command.id.startsWith(slashQuery),
        )
      : []
  const slashOpen = slashMatches.length > 0

  const pickSkill = (command: AgentSkillCommand) => {
    if (!command.content) return
    setPendingSkill(command)
    setDraft('')
  }

  const send = () => {
    let text = draft.trim()
    let skill = pendingSkill
    // Typed-through form: "/map turn my notes into a scenario" sends in one go.
    if (!skill) {
      const parsed = parseSkillDraft(text)
      if (parsed?.command.content) {
        skill = parsed.command
        text = parsed.rest
      }
    }
    const attached = takePendingAgentAttachment()
    if (!text && skill) text = `Run ${skill.label} from the top of its flow.`
    if (!text && attached) text = 'Here are my canvas annotations.'
    if (!text || running || !client) {
      // Nothing usable to send — put a taken attachment back on the shelf.
      if (attached) setPendingAgentAttachment(attached)
      return
    }
    setDraft('')
    setPendingSkill(null)
    void sendToAgent({
      client,
      sessionId: session.id,
      settings,
      contextNote,
      text,
      skill,
      attachment: attached,
    })
  }

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
        {/* The title is editable in place — auto-names are a default, not
            a decision. */}
        <button
          type="button"
          onClick={() => setRenaming(true)}
          title="Rename session"
          className="group/title flex min-w-0 flex-1 items-center gap-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="min-w-0 truncate text-xs font-medium text-foreground">
            {session.title}
          </span>
          <Pencil
            className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100"
            aria-hidden
          />
        </button>
        {changeCount > 0 ? (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            ✦ {changeCount} chg
          </span>
        ) : null}
      </div>

      {/* MessageScroller owns the hard parts: anchored turns, streamed
          replies, jump-to-latest. */}
      <MessageScrollerProvider>
        <MessageScroller className="relative min-h-0 flex-1">
        <MessageScrollerViewport className="p-3">
          <MessageScrollerContent className="flex flex-col gap-2.5">
        {events.length === 0 ? (
          keyed ? (
            <p className="text-xs text-muted-foreground">
              Ready ({modelFor(settings)}). Writes land live on the canvas
              and in the change sheet as ✦ rows — each one revertible.
            </p>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <p className="text-xs text-muted-foreground">
                No provider key yet — the key stays in this browser only.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs"
                onClick={openAgentSettings}
              >
                Add API key…
              </Button>
            </div>
          )
        ) : (
          // Index keys are safe here: the transcript is append-only.
          events.map((event, index) => (
            <MessageScrollerItem key={index} scrollAnchor={index === events.length - 1}>
              <TranscriptRow event={event} />
            </MessageScrollerItem>
          ))
        )}
        {running ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
        ) : null}
          </MessageScrollerContent>
        </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <RenameSessionDialog
        session={renaming ? session : null}
        onOpenChange={(open) => {
          if (!open) setRenaming(false)
        }}
      />

      <div className="shrink-0 border-t border-border/60 p-2">
        {pendingSkill || attachment ? (
          <div className="mb-1.5 flex flex-col gap-1.5">
            {pendingSkill ? (
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {pendingSkill.label}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
                  {pendingSkill.description}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remove skill"
                  onClick={() => setPendingSkill(null)}
                >
                  <X className="size-3" aria-hidden />
                </Button>
              </div>
            ) : null}
            {attachment ? (
              <Attachment size="sm" className="w-full">
                <AttachmentContent>
                  <AttachmentTitle className="text-xs">
                    {attachment.label}
                  </AttachmentTitle>
                  <AttachmentDescription className="text-[10px]">
                    {attachment.lines.join(' · ')}
                  </AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction
                    aria-label="Remove attachment"
                    onClick={() => setPendingAgentAttachment(null)}
                  >
                    <X className="size-3" aria-hidden />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
            ) : null}
          </div>
        ) : null}
        <div className="relative flex items-center gap-1.5">
          {/* The slash menu: type "/" to see the four skills — the same
              SKILL.md files IDE agents run, minus their file mechanics. */}
          {slashOpen ? (
            <div className="absolute bottom-full left-0 z-20 mb-1.5 w-72 rounded-md border border-border bg-popover p-1 shadow-md">
              {slashMatches.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  disabled={!command.content}
                  onClick={() => pickSkill(command)}
                  className="flex w-full items-baseline gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <span className="shrink-0 font-mono text-xs text-foreground">
                    {command.label}
                  </span>
                  <span className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
                    {command.description}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {running ? (
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Stop"
              title="Stop — whatever landed stays, revertible"
              onClick={() => stopAgent(session.id)}
            >
              <Square className="size-3" aria-hidden />
            </Button>
          ) : null}
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (slashOpen && (event.key === 'Enter' || event.key === 'Tab')) {
                event.preventDefault()
                const first = slashMatches.find((command) => command.content)
                if (first) pickSkill(first)
                return
              }
              if (slashOpen && event.key === 'Escape') {
                setDraft('')
                return
              }
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send()
              }
            }}
            placeholder={
              keyed ? 'Message the agent… ("/" for skills)' : 'Add a key in ⚙ first'
            }
            className="h-7 flex-1 text-xs"
            aria-label="Message the agent"
            disabled={!keyed}
          />
          <Button
            type="button"
            size="icon-sm"
            variant="default"
            aria-label="Send"
            disabled={
              !keyed ||
              running ||
              (draft.trim() === '' && !pendingSkill && !attachment)
            }
            onClick={send}
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
  const open = useAgentSettingsOpen()
  const setOpen = setAgentSettingsOpen
  // Live model list from the provider's own list-models endpoint — current
  // by construction. The curated MODEL_OPTIONS list is only the no-key
  // fallback. null = not fetched (no key / failed / loading).
  const [liveModels, setLiveModels] = useState<{
    provider: string
    models: string[]
  } | null>(null)
  const provider = settings.provider
  const savedKeyForFetch = settings.keys[provider]
  useEffect(() => {
    if (!open || !savedKeyForFetch) return
    const controller = new AbortController()
    listModels(provider, savedKeyForFetch, controller.signal)
      .then((models) => {
        if (!controller.signal.aborted && models.length > 0)
          setLiveModels({ provider, models })
      })
      .catch(() => {
        // Fallback list stays; a failed listing is not worth an error state.
      })
    return () => controller.abort()
  }, [open, provider, savedKeyForFetch])
  // Stale fetches self-invalidate by provider tag — no reset effect needed.
  const modelChoices =
    liveModels && liveModels.provider === provider
      ? liveModels.models
      : MODEL_OPTIONS[provider]
  const providerLabel =
    AGENT_PROVIDERS.find((entry) => entry.id === settings.provider)?.label ??
    settings.provider
  const savedKey = settings.keys[settings.provider]

  return (
    <TooltipProvider delay={300}>
      <Popover open={open} onOpenChange={setOpen}>
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
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 flex-1 justify-start font-mono text-xs"
                    >
                      {modelFor(settings)}
                    </Button>
                  }
                />
                <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                  {modelChoices.map((model) => (
                    <DropdownMenuItem
                      key={model}
                      onClick={() =>
                        saveAgentSettings({
                          models: { [settings.provider]: model },
                        })
                      }
                    >
                      <span className="font-mono text-xs">{model}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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

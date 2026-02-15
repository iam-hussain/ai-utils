import { useState, useEffect, useRef, useCallback } from 'react'
import { socket } from '@/lib/socket'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ChatHistorySidebar } from '@/components/layout/ChatHistorySidebar'
import { Mic, Send, Paperclip, Wrench, Loader2, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import useAudioRecorder from '@/hooks/useAudioRecorder'
import { AppLayout, type AppView } from '@/components/layout/AppLayout'
import {
  loadChats,
  loadChatsFromServer,
  saveChats,
  syncChatsToServer,
  createChat,
  getChatTitleFromMessages,
  type Chat,
  type ChatMessage,
} from '@/lib/chat-history'
import { deleteChat, deleteAllChats } from '@/lib/chat-api'
import { useUserData } from '@/contexts/UserDataContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Skill } from '@/lib/skills'
import { callMCPTool } from '@/lib/mcp-api'
import { SelectionPanel } from '@/components/selection-panel/SelectionPanel'
import { useConfirm } from '@/contexts/ConfirmContext'

interface Message {
  id: string
  content: string
  type: 'human' | 'system' | 'ai'
  timestamp: Date
  audioData?: string
}

interface ChatLayoutProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
}

export default function ChatLayout({ currentView, onNavigate }: ChatLayoutProps) {
  const { mcpSelection, skills, skillSelection, llmProvider, updateLLMProvider, refresh } = useUserData()
  const selectedSkills = skills.filter((s) => skillSelection.includes(s.id))
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [chats, setChats] = useState<Chat[]>(() => loadChats())
  const [chatsLoaded, setChatsLoaded] = useState(false)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isCallingTool, setIsCallingTool] = useState(false)
  const [historySheetOpen, setHistorySheetOpen] = useState(false)
  const [attachmentLoading, setAttachmentLoading] = useState(false)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)

  const refreshSelection = useCallback(() => {
    refresh()
  }, [refresh])
  const { isRecording, startRecording, stopRecording, error: audioError, clearError: clearAudioError } = useAudioRecorder()
  const { confirm } = useConfirm()
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const currentChat = chats.find((c) => c.id === currentChatId)

  useEffect(() => {
    loadChatsFromServer().then((serverChats) => {
      if (serverChats.length > 0) {
        setChats(serverChats)
      }
      setChatsLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!chatsLoaded) return
    if (chats.length === 0) {
      const newChat = createChat()
      setChats([newChat])
      setCurrentChatId(newChat.id)
    } else if (!currentChatId && chats.length > 0) {
      setCurrentChatId(chats[0]!.id)
    }
  }, [chats.length, currentChatId])

  useEffect(() => {
    if (currentChatId) {
      socket.emit('join_room', currentChatId)
      const chat = chats.find((c) => c.id === currentChatId)
      if (chat) {
        setMessages(
          chat.messages.map((m) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }))
        )
      } else {
        setMessages([])
      }
      return () => {
        socket.emit('leave_room', currentChatId)
      }
    }
  }, [currentChatId])

  useEffect(() => {
    saveChats(chats)
    if (chatsLoaded) syncChatsToServer(chats)
  }, [chats, chatsLoaded])

  useEffect(() => {
    function onConnect() {
      setIsConnected(true)
    }

    function onDisconnect() {
      setIsConnected(false)
    }

    function onReceiveMessage(message: Message) {
      setMessages((prev) => [...prev, message])
      setChats((prev) => {
        const chat = prev.find((c) => c.id === currentChatId)
        if (!chat) return prev
        const msg: ChatMessage = {
          id: message.id,
          content: message.content,
          type: message.type,
          timestamp:
            typeof message.timestamp === 'string'
              ? message.timestamp
              : message.timestamp.toISOString(),
          ...(message.audioData && { audioData: message.audioData }),
        }
        const updated: Chat = {
          ...chat,
          messages: [...chat.messages, msg],
          title:
            chat.title === 'New Chat' && message.type === 'human'
              ? getChatTitleFromMessages([...chat.messages, msg])
              : chat.title,
          updatedAt: Date.now(),
        }
        return prev.map((c) => (c.id === currentChatId ? updated : c))
      })
    }

    function onAiStreamStart(payload: { id: string; type: string; timestamp: Date }) {
      const msg: Message = {
        id: payload.id,
        content: '',
        type: 'ai',
        timestamp: payload.timestamp instanceof Date ? payload.timestamp : new Date(payload.timestamp),
      }
      setMessages((prev) => [...prev, msg])
    }

    function onAiStreamChunk(payload: { id: string; delta: string }) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.id ? { ...m, content: m.content + payload.delta } : m
        )
      )
    }

    function onAiStreamEnd(payload: {
      id: string
      type?: string
      timestamp?: Date
      content?: string
      error?: string
    }) {
      if (payload.error) return
      const content = payload.content ?? ''
      const timestamp =
        payload.timestamp instanceof Date
          ? payload.timestamp.toISOString()
          : new Date().toISOString()
      setChats((prev) => {
        const chat = prev.find((c) => c.id === currentChatId)
        if (!chat) return prev
        if (chat.messages.some((m) => m.id === payload.id)) return prev
        const msg: ChatMessage = {
          id: payload.id,
          content,
          type: 'ai',
          timestamp,
        }
        const updated: Chat = {
          ...chat,
          messages: [...chat.messages, msg],
          updatedAt: Date.now(),
        }
        return prev.map((c) => (c.id === currentChatId ? updated : c))
      })
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('receive_message', onReceiveMessage)
    socket.on('ai_stream_start', onAiStreamStart)
    socket.on('ai_stream_chunk', onAiStreamChunk)
    socket.on('ai_stream_end', onAiStreamEnd)

    socket.connect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('receive_message', onReceiveMessage)
      socket.off('ai_stream_start', onAiStreamStart)
      socket.off('ai_stream_chunk', onAiStreamChunk)
      socket.off('ai_stream_end', onAiStreamEnd)
      socket.disconnect()
    }
  }, [currentChatId])

  useEffect(() => {
    refreshSelection()
  }, [currentView, refreshSelection])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleCallTool = useCallback(async () => {
    const sel = mcpSelection
    if (!sel || !currentChatId) return
    const promptText = inputMessage.trim() || 'Hello'
    setIsCallingTool(true)
    try {
      const payload =
        sel.serverUrl != null
          ? { url: sel.serverUrl, toolName: sel.tool.name, toolArgs: { query: promptText } }
          : sel.serverConfig != null
            ? {
              command: sel.serverConfig.command,
              args: sel.serverConfig.args,
              toolName: sel.tool.name,
              toolArgs: { query: promptText },
            }
            : null
      if (!payload) return
      const result = await callMCPTool(payload)
      const text =
        result.content?.find((c) => c.type === 'text')?.text ??
        JSON.stringify(result.content ?? result)
      const toolMsg: Message = {
        id: `tool-${Date.now()}`,
        content: `[MCP tool: ${sel.tool.name}]\nInput: ${promptText}\n\nResult:\n${text}`,
        type: 'system',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, toolMsg])
      setChats((prev) => {
        const chat = prev.find((c) => c.id === currentChatId)
        if (!chat) return prev
        const msg: ChatMessage = {
          id: toolMsg.id,
          content: toolMsg.content,
          type: 'system',
          timestamp: toolMsg.timestamp.toISOString(),
        }
        return prev.map((c) =>
          c.id === currentChatId
            ? { ...c, messages: [...c.messages, msg], updatedAt: Date.now() }
            : c
        )
      })
      setInputMessage('')
    } finally {
      setIsCallingTool(false)
    }
  }, [inputMessage, currentChatId, mcpSelection])

  const handleNewChat = useCallback(() => {
    const newChat = createChat()
    setChats((prev) => [newChat, ...prev])
    setCurrentChatId(newChat.id)
    setHistorySheetOpen(false)
  }, [])

  const handleSelectChat = useCallback((id: string) => {
    setCurrentChatId(id)
    setHistorySheetOpen(false)
  }, [])

  const handleDeleteChat = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: 'Delete chat',
        description: 'This cannot be undone.',
        confirmLabel: 'Delete',
        variant: 'destructive',
      })
      if (!ok) return
      setChats((prev) => {
        const next = prev.filter((c) => c.id !== id)
        if (next.length === 0) {
          const newChat = createChat()
          setCurrentChatId(newChat.id)
          saveChats([newChat])
          return [newChat]
        }
        if (currentChatId === id) {
          setCurrentChatId(next[0]!.id)
        }
        saveChats(next)
        return next
      })
      try {
        await deleteChat(id)
      } catch {
        // Fire-and-forget; local state already updated
      }
    },
    [currentChatId, confirm]
  )

  const handleClearAllHistory = useCallback(async () => {
    const ok = await confirm({
      title: 'Clear all history',
      description: 'This cannot be undone. All conversations will be permanently deleted.',
      confirmLabel: 'Clear all',
      variant: 'destructive',
    })
    if (!ok) return
    const newChat = createChat()
    setChats([newChat])
    setCurrentChatId(newChat.id)
    saveChats([newChat])
    setHistorySheetOpen(false)
    try {
      await deleteAllChats()
    } catch {
      // Fire-and-forget
    }
  }, [confirm])

  const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB

  const handleAttachment = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setAttachmentError(null)
      if (file.size > MAX_FILE_SIZE) {
        setAttachmentError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`)
        e.target.value = ''
        return
      }
      setAttachmentLoading(true)
      const reader = new FileReader()
      reader.onload = () => {
        setAttachmentLoading(false)
        const result = reader.result as string
        if (file.type.startsWith('image/')) {
          setInputMessage((prev) =>
            prev.trim()
              ? `${prev}\n\n![${file.name}](${result})`
              : `![${file.name}](${result})`
          )
        } else {
          const text = typeof result === 'string' ? result : ''
          setInputMessage((prev) => (prev.trim() ? `${prev}\n\n${text}` : text))
        }
      }
      reader.onerror = () => {
        setAttachmentLoading(false)
        setAttachmentError('Failed to read file')
      }
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file)
      } else {
        reader.readAsText(file)
      }
      e.target.value = ''
    },
    []
  )

  const handleSendMessage = useCallback(() => {
    if (!inputMessage.trim() || !currentChatId) return

    const skillContent =
      selectedSkills.length > 0
        ? selectedSkills.map((s: Skill) => `## ${s.name}\n\n${s.content}`).join('\n\n---\n\n')
        : undefined

    socket.emit('send_message', {
      roomId: currentChatId,
      message: inputMessage.trim(),
      type: 'human',
      skills: skillContent,
      llmProvider: llmProvider,
      history: messages.map((m) => ({ content: m.content, type: m.type })),
    })

    setInputMessage('')
  }, [inputMessage, currentChatId, messages, selectedSkills, llmProvider])

  return (
    <AppLayout
      currentView={currentView}
      onNavigate={onNavigate}
      isConnected={isConnected}
      chats={chats}
      currentChatId={currentChatId}
      onSelectChat={handleSelectChat}
      onNewChat={handleNewChat}
      onDeleteChat={handleDeleteChat}
      onClearAllHistory={handleClearAllHistory}
    >
      <header className="h-12 shrink-0 border-b flex items-center px-4 sm:px-6 justify-between gap-2 sm:gap-4 bg-background/50 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
          <Sheet open={historySheetOpen} onOpenChange={setHistorySheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 shrink-0" aria-label="Chat history">
                <History className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 flex flex-col">
              <SheetHeader className="sr-only">
                <SheetTitle>Chat history</SheetTitle>
              </SheetHeader>
              <div className="flex-1 min-h-0 overflow-hidden pt-6">
                <ChatHistorySidebar
                  chats={chats}
                  currentChatId={currentChatId ?? null}
                  onSelectChat={handleSelectChat}
                  onNewChat={handleNewChat}
                  onDeleteChat={handleDeleteChat}
                  onClearAllHistory={handleClearAllHistory}
                  embedded
                />
              </div>
            </SheetContent>
          </Sheet>
          <h1 className="font-semibold text-sm truncate min-w-0">
            {currentChat?.title ?? 'New Chat'}
          </h1>
          <Select value={llmProvider} onValueChange={(v) => updateLLMProvider(v as 'openai' | 'anthropic' | 'google')}>
            <SelectTrigger className="w-[130px] sm:w-[160px] h-8 text-xs shrink-0">
              <SelectValue placeholder="LLM" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic Claude</SelectItem>
              <SelectItem value="google">Google Gemini</SelectItem>
            </SelectContent>
          </Select>
          <div className="hidden sm:flex">
            <SelectionPanel
              compact
              onMcpChange={refreshSelection}
              onSkillChange={refreshSelection}
            />
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1 p-4 sm:p-6">
        <div className="space-y-6 max-w-3xl mx-auto py-4 w-full">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex flex-col max-w-[95%] sm:max-w-[85%]',
                msg.type === 'human' ? 'ml-auto items-end' : 'mr-auto items-start'
              )}
            >
              <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-semibold ml-1">
                {msg.type}
              </div>
              <div
                className={cn(
                  'px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm',
                  msg.type === 'human'
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : msg.type === 'system'
                      ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-100'
                      : 'bg-muted rounded-tl-sm'
                )}
              >
                {msg.audioData && (
                  <audio
                    controls
                    src={msg.audioData}
                    className="w-full max-w-xs mb-2"
                  />
                )}
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-4 sm:p-6 border-t bg-background pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          <div className="relative flex items-end gap-1 sm:gap-2 p-2 sm:p-3 rounded-xl border bg-muted/30 focus-within:ring-1 ring-ring transition-all">
            {mcpSelection && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-9 w-9 rounded-full self-end mb-0.5 text-muted-foreground hover:text-foreground"
                onClick={handleCallTool}
                disabled={isCallingTool}
                title={`Call ${mcpSelection.tool.name}`}
              >
                {isCallingTool ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Wrench className="w-5 h-5" />
                )}
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.txt,.md,.json,.csv"
              className="hidden"
              onChange={handleAttachment}
              aria-hidden
            />
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-9 w-9 min-w-[2.25rem] min-h-[2.25rem] rounded-full self-end mb-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              type="button"
              aria-label="Attach file"
              title="Attach file (images, text, max 4MB)"
              disabled={attachmentLoading}
            >
              {attachmentLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Paperclip className="w-5 h-5" />
              )}
            </Button>

            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder="Message AI Utils..."
              rows={2}
              className="border-0 shadow-none focus-visible:ring-0 focus-visible:outline-none bg-transparent px-2 py-2.5 min-h-[44px] max-h-[200px] flex-1 text-base sm:text-sm resize-y w-full"
            />

            <div className="flex items-center gap-1 self-end mb-0.5">
              <Button
                size="icon"
                variant={isRecording ? 'destructive' : 'ghost'}
                className={cn(
                  'h-8 w-8 rounded-full text-muted-foreground hover:text-foreground',
                  isRecording && 'animate-pulse'
                )}
                aria-label={isRecording ? 'Stop recording' : 'Record voice message'}
                title={
                  !currentChatId
                    ? 'Start a chat first'
                    : audioError || (isRecording ? 'Stop and send' : 'Record voice message')
                }
                disabled={!currentChatId}
                onClick={async () => {
                  if (!currentChatId) return
                  if (audioError) clearAudioError()
                  if (isRecording) {
                    try {
                      const { transcript, audioBlob } = await stopRecording()
                      const content = transcript || '[Audio message – no speech detected]'
                      const audioData =
                        audioBlob.size > 0
                          ? await new Promise<string>((res) => {
                            const r = new FileReader()
                            r.onloadend = () => res(r.result as string)
                            r.readAsDataURL(audioBlob)
                          })
                          : undefined
                      const skillContent =
                        selectedSkills.length > 0
                          ? selectedSkills
                            .map((s: Skill) => `## ${s.name}\n\n${s.content}`)
                            .join('\n\n---\n\n')
                          : undefined
                      socket.emit('send_message', {
                        roomId: currentChatId,
                        message: content,
                        type: 'human',
                        skills: skillContent,
                        llmProvider: llmProvider,
                        history: messages.map((m) => ({ content: m.content, type: m.type })),
                        ...(audioData && { audioData }),
                      })
                    } catch (err) {
                      console.error('Failed to send audio:', err)
                    }
                  } else {
                    startRecording()
                  }
                }}
              >
                <Mic className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                className={cn(
                  'h-8 w-8 rounded-full transition-all',
                  inputMessage.trim()
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
                onClick={handleSendMessage}
                disabled={!inputMessage.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {(audioError || attachmentError) && (
            <div
              className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mt-2"
              role="alert"
            >
              <span className="flex-1">{audioError ?? attachmentError}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-destructive hover:text-destructive"
                onClick={() => {
                  clearAudioError()
                  setAttachmentError(null)
                }}
              >
                Dismiss
              </Button>
            </div>
          )}
          <div className="text-[10px] text-center text-muted-foreground">
            AI Utils can make mistakes. Consider checking important information.
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

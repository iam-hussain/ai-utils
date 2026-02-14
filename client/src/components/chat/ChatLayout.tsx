import { useState, useEffect, useRef, useCallback } from 'react'
import { socket } from '@/lib/socket'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Mic, Send, Paperclip, Wrench, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import useAudioRecorder from '@/hooks/useAudioRecorder'
import { AppLayout, type AppView } from '@/components/layout/AppLayout'
import {
  loadChats,
  saveChats,
  createChat,
  getChatTitleFromMessages,
  type Chat,
  type ChatMessage,
} from '@/lib/chat-history'
import { loadMCPSelection } from '@/lib/mcp-selection'
import { loadSkills, type Skill } from '@/lib/skills'
import { getSelectedSkills } from '@/lib/skill-selection'
import { callMCPTool } from '@/lib/mcp-api'
import { SelectionPanel } from '@/components/selection-panel/SelectionPanel'

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
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [chats, setChats] = useState<Chat[]>(() => loadChats())
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [mcpSelection, setMcpSelection] = useState(() => loadMCPSelection())
  const [isCallingTool, setIsCallingTool] = useState(false)

  const refreshSelection = useCallback(() => {
    setMcpSelection(loadMCPSelection())
  }, [])
  const { isRecording, startRecording, stopRecording } = useAudioRecorder()
  const scrollRef = useRef<HTMLDivElement>(null)

  const currentChat = chats.find((c) => c.id === currentChatId)

  useEffect(() => {
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
  }, [chats])

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

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('receive_message', onReceiveMessage)

    socket.connect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('receive_message', onReceiveMessage)
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
    const sel = loadMCPSelection()
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
  }, [inputMessage, currentChatId])

  const handleNewChat = useCallback(() => {
    const newChat = createChat()
    setChats((prev) => [newChat, ...prev])
    setCurrentChatId(newChat.id)
  }, [])

  const handleSelectChat = useCallback((id: string) => {
    setCurrentChatId(id)
  }, [])

  const handleSendMessage = useCallback(() => {
    if (!inputMessage.trim() || !currentChatId) return

    const skills = getSelectedSkills(loadSkills())
    const skillContent =
      skills.length > 0
        ? skills.map((s: Skill) => `## ${s.name}\n\n${s.content}`).join('\n\n---\n\n')
        : undefined

    socket.emit('send_message', {
      roomId: currentChatId,
      message: inputMessage.trim(),
      type: 'human',
      skills: skillContent,
    })

    setInputMessage('')
  }, [inputMessage, currentChatId])

  return (
    <AppLayout
      currentView={currentView}
      onNavigate={onNavigate}
      isConnected={isConnected}
      chats={chats}
      currentChatId={currentChatId}
      onSelectChat={handleSelectChat}
      onNewChat={handleNewChat}
    >
      <header className="h-12 shrink-0 border-b flex items-center px-6 justify-between gap-4 bg-background/50 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <h1 className="font-semibold text-sm truncate shrink-0">
            {currentChat?.title ?? 'New Chat'}
          </h1>
          <SelectionPanel
            compact
            onMcpChange={refreshSelection}
            onSkillChange={refreshSelection}
          />
        </div>
      </header>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6 max-w-3xl mx-auto py-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex flex-col max-w-[85%]',
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

      <div className="p-4 border-t bg-background">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          <div className="relative flex items-end gap-2 p-2 rounded-xl border bg-muted/30 focus-within:ring-1 ring-ring transition-all">
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
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-9 w-9 rounded-full self-end mb-0.5 text-muted-foreground hover:text-foreground"
            >
              <Paperclip className="w-5 h-5" />
            </Button>

            <Input
              value={inputMessage}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setInputMessage(e.target.value)
              }
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) =>
                e.key === 'Enter' && !e.shiftKey && handleSendMessage()
              }
              placeholder="Message AI Utils..."
              className="border-0 shadow-none focus-visible:ring-0 bg-transparent px-2 py-2.5 h-auto min-h-[44px] max-h-[200px] flex-1"
            />

            <div className="flex items-center gap-1 self-end mb-0.5">
              <Button
                size="icon"
                variant={isRecording ? 'destructive' : 'ghost'}
                className={cn(
                  'h-8 w-8 rounded-full text-muted-foreground hover:text-foreground',
                  isRecording && 'animate-pulse'
                )}
                onClick={async () => {
                  if (isRecording) {
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
                    socket.emit('send_message', {
                      roomId: currentChatId,
                      message: content,
                      type: 'human',
                      ...(audioData && { audioData }),
                    })
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
          <div className="text-[10px] text-center text-muted-foreground">
            AI Utils can make mistakes. Consider checking important information.
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

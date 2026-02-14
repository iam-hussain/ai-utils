import { useState, useEffect, useRef } from 'react';
import { socket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, Send, Paperclip, Settings, MoreVertical, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import useAudioRecorder from '@/hooks/useAudioRecorder';

// Types
interface Message {
  id: string;
  content: string;
  type: 'human' | 'system' | 'ai';
  timestamp: Date;
}

export default function ChatLayout() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedRole, setSelectedRole] = useState<'human' | 'system'>('human');
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onReceiveMessage(message: Message) {
      setMessages(prev => [...prev, message]);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('receive_message', onReceiveMessage);

    socket.connect();

    // Join a default room
    socket.emit('join_room', 'general');

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('receive_message', onReceiveMessage);
      socket.disconnect();
    };
  }, []);
  
  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    // Emit message to server
    socket.emit('send_message', {
      roomId: 'general',
      message: inputMessage,
      type: selectedRole 
    });

    setInputMessage('');
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/20 hidden md:flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg tracking-tight">AI Utils</h2>
          <Button variant="ghost" size="icon"><Plus className="w-5 h-5" /></Button>
        </div>
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            <Button variant="secondary" className="w-full justify-start text-left truncate font-normal">
              New Chat
            </Button>
            <Button variant="ghost" className="w-full justify-start text-left truncate text-muted-foreground font-normal">
              Previous Chat...
            </Button>
          </div>
        </ScrollArea>
        <div className="p-4 border-t space-y-2">
          <Button variant="outline" className="w-full justify-start">
            <Settings className="w-4 h-4 mr-2" /> Settings
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
             <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-green-500" : "bg-red-500")} />
             {isConnected ? "Connected" : "Disconnected"}
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        <header className="h-14 border-b flex items-center px-6 justify-between bg-background/50 backdrop-blur sticky top-0 z-10">
          <h1 className="font-semibold text-sm">General Chat</h1>
          <Button variant="ghost" size="icon"><MoreVertical className="w-5 h-5" /></Button>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6 max-w-3xl mx-auto py-4">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "flex flex-col max-w-[85%]",
                  msg.type === 'human' ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-semibold ml-1">
                    {msg.type}
                </div>
                <div 
                  className={cn(
                    "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                    msg.type === 'human' 
                      ? "bg-primary text-primary-foreground rounded-tr-sm" 
                      : msg.type === 'system'
                      ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-100"
                      : "bg-muted rounded-tl-sm"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t bg-background">
          <div className="max-w-3xl mx-auto flex flex-col gap-2">
             <div className="relative flex items-end gap-2 p-2 rounded-xl border bg-muted/30 focus-within:ring-1 ring-ring transition-all">
                <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 rounded-full self-end mb-0.5 text-muted-foreground hover:text-foreground">
                    <Paperclip className="w-5 h-5" />
                </Button>
                
                <Input 
                    value={inputMessage}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputMessage(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder="Message AI Utils..."
                    className="border-0 shadow-none focus-visible:ring-0 bg-transparent px-2 py-2.5 h-auto min-h-[44px] max-h-[200px] flex-1"
                />

                <div className="flex items-center gap-1 self-end mb-0.5">
                    <Select value={selectedRole} onValueChange={(val: 'human' | 'system') => setSelectedRole(val)}>
                        <SelectTrigger className="h-8 w-[90px] text-xs border-0 bg-transparent focus:ring-0 px-2 gap-1 text-muted-foreground hover:text-foreground">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="human">Human</SelectItem>
                            <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button 
                        size="icon" 
                        variant={isRecording ? "destructive" : "ghost"} 
                        className={cn("h-8 w-8 rounded-full text-muted-foreground hover:text-foreground", isRecording && "animate-pulse")}
                        onClick={async () => {
                             if (isRecording) {
                                 const audioBlob = await stopRecording();
                                 console.log("Audio recorded:", audioBlob.size, "bytes");
                                 // TODO: Send audioBlob to server or transcribe locally
                                 // For now just simulate sending audio message placeholder
                                 socket.emit('send_message', {
                                    roomId: 'general',
                                    message: `[Audio Message: ${Math.round(audioBlob.size / 1024)} KB]`,
                                    type: 'human'
                                 });
                             } else {
                                 startRecording();
                             }
                        }}
                    >
                        <Mic className="w-4 h-4" />
                    </Button>
                    <Button 
                        size="icon" 
                        className={cn("h-8 w-8 rounded-full transition-all", inputMessage.trim() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")} 
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
      </main>
    </div>
  );
}

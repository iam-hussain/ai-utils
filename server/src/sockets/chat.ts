import { Server, Socket } from 'socket.io';
import { graph } from '../langgraph/graph';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage, FunctionMessage, ChatMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';

export default function setupChatSockets(io: Server) {
    io.on('connection', (socket: Socket) => {
        console.log(`User connected: ${socket.id}`);

        socket.on('join_room', (roomId: string) => {
            socket.join(roomId);
            console.log(`User ${socket.id} joined room ${roomId}`);
        });

        socket.on('leave_room', (roomId: string) => {
            socket.leave(roomId);
        });

        socket.on('send_message', async (data: { roomId: string, message: string, type: 'human' | 'system' | 'ai', skills?: string, audioData?: string }) => {
            const { roomId, message, type, skills, audioData } = data;
            console.log(`Received message in ${roomId}:`, message);

            // Broadcast the user message back to the room (optimistic update or just relay)
            io.to(roomId).emit('receive_message', {
                id: Date.now().toString(),
                content: message,
                type: type,
                timestamp: new Date(),
                ...(audioData && { audioData })
            });

            if (type === 'human') {
                try {
                    const messages: BaseMessage[] = [];
                    if (skills && typeof skills === 'string' && skills.trim().length > 0) {
                        messages.push(new SystemMessage(`[Context from selected skills]\n\n${skills}\n\n---\n\n`));
                    }
                    messages.push(new HumanMessage(message));

                    const result = await graph.invoke({
                        messages,
                    });

                    const aiMessage = result.messages[result.messages.length - 1];

                    io.to(roomId).emit('receive_message', {
                        id: Date.now().toString(),
                        content: aiMessage.content,
                        type: 'ai',
                        timestamp: new Date()
                    });
                } catch (error) {
                    console.error("Error processing message through LangGraph:", error);
                    io.to(roomId).emit('error', { message: "Failed to process message" });
                }
            }
        });

        socket.on('test_prompt', async (data: { messages?: Array<{ type: string; content: string; name?: string; role?: string }>; prompt?: string; type?: 'human' | 'system' | 'ai' }) => {
            try {
                let messageList: BaseMessage[];
                if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
                    messageList = data.messages.map((m) => {
                        switch (m.type) {
                            case 'human': return new HumanMessage(m.content);
                            case 'system': return new SystemMessage(m.content);
                            case 'ai': return new AIMessage(m.content);
                            case 'tool': return new ToolMessage({ content: m.content, tool_call_id: 'test-tool-call' });
                            case 'function': return new FunctionMessage({ content: m.content, name: m.name || 'function' });
                            case 'chat': return new ChatMessage(m.content, m.role || 'user');
                            default: return new HumanMessage(m.content);
                        }
                    });
                } else if (typeof data.prompt === 'string' && data.type) {
                    const p = data.prompt;
                    const t = data.type;
                    const msg = t === 'human' ? new HumanMessage(p) : t === 'system' ? new SystemMessage(p) : new AIMessage(p);
                    messageList = [msg];
                } else {
                    socket.emit('test_prompt_error', { message: 'Invalid payload: provide messages[] or prompt+type' });
                    return;
                }
                const result = await graph.invoke({ messages: messageList });
                const aiMessage = result.messages[result.messages.length - 1];
                const content = typeof aiMessage.content === 'string'
                    ? aiMessage.content
                    : JSON.stringify(aiMessage.content);
                socket.emit('test_prompt_result', { content });
            } catch (error) {
                console.error('Error in test_prompt:', error);
                socket.emit('test_prompt_error', {
                    message: error instanceof Error ? error.message : 'Failed to process prompt',
                });
            }
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
        });
    });
}

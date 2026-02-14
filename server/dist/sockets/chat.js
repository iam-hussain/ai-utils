"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = setupChatSockets;
const graph_1 = require("../langgraph/graph");
const messages_1 = require("@langchain/core/messages");
function setupChatSockets(io) {
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);
        socket.on('join_room', (roomId) => {
            socket.join(roomId);
            console.log(`User ${socket.id} joined room ${roomId}`);
        });
        socket.on('leave_room', (roomId) => {
            socket.leave(roomId);
        });
        socket.on('send_message', async (data) => {
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
                    const messages = [];
                    if (skills && typeof skills === 'string' && skills.trim().length > 0) {
                        messages.push(new messages_1.SystemMessage(`[Context from selected skills]\n\n${skills}\n\n---\n\n`));
                    }
                    messages.push(new messages_1.HumanMessage(message));
                    const result = await graph_1.graph.invoke({
                        messages,
                    });
                    const aiMessage = result.messages[result.messages.length - 1];
                    io.to(roomId).emit('receive_message', {
                        id: Date.now().toString(),
                        content: aiMessage.content,
                        type: 'ai',
                        timestamp: new Date()
                    });
                }
                catch (error) {
                    console.error("Error processing message through LangGraph:", error);
                    io.to(roomId).emit('error', { message: "Failed to process message" });
                }
            }
        });
        socket.on('test_prompt', async (data) => {
            try {
                let messageList;
                if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
                    messageList = data.messages.map((m) => {
                        switch (m.type) {
                            case 'human': return new messages_1.HumanMessage(m.content);
                            case 'system': return new messages_1.SystemMessage(m.content);
                            case 'ai': return new messages_1.AIMessage(m.content);
                            case 'tool': return new messages_1.ToolMessage({ content: m.content, tool_call_id: 'test-tool-call' });
                            case 'function': return new messages_1.FunctionMessage({ content: m.content, name: m.name || 'function' });
                            case 'chat': return new messages_1.ChatMessage(m.content, m.role || 'user');
                            default: return new messages_1.HumanMessage(m.content);
                        }
                    });
                }
                else if (typeof data.prompt === 'string' && data.type) {
                    const p = data.prompt;
                    const t = data.type;
                    const msg = t === 'human' ? new messages_1.HumanMessage(p) : t === 'system' ? new messages_1.SystemMessage(p) : new messages_1.AIMessage(p);
                    messageList = [msg];
                }
                else {
                    socket.emit('test_prompt_error', { message: 'Invalid payload: provide messages[] or prompt+type' });
                    return;
                }
                const result = await graph_1.graph.invoke({ messages: messageList });
                const aiMessage = result.messages[result.messages.length - 1];
                const content = typeof aiMessage.content === 'string'
                    ? aiMessage.content
                    : JSON.stringify(aiMessage.content);
                socket.emit('test_prompt_result', { content });
            }
            catch (error) {
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

import { Server, Socket } from 'socket.io';
import { graph } from '../langgraph/graph';
import { HumanMessage } from '@langchain/core/messages';

export default function setupChatSockets(io: Server) {
    io.on('connection', (socket: Socket) => {
        console.log(`User connected: ${socket.id}`);

        socket.on('join_room', (roomId: string) => {
            socket.join(roomId);
            console.log(`User ${socket.id} joined room ${roomId}`);
        });

        socket.on('send_message', async (data: { roomId: string, message: string, type: 'human' | 'system' | 'ai' }) => {
            const { roomId, message, type } = data;
            console.log(`Received message in ${roomId}:`, message);

            // Broadcast the user message back to the room (optimistic update or just relay)
            io.to(roomId).emit('receive_message', {
                id: Date.now().toString(),
                content: message,
                type: type,
                timestamp: new Date()
            });

            if (type === 'human') {
                try {
                    // Streaming response from LangGraph
                    // Note: LangGraph JS basic graph.invoke returns the final state.
                    // For streaming, we might need to use .stream() if supported or simulate it.
                    // For now, let's just use invoke and emit the result.

                    const result = await graph.invoke({
                        messages: [new HumanMessage(message)],
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

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
        });
    });
}

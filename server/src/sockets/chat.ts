import { Server, Socket } from 'socket.io'
import { getModel } from '../services/llm-service'
import { createGraph } from '../langgraph/graph'
import { HumanMessage, SystemMessage, AIMessage, ToolMessage, FunctionMessage, ChatMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import { sendMessageSchema, testPromptMessageSchema } from '../lib/schemas'
import { logger } from '../lib/logger'

export default function setupChatSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    logger.info('User connected', { socketId: socket.id })

    socket.on('join_room', (roomId: string) => {
      socket.join(roomId)
      logger.debug('User joined room', { socketId: socket.id, roomId })
    })

    socket.on('leave_room', (roomId: string) => {
      socket.leave(roomId)
    })

    socket.on('send_message', async (data: unknown) => {
      const parsed = sendMessageSchema.safeParse(data)
      if (!parsed.success) {
        socket.emit('error', { message: 'Invalid payload', details: parsed.error.flatten() })
        return
      }
      const { roomId, message, type, skills, audioData, history, llmProvider } = parsed.data
      const provider = llmProvider ?? 'openai'
      logger.debug('Received message', { roomId, messageLength: message.length })

      io.to(roomId).emit('receive_message', {
        id: Date.now().toString(),
        content: message,
        type,
        timestamp: new Date(),
        ...(audioData && { audioData }),
      })

      if (type === 'human') {
        const msgId = Date.now().toString()
        try {
          const messages: BaseMessage[] = []
          if (skills && typeof skills === 'string' && skills.trim().length > 0) {
            messages.push(new SystemMessage(`[Context from selected skills]\n\n${skills}\n\n---\n\n`))
          }
          if (Array.isArray(history) && history.length > 0) {
            for (const h of history) {
              if (h.type === 'human') messages.push(new HumanMessage(h.content))
              else if (h.type === 'ai') messages.push(new AIMessage(h.content))
              else if (h.type === 'system') messages.push(new SystemMessage(h.content))
            }
          }
          messages.push(new HumanMessage(message))

          let fullContent = ''
          io.to(roomId).emit('ai_stream_start', { id: msgId, type: 'ai', timestamp: new Date() })

          const model = getModel(provider)
          const stream = await model.stream(messages)
          for await (const chunk of stream) {
            const content = chunk.content
            if (typeof content === 'string' && content) {
              fullContent += content
              io.to(roomId).emit('ai_stream_chunk', { id: msgId, delta: content })
            }
          }

          io.to(roomId).emit('ai_stream_end', {
            id: msgId,
            type: 'ai',
            timestamp: new Date(),
            content: fullContent,
          })
        } catch (error) {
          logger.error('Error processing message through LangGraph', { error, roomId })
          io.to(roomId).emit('ai_stream_end', { id: msgId, error: 'Failed to process message' })
          io.to(roomId).emit('error', { message: 'Failed to process message' })
        }
      }
    })

    socket.on('test_prompt', async (data: unknown) => {
      const parsed = testPromptMessageSchema.safeParse(data)
      if (!parsed.success) {
        socket.emit('test_prompt_error', { message: 'Invalid payload', details: parsed.error.flatten() })
        return
      }
      try {
        const provider = parsed.data.llmProvider ?? 'openai'
        const graph = createGraph(provider)
        let messageList: BaseMessage[]
        const d = parsed.data
        if (d.messages && d.messages.length > 0) {
          messageList = d.messages.map((m) => {
            switch (m.type) {
              case 'human': return new HumanMessage(m.content)
              case 'system': return new SystemMessage(m.content)
              case 'ai': return new AIMessage(m.content)
              case 'tool': return new ToolMessage({ content: m.content, tool_call_id: 'test-tool-call' })
              case 'function': return new FunctionMessage({ content: m.content, name: m.name || 'function' })
              case 'chat': return new ChatMessage(m.content, m.role || 'user')
              default: return new HumanMessage(m.content)
            }
          })
        } else if (typeof d.prompt === 'string' && d.type) {
          const p = d.prompt
          const t = d.type
          const msg = t === 'human' ? new HumanMessage(p) : t === 'system' ? new SystemMessage(p) : new AIMessage(p)
          messageList = [msg]
        } else {
          socket.emit('test_prompt_error', { message: 'Invalid payload: provide messages[] or prompt+type' })
          return
        }
        const result = await graph.invoke({ messages: messageList })
        const aiMessage = result.messages[result.messages.length - 1]
        const content = typeof aiMessage.content === 'string'
          ? aiMessage.content
          : JSON.stringify(aiMessage.content)
        socket.emit('test_prompt_result', { content })
      } catch (error) {
        logger.error('Error in test_prompt', { error })
        socket.emit('test_prompt_error', {
          message: error instanceof Error ? error.message : 'Failed to process prompt',
        })
      }
    })

    socket.on('disconnect', () => {
      logger.info('User disconnected', { socketId: socket.id })
    })
  })
}

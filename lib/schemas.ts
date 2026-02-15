import { z } from 'zod'

export const sendMessageSchema = z.object({
  roomId: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(['human', 'system', 'ai']),
  skills: z.string().optional(),
  audioData: z.string().optional(),
  llmProvider: z.enum(['openai', 'anthropic', 'google']).optional(),
  history: z.array(z.object({
    content: z.string(),
    type: z.string(),
  })).optional(),
})

export const testPromptMessageSchema = z.object({
  messages: z.array(z.object({
    type: z.string(),
    content: z.string(),
    name: z.string().optional(),
    role: z.string().optional(),
  })).optional(),
  prompt: z.string().optional(),
  type: z.enum(['human', 'system', 'ai']).optional(),
  llmProvider: z.enum(['openai', 'anthropic', 'google']).optional(),
}).refine(
  (data) =>
    (data.messages && data.messages.length > 0) ||
    (typeof data.prompt === 'string' && data.type),
  { message: 'Provide messages[] or prompt+type' }
)

export const mcpCallToolSchema = z.object({
  toolName: z.string().min(1),
  toolArgs: z.record(z.unknown()).optional(),
  url: z.string().url().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
}).refine(
  (data) =>
    (data.url && typeof data.url === 'string') ||
    (data.command && Array.isArray(data.args)),
  { message: 'Provide either url or command+args' }
)

export const mcpConnectSchema = z.object({
  url: z.string().url().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
}).refine(
  (data) => data.url !== undefined || (data.command !== undefined && Array.isArray(data.args)),
  { message: 'Provide either url or command+args' }
)

export type SendMessagePayload = z.infer<typeof sendMessageSchema>
export type TestPromptPayload = z.infer<typeof testPromptMessageSchema>
export type McpCallToolPayload = z.infer<typeof mcpCallToolSchema>
export type McpConnectPayload = z.infer<typeof mcpConnectSchema>

import { z } from 'zod'

export const chainStepSchema = z.object({ promptText: z.string(), expectedReply: z.string() })

export const promptEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  promptText: z.string(),
  reply: z.string().default(''),
  expectedReply: z.string().default(''),
  chainSteps: z.array(chainStepSchema).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const promptCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  prompts: z.array(promptEntrySchema).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const skillSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const mcpServerConfigSchema = z.object({
  command: z.string(),
  args: z.array(z.string()),
})

export const mcpToolInfoSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()).optional(),
})

export const mcpSelectionSchema = z.object({
  serverName: z.string(),
  serverConfig: mcpServerConfigSchema.optional(),
  serverUrl: z.string().optional(),
  tool: mcpToolInfoSchema,
})

export const promptMessageSchema = z.object({
  type: z.string(),
  content: z.string(),
  name: z.string().optional(),
  role: z.string().optional(),
})

export const savedPromptSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  messages: z.array(promptMessageSchema),
  createdAt: z.number(),
})

export const savedPromptSetCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  sets: z.array(savedPromptSetSchema).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const putUserDataSchema = z.object({
  skills: z.array(skillSchema).default([]),
  promptLibrary: z.array(promptCategorySchema).default([]),
  mcpServers: z.record(mcpServerConfigSchema).default({}),
  mcpSelection: mcpSelectionSchema.nullable().default(null),
  skillSelection: z.array(z.string()).default([]),
  savedPromptSets: z.array(savedPromptSetSchema).default([]),
  savedPromptSetCategories: z.array(savedPromptSetCategorySchema).default([]),
  llmProvider: z.enum(['openai', 'anthropic', 'google']).optional(),
})

export const updateTeamPromptsSchema = z.object({
  promptLibrary: z.array(promptCategorySchema).default([]),
  savedPromptSets: z.array(savedPromptSetSchema).default([]),
  savedPromptSetCategories: z.array(savedPromptSetCategorySchema).default([]),
})

export const createTeamSchema = z.object({ name: z.string().min(1).max(100).trim() })
export const inviteTeamSchema = z.object({ email: z.string().email().toLowerCase().trim() })
export const updateMemberRoleSchema = z.object({
  userId: z.string(),
  role: z.enum(['read', 'write']),
})

import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ChainStep {
  promptText: string
  expectedReply: string
}

export interface PromptEntry {
  id: string
  name: string
  promptText: string
  reply: string
  expectedReply: string
  chainSteps: ChainStep[]
  createdAt: number
  updatedAt: number
}

export interface PromptCategory {
  id: string
  name: string
  prompts: PromptEntry[]
  createdAt: number
  updatedAt: number
}

export interface Skill {
  id: string
  name: string
  content: string
  createdAt: number
  updatedAt: number
}

export interface MCPServerConfig {
  command: string
  args: string[]
}

export interface MCPToolInfo {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface MCPSelection {
  serverName: string
  serverConfig?: MCPServerConfig
  serverUrl?: string
  tool: MCPToolInfo
}

export interface PromptMessage {
  type: string
  content: string
  name?: string
  role?: string
}

export interface SavedPromptSet {
  id: string
  name: string
  messages: PromptMessage[]
  createdAt: number
}

export interface SavedPromptSetCategory {
  id: string
  name: string
  sets: SavedPromptSet[]
  createdAt: number
  updatedAt: number
}

export type LLMProvider = 'openai' | 'anthropic' | 'google'

export interface IUserData extends Document {
  userId: mongoose.Types.ObjectId
  skills: Skill[]
  promptLibrary: PromptCategory[]
  mcpServers: Record<string, MCPServerConfig>
  mcpSelection: MCPSelection | null
  skillSelection: string[]
  savedPromptSets: SavedPromptSet[]
  savedPromptSetCategories: SavedPromptSetCategory[]
  llmProvider: LLMProvider
  updatedAt: Date
}

const ChainStepSchema = new Schema({ promptText: String, expectedReply: String }, { _id: false })
const PromptEntrySchema = new Schema(
  {
    id: String,
    name: String,
    promptText: String,
    reply: String,
    expectedReply: String,
    chainSteps: [ChainStepSchema],
    createdAt: Number,
    updatedAt: Number,
  },
  { _id: false }
)
const PromptCategorySchema = new Schema(
  {
    id: String,
    name: String,
    prompts: [PromptEntrySchema],
    createdAt: Number,
    updatedAt: Number,
  },
  { _id: false }
)
const SkillSchema = new Schema(
  { id: String, name: String, content: String, createdAt: Number, updatedAt: Number },
  { _id: false }
)
const MCPToolInfoSchema = new Schema(
  { name: String, description: String, inputSchema: Schema.Types.Mixed },
  { _id: false }
)
const MCPSelectionSchema = new Schema(
  {
    serverName: String,
    serverConfig: { command: String, args: [String] },
    serverUrl: String,
    tool: MCPToolInfoSchema,
  },
  { _id: false }
)
const PromptMessageSchema = new Schema(
  { type: String, content: String, name: String, role: String },
  { _id: false }
)
const SavedPromptSetSchema = new Schema(
  {
    id: String,
    name: String,
    messages: [PromptMessageSchema],
    createdAt: Number,
  },
  { _id: false }
)
const SavedPromptSetCategorySchema = new Schema(
  {
    id: String,
    name: String,
    sets: [SavedPromptSetSchema],
    createdAt: Number,
    updatedAt: Number,
  },
  { _id: false }
)

const UserDataSchema = new Schema<IUserData>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    skills: { type: [SkillSchema], default: [] },
    promptLibrary: { type: [PromptCategorySchema], default: [] },
    mcpServers: { type: Schema.Types.Mixed, default: {} },
    mcpSelection: { type: MCPSelectionSchema, default: null },
    skillSelection: { type: [String], default: [] },
    savedPromptSets: { type: [SavedPromptSetSchema], default: [] },
    savedPromptSetCategories: { type: [SavedPromptSetCategorySchema], default: [] },
    llmProvider: { type: String, enum: ['openai', 'anthropic', 'google'], default: 'openai' },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
)

UserDataSchema.index({ userId: 1 })

export const UserData: Model<IUserData> =
  mongoose.models.UserData ?? mongoose.model<IUserData>('UserData', UserDataSchema)

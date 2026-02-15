import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ICriticResult {
  contradictions: string[]
  severity: 'low' | 'medium' | 'high'
  stepIndex?: number
}

export interface IAgentStep {
  agentId: string
  agentName?: string
  status: 'pending' | 'running' | 'complete' | 'failed'
  thought?: string
  action?: string
  observation?: string
  reflection?: string
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  startedAt?: Date
  completedAt?: Date
  criticResult?: ICriticResult
  tokensIn?: number
  tokensOut?: number
  durationMs?: number
  costUsd?: number
}

export interface IAgentDefinition {
  id: string
  prompt: string
  tools?: string[]
  inputSource?: string
  nextStep?: string
  dependencies?: string[]
}

export interface IAgentRun extends Document {
  userId: mongoose.Types.ObjectId
  projectName: string
  userGoal: string
  status: 'designing' | 'draft' | 'running' | 'complete' | 'failed' | 'paused'
  agentDefinitions?: IAgentDefinition[]
  steps: IAgentStep[]
  finalOutput?: string
  error?: string
  llmProvider: string
  forkedFromRunId?: mongoose.Types.ObjectId
  forkedAtStepIndex?: number
  ghostOfRunId?: mongoose.Types.ObjectId
  missionBrief?: { summary?: string; inputs?: string[]; stages?: string[]; successCriteria?: string[] }
  breakpoints?: { type: string; stepIndex?: number; maxRepeats?: number }[]
  pausedAtStepIndex?: number
  userHint?: string
  createdAt: Date
  updatedAt: Date
}

const CriticResultSchema = new Schema(
  {
    contradictions: { type: [String], default: [] },
    severity: { type: String, enum: ['low', 'medium', 'high'] },
    stepIndex: { type: Number },
  },
  { _id: false }
)

const AgentStepSchema = new Schema(
  {
    agentId: { type: String, required: true },
    agentName: { type: String },
    status: { type: String, enum: ['pending', 'running', 'complete', 'failed'], default: 'pending' },
    thought: { type: String },
    action: { type: String },
    observation: { type: String },
    reflection: { type: String },
    input: { type: Schema.Types.Mixed },
    output: { type: Schema.Types.Mixed },
    error: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
    criticResult: { type: CriticResultSchema },
    tokensIn: { type: Number },
    tokensOut: { type: Number },
    durationMs: { type: Number },
    costUsd: { type: Number },
  },
  { _id: false }
)

const AgentDefinitionSchema = new Schema(
  {
    id: { type: String, required: true },
    prompt: { type: String, required: true },
    tools: { type: [String] },
    inputSource: { type: String },
    nextStep: { type: String },
    dependencies: { type: [String] },
  },
  { _id: false }
)

const AgentRunSchema = new Schema<IAgentRun>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    projectName: { type: String, required: true, default: 'Untitled' },
    userGoal: { type: String, required: true },
    status: { type: String, enum: ['designing', 'draft', 'running', 'complete', 'failed', 'paused'], default: 'designing' },
    agentDefinitions: { type: [AgentDefinitionSchema] },
    steps: { type: [AgentStepSchema], default: [] },
    finalOutput: { type: String },
    error: { type: String },
    llmProvider: { type: String, default: 'openai' },
    forkedFromRunId: { type: Schema.Types.ObjectId, ref: 'AgentRun' },
    forkedAtStepIndex: { type: Number },
    ghostOfRunId: { type: Schema.Types.ObjectId, ref: 'AgentRun' },
    missionBrief: { type: Schema.Types.Mixed },
    breakpoints: { type: Schema.Types.Mixed },
    pausedAtStepIndex: { type: Number },
    userHint: { type: String },
  },
  { timestamps: true }
)

AgentRunSchema.index({ userId: 1, createdAt: -1 })

export const AgentRun: Model<IAgentRun> =
  mongoose.models.AgentRun ?? mongoose.model<IAgentRun>('AgentRun', AgentRunSchema)
